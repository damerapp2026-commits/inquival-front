import React, { useState } from 'react';
import { usePurchases, useCreatePurchase } from '../hooks/usePurchases';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts, useCreateProduct } from '../../products/hooks/useProducts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useRucLookup, useTipoCambio } from '../../../shared/hooks/useLookup';
import { useSupplierByRuc, useCreateSupplier } from '../../suppliers/hooks/useSuppliers';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { Plus, ShoppingCart, Trash2, Eye, Search, Loader2, DollarSign, PackagePlus } from 'lucide-react';
import type { Purchase, Company, Product, Category } from '../../../shared/types';
import toast from 'react-hot-toast';

export function PurchasesPage() {
  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);

  const { data, isLoading } = usePurchases({ page, limit: 20, companyId: companyFilter || undefined });
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 200 });
  const createPurchase = useCreatePurchase();
  const rucLookup = useRucLookup();
  const supplierByRuc = useSupplierByRuc();
  const createSupplier = useCreateSupplier();
  const tipoCambioMutation = useTipoCambio();
  const { data: categoriesData } = useCategories();
  const createProduct = useCreateProduct();
  const categories: Category[] = Array.isArray(categoriesData) ? categoriesData : (categoriesData as any)?.data || [];

  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [form, setForm] = useState({
    companyId: '', supplier: '', supplierRuc: '', supplierId: '',
    paymentType: 'CONTADO' as 'CONTADO' | 'CREDITO',
    paymentScheduleType: 'SINGLE_DATE' as 'SINGLE_DATE' | 'INSTALLMENTS', dueDate: '',
    installments: [] as { amount: number; dueDate: string }[],
    items: [{ productId: '', quantity: 0 }] as { productId: string; quantity: number }[],
    purchaseDate: new Date().toISOString().slice(0, 10),
    totalCostUsd: 0,
    totalCostPen: 0,
  });
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateDate, setExchangeRateDate] = useState('');
  const [supplierLocked, setSupplierLocked] = useState(false);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductForIdx, setNewProductForIdx] = useState<number>(-1);
  const [newProduct, setNewProduct] = useState({ name: '', categoryId: '', unit: 'unidad' });

  const openCreate = () => {
    const today = new Date().toISOString().slice(0, 10);
    setCurrency('PEN');
    setForm({ companyId: '', supplier: '', supplierRuc: '', supplierId: '', paymentType: 'CONTADO', paymentScheduleType: 'SINGLE_DATE', dueDate: '', installments: [], items: [], purchaseDate: today, totalCostUsd: 0, totalCostPen: 0 });
    setExchangeRate(null);
    setExchangeRateDate('');
    setSupplierLocked(false);
    setShowModal(true);
  };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { productId: '', quantity: 0 }] }));
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: string, value: any) => setForm(prev => { const items = [...prev.items]; items[idx] = { ...items[idx], [field]: value }; return { ...prev, items }; });

  const handleDateChange = (date: string) => {
    setForm(prev => ({ ...prev, purchaseDate: date }));
    if (date && currency === 'USD') {
      tipoCambioMutation.mutate(date, {
        onSuccess: (data) => { setExchangeRate(data.venta); setExchangeRateDate(data.fecha); },
        onError: () => { setExchangeRate(null); setExchangeRateDate(''); },
      });
    }
  };

  const handleCurrencyChange = (cur: 'PEN' | 'USD') => {
    setCurrency(cur);
    if (cur === 'USD' && form.purchaseDate) {
      tipoCambioMutation.mutate(form.purchaseDate, {
        onSuccess: (data) => { setExchangeRate(data.venta); setExchangeRateDate(data.fecha); },
        onError: () => { setExchangeRate(null); setExchangeRateDate(''); },
      });
    }
  };

  const totalSoles = currency === 'USD' && exchangeRate && form.totalCostUsd ? Math.round(form.totalCostUsd * exchangeRate * 100) / 100 : 0;

  const openQuickProduct = (idx: number) => {
    setNewProductForIdx(idx);
    setNewProduct({ name: '', categoryId: '', unit: 'unidad' });
    setShowNewProduct(true);
  };

  const handleCreateQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createProduct.mutateAsync({ name: newProduct.name, categoryId: newProduct.categoryId, unit: newProduct.unit, prices: [] });
      if (created && newProductForIdx >= 0) {
        updateItem(newProductForIdx, 'productId', created.id);
      }
      setShowNewProduct(false);
    } catch { /* error handled by hook */ }
  };

  const handleSupplierLookup = async () => {
    const ruc = form.supplierRuc.trim();
    if (ruc.length !== 11) { toast.error('El RUC debe tener 11 dígitos'); return; }

    setSupplierLoading(true);
    try {
      // First check local DB
      const localSupplier = await supplierByRuc.mutateAsync(ruc);
      if (localSupplier) {
        setForm(prev => ({ ...prev, supplier: localSupplier.businessName, supplierId: localSupplier.id }));
        setSupplierLocked(true);
        toast.success('Proveedor encontrado en el sistema');
        setSupplierLoading(false);
        return;
      }
    } catch {
      // Not found locally, continue to Decolecta
    }

    try {
      // Try Decolecta
      const result = await rucLookup.mutateAsync(ruc);
      if (result.razonSocial) {
        // Auto-create supplier in DB
        const newSupplier = await createSupplier.mutateAsync({
          ruc,
          businessName: result.razonSocial,
          address: result.direccion || '',
        });
        setForm(prev => ({ ...prev, supplier: result.razonSocial, supplierId: newSupplier?.id || '' }));
        setSupplierLocked(true);
        toast.success('Proveedor encontrado en SUNAT y registrado');
      }
    } catch {
      // Error already handled by hook toast
    } finally {
      setSupplierLoading(false);
    }
  };

  const clearSupplier = () => {
    setForm(prev => ({ ...prev, supplier: '', supplierId: '', supplierRuc: '' }));
    setSupplierLocked(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currency === 'USD' && (!exchangeRate || !form.totalCostUsd)) { toast.error('Ingrese el monto en USD y verifique el tipo de cambio'); return; }
    if (currency === 'PEN' && !form.totalCostPen) { toast.error('Ingrese el monto en soles'); return; }
    const validItems = form.items.filter(i => i.productId && i.quantity > 0);
    const payload: any = {
      companyId: form.companyId, supplier: form.supplier,
      paymentType: form.paymentType,
      date: form.purchaseDate,
    };
    if (validItems.length > 0) {
      payload.items = validItems.map(i => ({ productId: i.productId, quantity: i.quantity }));
    }
    if (currency === 'USD') {
      payload.totalCostUsd = form.totalCostUsd;
      payload.exchangeRate = exchangeRate;
      payload.exchangeRateDate = exchangeRateDate;
    } else {
      payload.totalCost = form.totalCostPen;
    }
    if (form.supplierId) payload.supplierId = form.supplierId;
    if (form.supplierRuc) payload.supplierRuc = form.supplierRuc;
    if (form.paymentType === 'CREDITO') {
      payload.paymentScheduleType = form.paymentScheduleType;
      if (form.paymentScheduleType === 'SINGLE_DATE') payload.dueDate = form.dueDate;
      if (form.paymentScheduleType === 'INSTALLMENTS') payload.installments = form.installments;
    }
    await createPurchase.mutateAsync(payload);
    setShowModal(false);
  };

  const companyList = Array.isArray(companies) ? companies : [];
  const products = productsData?.data || [];
  const purchases = data?.data || [];
  const total = data?.total || 0;

  const getCompanyName = (id: string) => companyList.find((c: Company) => c.id === id)?.name || 'N/A';

  const columns = [
    { key: 'date', header: 'Fecha', render: (item: Purchase) => new Date(item.date).toLocaleDateString('es-PE') },
    { key: 'companyId', header: 'Empresa', render: (item: Purchase) => getCompanyName(item.companyId) },
    { key: 'supplier', header: 'Proveedor' },
    { key: 'items', header: 'Items', render: (item: Purchase) => `${item.items.length} producto(s)` },
    { key: 'totalCost', header: 'Total', render: (item: Purchase) => (
      <div>
        <span>S/ {item.totalCost.toFixed(2)}</span>
        {item.totalCostUsd && <span className="block text-xs text-green-600">$ {item.totalCostUsd.toFixed(2)} USD</span>}
      </div>
    )},
    { key: 'paymentType', header: 'Tipo', render: (item: Purchase) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.paymentType === 'CREDITO' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
        {item.paymentType === 'CREDITO' ? 'Crédito' : 'Contado'}
      </span>
    )},
    { key: 'actions', header: '', render: (item: Purchase) => (
      <button onClick={(e) => { e.stopPropagation(); setViewingPurchase(item); }} className="text-green-600 hover:text-green-800 flex items-center gap-1 text-xs font-medium"><Eye size={15} /> Ver</button>
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><ShoppingCart size={24} /> Compras / Ingresos</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><Plus size={18} /> Nueva Compra</button>
      </div>
      <div className="mb-4">
        <select value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg">
          <option value="">Todas las empresas</option>
          {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name} - {c.ruc}</option>)}
        </select>
      </div>
      <DataTable columns={columns} data={purchases} isLoading={isLoading} hoverClass="hover:bg-green-50" />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Compra">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Empresa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
            <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">Seleccionar...</option>
              {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Proveedor con búsqueda RUC */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Proveedor</label>
            <div className="flex gap-2">
              <input
                value={form.supplierRuc}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 11); setForm({ ...form, supplierRuc: v }); if (supplierLocked) clearSupplier(); }}
                className="w-40 px-3 py-2 border rounded-lg text-sm"
                placeholder="RUC (11 dígitos)"
                maxLength={11}
              />
              <button
                type="button"
                onClick={handleSupplierLookup}
                disabled={form.supplierRuc.length !== 11 || supplierLoading}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
              >
                {supplierLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Buscar
              </button>
              <input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className={`flex-1 px-3 py-2 border rounded-lg text-sm ${supplierLocked ? 'bg-green-50 border-green-300' : ''}`}
                placeholder="Nombre del proveedor"
                readOnly={supplierLocked}
                required
              />
            </div>
            {supplierLocked && (
              <button type="button" onClick={clearSupplier} className="text-xs text-gray-500 hover:text-red-500">
                Limpiar proveedor y buscar otro
              </button>
            )}
          </div>

          {/* Fecha de compra + Moneda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de compra</label>
              <input type="date" value={form.purchaseDate} onChange={(e) => handleDateChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleCurrencyChange('PEN')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${currency === 'PEN' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>S/ Soles</button>
                <button type="button" onClick={() => handleCurrencyChange('USD')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${currency === 'USD' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>$ Dólares</button>
              </div>
            </div>
          </div>

          {/* Tipo de cambio (solo USD) */}
          {currency === 'USD' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-blue-700">Tipo de cambio (venta)</span>
              <div className="flex items-center gap-2">
                {tipoCambioMutation.isPending && <Loader2 size={14} className="animate-spin text-blue-500" />}
                {exchangeRate != null && !tipoCambioMutation.isPending && (
                  <span className="font-medium text-blue-800">S/ {exchangeRate.toFixed(4)}</span>
                )}
                {!exchangeRate && !tipoCambioMutation.isPending && (
                  <span className="text-gray-400">Sin datos</span>
                )}
              </div>
            </div>
          )}

          {/* Tipo de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Pago</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setForm({ ...form, paymentType: 'CONTADO', paymentScheduleType: 'SINGLE_DATE', dueDate: '', installments: [] })} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${form.paymentType === 'CONTADO' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>Contado</button>
              <button type="button" onClick={() => setForm({ ...form, paymentType: 'CREDITO' })} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${form.paymentType === 'CREDITO' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>Crédito</button>
            </div>
          </div>

          {/* Campos de crédito */}
          {form.paymentType === 'CREDITO' && (
            <div className="space-y-3 bg-orange-50 p-3 rounded-lg border border-orange-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setForm({ ...form, paymentScheduleType: 'SINGLE_DATE', installments: [] })} className={`flex-1 py-1.5 rounded text-xs font-medium border ${form.paymentScheduleType === 'SINGLE_DATE' ? 'border-orange-400 bg-white text-orange-700' : 'border-gray-200 text-gray-500'}`}>Fecha única</button>
                  <button type="button" onClick={() => setForm({ ...form, paymentScheduleType: 'INSTALLMENTS', dueDate: '' })} className={`flex-1 py-1.5 rounded text-xs font-medium border ${form.paymentScheduleType === 'INSTALLMENTS' ? 'border-orange-400 bg-white text-orange-700' : 'border-gray-200 text-gray-500'}`}>Cuotas</button>
                </div>
              </div>
              {form.paymentScheduleType === 'SINGLE_DATE' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha de vencimiento</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required />
                </div>
              )}
              {form.paymentScheduleType === 'INSTALLMENTS' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-500">Cuotas</label>
                    <button type="button" onClick={() => setForm({ ...form, installments: [...form.installments, { amount: 0, dueDate: '' }] })} className="text-xs text-orange-600 hover:text-orange-800 font-medium">+ Agregar cuota</button>
                  </div>
                  {form.installments.map((inst, idx) => (
                    <div key={idx} className="flex gap-2 mb-2 items-end">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Monto</label>
                        <input type="number" min="0.01" step="0.01" value={inst.amount || ''} onChange={(e) => { const installments = [...form.installments]; installments[idx] = { ...installments[idx], amount: parseFloat(e.target.value) || 0 }; const total = Math.round(installments.reduce((s, i) => s + i.amount, 0) * 100) / 100; if (currency === 'PEN') { setForm({ ...form, installments, totalCostPen: total }); } else { setForm({ ...form, installments, totalCostUsd: total }); } }} className="w-full px-2 py-1.5 border rounded text-sm" required />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                        <input type="date" value={inst.dueDate} onChange={(e) => { const installments = [...form.installments]; installments[idx] = { ...installments[idx], dueDate: e.target.value }; setForm({ ...form, installments }); }} className="w-full px-2 py-1.5 border rounded text-sm" required />
                      </div>
                      <button type="button" onClick={() => { const installments = form.installments.filter((_, i) => i !== idx); const total = Math.round(installments.reduce((s, i) => s + i.amount, 0) * 100) / 100; if (currency === 'PEN') { setForm({ ...form, installments, totalCostPen: total }); } else { setForm({ ...form, installments, totalCostUsd: total }); } }} className="text-red-400 hover:text-red-600 pb-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {form.installments.length === 0 && <p className="text-xs text-gray-400">Agrega al menos una cuota</p>}
                </div>
              )}
            </div>
          )}

          {/* Productos (opcional) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Productos <span className="text-xs text-gray-400 font-normal">(opcional)</span></label>
              <button type="button" onClick={addItem} className="text-sm text-green-600 hover:text-green-800 font-medium">+ Agregar producto</button>
            </div>
            {form.items.length === 0 && (
              <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3 text-center text-sm text-gray-400">
                Sin productos — solo se registrará el monto
              </div>
            )}
            <div className="space-y-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 relative">
                  <button type="button" onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Producto</label>
                      <div className="flex gap-1">
                        <div className="flex-1">
                          <SearchableSelect
                            options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
                            value={item.productId}
                            onChange={(v) => updateItem(idx, 'productId', v)}
                            placeholder="Buscar producto..."
                            minChars={1}
                          />
                        </div>
                        <button type="button" onClick={() => openQuickProduct(idx)} className="px-2 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 shrink-0" title="Crear nuevo producto">
                          <PackagePlus size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                      <input type="number" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monto Total */}
          {currency === 'PEN' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total (Soles)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">S/</span>
                <input
                  type="number" min="0.01" step="0.01"
                  value={form.totalCostPen || ''}
                  onChange={(e) => setForm({ ...form, totalCostPen: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          )}
          {currency === 'USD' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total (USD)</label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number" min="0.01" step="0.01"
                  value={form.totalCostUsd || ''}
                  onChange={(e) => setForm({ ...form, totalCostUsd: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          )}

          {/* Total */}
          {currency === 'PEN' && form.totalCostPen > 0 && (
            <div className="bg-green-50 p-3 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-green-800">Total de la compra</span>
              <span className="text-xl font-bold text-green-700">S/ {form.totalCostPen.toFixed(2)}</span>
            </div>
          )}
          {currency === 'USD' && (
            <div className="bg-blue-50 p-3 rounded-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Total USD</span>
                <span className="text-lg font-bold text-blue-700">$ {(form.totalCostUsd || 0).toFixed(2)}</span>
              </div>
              {exchangeRate != null && form.totalCostUsd > 0 && (
                <div className="flex items-center justify-between border-t border-blue-200 pt-1">
                  <span className="text-sm text-blue-600">Total en Soles (×{exchangeRate.toFixed(4)})</span>
                  <span className="text-xl font-bold text-green-700">S/ {totalSoles.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          <button type="submit" disabled={(currency === 'USD' ? (!exchangeRate || !form.totalCostUsd) : !form.totalCostPen) || createPurchase.isPending} className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {createPurchase.isPending ? 'Registrando...' : 'Registrar Compra'}
          </button>
        </form>
      </Modal>

      {/* Modal detalle de compra */}
      <Modal isOpen={!!viewingPurchase} onClose={() => setViewingPurchase(null)} title="Detalle de Compra">
        {viewingPurchase && (
          <div className="space-y-4">
            {/* Info general */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Fecha</span>
                <span className="text-sm font-medium">{new Date(viewingPurchase.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Empresa</span>
                <span className="text-sm font-medium">{getCompanyName(viewingPurchase.companyId)}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Proveedor</span>
                <span className="text-sm font-medium">{viewingPurchase.supplier}{viewingPurchase.supplierRuc ? ` (${viewingPurchase.supplierRuc})` : ''}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Tipo de Pago</span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${viewingPurchase.paymentType === 'CREDITO' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  {viewingPurchase.paymentType === 'CREDITO' ? 'Crédito' : 'Contado'}
                </span>
              </div>
            </div>

            {/* Productos */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Productos ({viewingPurchase.items.length})</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cant.</th>
                      {!viewingPurchase.totalCostUsd && (
                        <>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Costo unit.</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewingPurchase.items.map((item, idx) => {
                      const product = products.find((p: Product) => p.id === item.productId);
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium">{product?.name || item.productId}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          {!viewingPurchase.totalCostUsd && (
                            <>
                              <td className="px-3 py-2 text-right">S/ {(item.unitCost || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium">S/ {(item.quantity * (item.unitCost || 0)).toFixed(2)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total */}
            {viewingPurchase.totalCostUsd && viewingPurchase.exchangeRate && (
              <div className="bg-green-50 p-3 rounded-lg space-y-1 border border-green-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-700">Monto USD</span>
                  <span className="text-lg font-bold text-green-800">$ {viewingPurchase.totalCostUsd.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-green-600">
                  <span>Tipo de cambio (venta)</span>
                  <span>S/ {viewingPurchase.exchangeRate.toFixed(4)}</span>
                </div>
              </div>
            )}
            <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">Total en Soles</span>
              <span className="text-xl font-bold text-blue-700">S/ {viewingPurchase.totalCost.toFixed(2)}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal crear producto rápido */}
      <Modal isOpen={showNewProduct} onClose={() => setShowNewProduct(false)} title="Crear Producto Rápido">
        <form onSubmit={handleCreateQuickProduct} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del producto</label>
            <input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ej: Agrifo, Campal..." required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select value={newProduct.categoryId} onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">Seleccionar...</option>
              {categories.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
            <select value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="unidad">Unidad</option>
              <option value="kg">Kilogramo</option>
              <option value="litro">Litro</option>
              <option value="saco">Saco</option>
              <option value="caja">Caja</option>
            </select>
          </div>
          <button type="submit" disabled={createProduct.isPending} className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
            {createProduct.isPending ? 'Creando...' : 'Crear Producto'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

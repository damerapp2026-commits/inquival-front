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
import { Plus, ShoppingCart, Trash2, Eye, Search, Loader2, DollarSign, PackagePlus, FileText, CopyIcon, Dices } from 'lucide-react';
import type { Purchase, Company, Product, Category } from '../../../shared/types';
import toast from 'react-hot-toast';

const IGV_RATE = 0.18;

interface PurchaseFormItem {
  productId: string;
  quantity: number;
  lotNumber?: string;
  expirationDate?: string;
  unitPriceSinIgv: number;
  unitPriceConIgv: number;
  flete: number;
  otrosCostos: number;
  costoAdquisicion: number;
  markupPercent: number;
  precioVenta: number;
  precioVentaMode: 'markup' | 'direct';
}

const emptyItem = (): PurchaseFormItem => ({
  productId: '', quantity: 0, lotNumber: '', expirationDate: '',
  unitPriceSinIgv: 0, unitPriceConIgv: 0, flete: 0, otrosCostos: 0,
  costoAdquisicion: 0, markupPercent: 0, precioVenta: 0, precioVentaMode: 'markup',
});

function recalcItem(item: PurchaseFormItem): PurchaseFormItem {
  const unitPriceConIgv = Math.round(item.unitPriceSinIgv * (1 + IGV_RATE) * 100) / 100;
  const costoAdquisicion = Math.round((unitPriceConIgv + item.flete + item.otrosCostos) * 100) / 100;

  let precioVenta = item.precioVenta;
  let markupPercent = item.markupPercent;

  if (item.precioVentaMode === 'markup') {
    precioVenta = costoAdquisicion > 0
      ? Math.round(costoAdquisicion * (1 + markupPercent / 100) * 100) / 100
      : 0;
  } else {
    markupPercent = costoAdquisicion > 0
      ? Math.round(((precioVenta / costoAdquisicion) - 1) * 10000) / 100
      : 0;
  }

  return { ...item, unitPriceConIgv, costoAdquisicion, precioVenta, markupPercent };
}

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
    items: [emptyItem()] as PurchaseFormItem[],
    purchaseDate: new Date().toISOString().slice(0, 10),
    totalCostUsd: 0,
    totalCostPen: 0,
    documentType: 'FACTURA' as 'FACTURA' | 'BOLETA' | 'GUIA' | 'NOTA_CREDITO' | 'OTRO',
    documentSeries: '',
    documentNumber: '',
    issueDate: new Date().toISOString().slice(0, 10),
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
    setForm({ companyId: '', supplier: '', supplierRuc: '', supplierId: '', paymentType: 'CONTADO', paymentScheduleType: 'SINGLE_DATE', dueDate: '', installments: [], items: [emptyItem()], purchaseDate: today, totalCostUsd: 0, totalCostPen: 0, documentType: 'FACTURA', documentSeries: '', documentNumber: '', issueDate: today });
    setExchangeRate(null);
    setExchangeRateDate('');
    setSupplierLocked(false);
    setShowModal(true);
  };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));
  const repeatFromPrev = (idx: number, field: 'lotNumber' | 'expirationDate') => {
    if (idx === 0) return;
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: (items[idx - 1] as any)[field] || '' };
      return { ...prev, items };
    });
  };
  const autoGenLot = (idx: number) => {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], lotNumber: `L-${stamp}-${String(idx + 1).padStart(2, '0')}` };
      return { ...prev, items };
    });
  };
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: string, value: any) => setForm(prev => {
    const items = [...prev.items];
    let item = { ...items[idx], [field]: value };
    if (field === 'markupPercent') item.precioVentaMode = 'markup';
    if (field === 'precioVenta') item.precioVentaMode = 'direct';
    const costoFields = ['unitPriceSinIgv', 'flete', 'otrosCostos', 'markupPercent', 'precioVenta', 'productId'];
    if (costoFields.includes(field)) item = recalcItem(item);
    items[idx] = item;
    return { ...prev, items };
  });

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
    const missingLot = form.items.find(i => {
      const p = products.find((pr: Product) => pr.id === i.productId);
      return p?.tracksLot && !i.lotNumber;
    });
    if (missingLot) { toast.error('Hay productos que requieren número de lote'); return; }
    const payload: any = {
      companyId: form.companyId, supplier: form.supplier,
      items: form.items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitCost: i.costoAdquisicion,
        unitPriceSinIgv: i.unitPriceSinIgv,
        unitPriceConIgv: i.unitPriceConIgv,
        flete: i.flete || undefined,
        otrosCostos: i.otrosCostos || undefined,
        precioVenta: i.precioVenta || undefined,
        markupPercent: i.markupPercent || undefined,
        ...(i.lotNumber ? { lotNumber: i.lotNumber } : {}),
        ...(i.expirationDate ? { expirationDate: i.expirationDate } : {}),
      })),
      paymentType: form.paymentType,
      date: form.purchaseDate,
    };
    if (form.documentType) payload.documentType = form.documentType;
    if (form.documentSeries) payload.documentSeries = form.documentSeries;
    if (form.documentNumber) payload.documentNumber = form.documentNumber;
    if (form.issueDate) payload.issueDate = form.issueDate;
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
        {item.totalCostUsd && <span className="block text-xs text-primary-600">$ {item.totalCostUsd.toFixed(2)} USD</span>}
      </div>
    )},
    { key: 'paymentType', header: 'Tipo', render: (item: Purchase) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.paymentType === 'CREDITO' ? 'bg-orange-100 text-orange-700' : 'bg-primary-100 text-primary-700'}`}>
        {item.paymentType === 'CREDITO' ? 'Crédito' : 'Contado'}
      </span>
    )},
    { key: 'actions', header: '', render: (item: Purchase) => (
      <button onClick={(e) => { e.stopPropagation(); setViewingPurchase(item); }} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium"><Eye size={15} /> Ver</button>
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><ShoppingCart size={24} /> Compras / Ingresos</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={18} /> Nueva Compra</button>
      </div>
      <div className="mb-4">
        <select value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg">
          <option value="">Todas las empresas</option>
          {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name} - {c.ruc}</option>)}
        </select>
      </div>
      <DataTable columns={columns} data={purchases} isLoading={isLoading} hoverClass="hover:bg-primary-50" />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Compra" size="2xl">
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
                className={`flex-1 px-3 py-2 border rounded-lg text-sm ${supplierLocked ? 'bg-primary-50 border-primary-300' : ''}`}
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

          {/* Comprobante */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><FileText size={15} /> Comprobante de pago</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value as any })} className="w-full px-2 py-1.5 border rounded text-sm bg-white">
                  <option value="FACTURA">Factura</option>
                  <option value="BOLETA">Boleta</option>
                  <option value="GUIA">Guía</option>
                  <option value="NOTA_CREDITO">Nota Crédito</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Serie</label>
                <input value={form.documentSeries} onChange={(e) => setForm({ ...form, documentSeries: e.target.value.toUpperCase() })} placeholder="F001" className="w-full px-2 py-1.5 border rounded text-sm bg-white uppercase" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Número</label>
                <input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} placeholder="00012345" className="w-full px-2 py-1.5 border rounded text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">F. Emisión</label>
                <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">F. Recepción</label>
                <input type="date" value={form.purchaseDate} onChange={(e) => handleDateChange(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm bg-white" required />
              </div>
            </div>
          </div>

          {/* Moneda */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleCurrencyChange('PEN')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${currency === 'PEN' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>S/ Soles</button>
              <button type="button" onClick={() => handleCurrencyChange('USD')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${currency === 'USD' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>$ Dólares</button>
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
              <button type="button" onClick={() => setForm({ ...form, paymentType: 'CONTADO', paymentScheduleType: 'SINGLE_DATE', dueDate: '', installments: [] })} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${form.paymentType === 'CONTADO' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>Contado</button>
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
                        <input type="number" min="0.01" step="0.01" value={inst.amount || ''} onChange={(e) => { const installments = [...form.installments]; installments[idx] = { ...installments[idx], amount: parseFloat(e.target.value) || 0 }; setForm({ ...form, installments }); }} className="w-full px-2 py-1.5 border rounded text-sm" required />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                        <input type="date" value={inst.dueDate} onChange={(e) => { const installments = [...form.installments]; installments[idx] = { ...installments[idx], dueDate: e.target.value }; setForm({ ...form, installments }); }} className="w-full px-2 py-1.5 border rounded text-sm" required />
                      </div>
                      <button type="button" onClick={() => setForm({ ...form, installments: form.installments.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600 pb-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {form.installments.length === 0 && <p className="text-xs text-gray-400">Agrega al menos una cuota</p>}
                </div>
              )}
            </div>
          )}

          {/* Productos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Productos</label>
              <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:text-primary-800 font-medium">+ Agregar producto</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => {
                const product = products.find((p: Product) => p.id === item.productId);
                const needsLot = product?.tracksLot;
                return (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3 relative">
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    )}
                    {/* Fila 1: Producto, Cantidad, Lote, Vence */}
                    <div className="grid grid-cols-12 gap-2 items-end pr-6">
                      <div className="col-span-12 sm:col-span-5">
                        <label className="block text-xs text-gray-500 mb-1">Producto</label>
                        <div className="flex gap-1">
                          <div className="flex-1">
                            <SearchableSelect
                              options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
                              value={item.productId}
                              onChange={(v) => updateItem(idx, 'productId', v)}
                              placeholder="Buscar producto..."
                              minChars={1}
                              required
                            />
                          </div>
                          <button type="button" onClick={() => openQuickProduct(idx)} className="px-2 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 shrink-0" title="Crear nuevo producto">
                            <PackagePlus size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                        <input type="number" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" required />
                      </div>
                      <div className="col-span-8 sm:col-span-3">
                        <label className="block text-xs text-gray-500 mb-1 flex items-center justify-between">
                          <span>Lote {needsLot && <span className="text-red-500">*</span>}</span>
                          <span className="flex gap-1">
                            {idx > 0 && <button type="button" onClick={() => repeatFromPrev(idx, 'lotNumber')} className="text-gray-400 hover:text-primary-600" title="Copiar del anterior"><CopyIcon size={11} /></button>}
                            <button type="button" onClick={() => autoGenLot(idx)} className="text-gray-400 hover:text-primary-600" title="Generar lote"><Dices size={11} /></button>
                          </span>
                        </label>
                        <input value={item.lotNumber || ''} onChange={(e) => updateItem(idx, 'lotNumber', e.target.value)} placeholder={needsLot ? 'L-20260415-01' : 'Opcional'} className={`w-full px-2 py-1.5 border rounded text-sm ${needsLot && !item.lotNumber ? 'border-red-300 bg-red-50' : product && !needsLot ? 'bg-gray-100 text-gray-500' : ''}`} />
                      </div>
                      <div className="col-span-12 sm:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1 flex items-center justify-between">
                          <span>Vence</span>
                          {idx > 0 && <button type="button" onClick={() => repeatFromPrev(idx, 'expirationDate')} className="text-gray-400 hover:text-primary-600" title="Copiar del anterior"><CopyIcon size={11} /></button>}
                        </label>
                        <input type="date" value={item.expirationDate || ''} onChange={(e) => updateItem(idx, 'expirationDate', e.target.value)} className={`w-full px-2 py-1.5 border rounded text-sm ${product && !needsLot ? 'bg-gray-100 text-gray-500' : ''}`} />
                      </div>
                    </div>
                    {/* Fila 2: Desglose de costos */}
                    <div className="grid grid-cols-12 gap-1.5 items-end mt-2 pt-2 border-t border-gray-200 pr-6">
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">P.U. sin IGV</label>
                        <input type="number" min="0" step="0.01" value={item.unitPriceSinIgv || ''} onChange={(e) => updateItem(idx, 'unitPriceSinIgv', parseFloat(e.target.value) || 0)} className="w-full px-1.5 py-1 border rounded text-xs" placeholder="0.00" />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">PC + IGV</label>
                        <input type="text" readOnly value={item.unitPriceConIgv ? item.unitPriceConIgv.toFixed(2) : '0.00'} className="w-full px-1.5 py-1 border border-green-200 rounded text-xs bg-green-50 text-green-800 font-medium" />
                      </div>
                      <div className="col-span-4 sm:col-span-1">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Flete</label>
                        <input type="number" min="0" step="0.01" value={item.flete || ''} onChange={(e) => updateItem(idx, 'flete', parseFloat(e.target.value) || 0)} className="w-full px-1.5 py-1 border rounded text-xs" placeholder="0" />
                      </div>
                      <div className="col-span-4 sm:col-span-1">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Otros</label>
                        <input type="number" min="0" step="0.01" value={item.otrosCostos || ''} onChange={(e) => updateItem(idx, 'otrosCostos', parseFloat(e.target.value) || 0)} className="w-full px-1.5 py-1 border rounded text-xs" placeholder="0" />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">C. Adquisición</label>
                        <input type="text" readOnly value={item.costoAdquisicion ? item.costoAdquisicion.toFixed(2) : '0.00'} className="w-full px-1.5 py-1 border border-green-200 rounded text-xs bg-green-50 text-green-800 font-semibold" />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">% Margen</label>
                        <input type="number" min="0" step="0.1" value={item.markupPercent || ''} onChange={(e) => updateItem(idx, 'markupPercent', parseFloat(e.target.value) || 0)} className={`w-full px-1.5 py-1 border rounded text-xs ${item.precioVentaMode === 'direct' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`} placeholder="30" />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">P. Venta</label>
                        <input type="number" min="0" step="0.01" value={item.precioVenta || ''} onChange={(e) => updateItem(idx, 'precioVenta', parseFloat(e.target.value) || 0)} className={`w-full px-1.5 py-1 border rounded text-xs ${item.precioVentaMode === 'markup' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`} placeholder="0.00" />
                      </div>
                    </div>
                    {/* Subtotal por item */}
                    {item.quantity > 0 && item.costoAdquisicion > 0 && (
                      <div className="mt-1.5 text-right pr-6">
                        <span className="text-[10px] text-gray-500">Subtotal: </span>
                        <span className="text-xs font-semibold text-gray-700">{currency === 'USD' ? '$' : 'S/'} {(item.quantity * item.costoAdquisicion).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
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
            <div className="bg-primary-50 p-3 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-primary-800">Total de la compra</span>
              <span className="text-xl font-bold text-primary-700">S/ {form.totalCostPen.toFixed(2)}</span>
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
                  <span className="text-xl font-bold text-primary-700">S/ {totalSoles.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          <button type="submit" disabled={(currency === 'USD' ? (!exchangeRate || !form.totalCostUsd) : !form.totalCostPen) || createPurchase.isPending} className="w-full py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {createPurchase.isPending ? 'Registrando...' : 'Registrar Compra'}
          </button>
        </form>
      </Modal>

      {/* Modal detalle de compra */}
      <Modal isOpen={!!viewingPurchase} onClose={() => setViewingPurchase(null)} title="Detalle de Compra" size="2xl">
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
              {viewingPurchase.documentType && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="block text-xs text-gray-500">Comprobante</span>
                  <span className="text-sm font-medium">{viewingPurchase.documentType} {viewingPurchase.documentSeries || ''}{viewingPurchase.documentNumber ? `-${viewingPurchase.documentNumber}` : ''}</span>
                  {viewingPurchase.issueDate && <span className="block text-xs text-gray-500">Emisión: {new Date(viewingPurchase.issueDate).toLocaleDateString('es-PE')}</span>}
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Tipo de Pago</span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${viewingPurchase.paymentType === 'CREDITO' ? 'bg-orange-100 text-orange-700' : 'bg-primary-100 text-primary-700'}`}>
                  {viewingPurchase.paymentType === 'CREDITO' ? 'Crédito' : 'Contado'}
                </span>
              </div>
            </div>

            {/* Productos */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Productos ({viewingPurchase.items.length})</h3>
              <div className="border rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cant.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Lote</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vence</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">P.U. s/IGV</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">PC+IGV</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Flete</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Otros</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">C. Adq.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">P. Venta</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewingPurchase.items.map((item, idx) => {
                      const product = products.find((p: Product) => p.id === item.productId);
                      const sym = viewingPurchase.totalCostUsd ? '$' : 'S/';
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium">{product?.name || item.productId}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-gray-600">{item.lotNumber || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('es-PE') : '—'}</td>
                          <td className="px-3 py-2 text-right">{item.unitPriceSinIgv ? `${sym} ${item.unitPriceSinIgv.toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 text-right">{item.unitPriceConIgv ? `${sym} ${item.unitPriceConIgv.toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 text-right">{item.flete ? `${sym} ${item.flete.toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 text-right">{item.otrosCostos ? `${sym} ${item.otrosCostos.toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 text-right font-medium text-green-700">{sym} {(item.unitCost || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{item.precioVenta ? `${sym} ${item.precioVenta.toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 text-right font-medium">{sym} {(item.quantity * (item.unitCost || 0)).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total */}
            {viewingPurchase.totalCostUsd && viewingPurchase.exchangeRate && (
              <div className="bg-primary-50 p-3 rounded-lg space-y-1 border border-primary-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-primary-700">Monto USD</span>
                  <span className="text-lg font-bold text-primary-800">$ {viewingPurchase.totalCostUsd.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-primary-600">
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

import React, { useState } from 'react';
import { usePurchases, useCreatePurchase } from '../hooks/usePurchases';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { Plus, ShoppingCart, Trash2, Eye } from 'lucide-react';
import type { Purchase, Company, Product } from '../../../shared/types';

export function PurchasesPage() {
  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);

  const { data, isLoading } = usePurchases({ page, limit: 20, companyId: companyFilter || undefined });
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 200 });
  const createPurchase = useCreatePurchase();

  const [form, setForm] = useState({
    companyId: '', supplier: '', paymentType: 'CONTADO' as 'CONTADO' | 'CREDITO',
    paymentScheduleType: 'SINGLE_DATE' as 'SINGLE_DATE' | 'INSTALLMENTS', dueDate: '',
    installments: [] as { amount: number; dueDate: string }[],
    items: [{ productId: '', quantity: 0, unitCost: 0 }] as { productId: string; quantity: number; unitCost: number }[],
  });

  const openCreate = () => { setForm({ companyId: '', supplier: '', paymentType: 'CONTADO', paymentScheduleType: 'SINGLE_DATE', dueDate: '', installments: [], items: [{ productId: '', quantity: 0, unitCost: 0 }] }); setShowModal(true); };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { productId: '', quantity: 0, unitCost: 0 }] }));
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: string, value: any) => setForm(prev => { const items = [...prev.items]; items[idx] = { ...items[idx], [field]: value }; return { ...prev, items }; });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { companyId: form.companyId, supplier: form.supplier, items: form.items, paymentType: form.paymentType };
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
    { key: 'totalCost', header: 'Total', render: (item: Purchase) => `S/ ${item.totalCost.toFixed(2)}` },
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
          {/* Empresa y Proveedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
              <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required>
                <option value="">Seleccionar...</option>
                {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Nombre del proveedor" required />
            </div>
          </div>

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
              <button type="button" onClick={addItem} className="text-sm text-green-600 hover:text-green-800 font-medium">+ Agregar producto</button>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {form.items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 relative">
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  )}
                  <div className="mb-2">
                    <label className="block text-xs text-gray-500 mb-1">Producto</label>
                    <SearchableSelect
                      options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
                      value={item.productId}
                      onChange={(v) => updateItem(idx, 'productId', v)}
                      placeholder="Buscar producto..."
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                      <input type="number" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Costo unit.</label>
                      <input type="number" min="0.01" step="0.01" value={item.unitCost || ''} onChange={(e) => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Subtotal</label>
                      <div className="px-2 py-1.5 bg-white border rounded text-sm font-medium text-gray-700">S/ {(item.quantity * item.unitCost).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total y Submit */}
          <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">Total de la compra</span>
            <span className="text-xl font-bold text-blue-700">S/ {form.items.reduce((s, i) => s + i.quantity * i.unitCost, 0).toFixed(2)}</span>
          </div>
          <button type="submit" className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Registrar Compra</button>
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
                <span className="text-sm font-medium">{viewingPurchase.supplier}</span>
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
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Costo unit.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewingPurchase.items.map((item, idx) => {
                      const product = products.find((p: Product) => p.id === item.productId);
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium">{product?.name || item.productId}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">S/ {item.unitCost.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-medium">S/ {(item.quantity * item.unitCost).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total */}
            <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">Total</span>
              <span className="text-xl font-bold text-blue-700">S/ {viewingPurchase.totalCost.toFixed(2)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

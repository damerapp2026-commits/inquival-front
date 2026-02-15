import React, { useState } from 'react';
import { usePurchases, useCreatePurchase } from '../hooks/usePurchases';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { Plus, ShoppingCart, Trash2 } from 'lucide-react';
import type { Purchase, Company, Product } from '../../../shared/types';

export function PurchasesPage() {
  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = usePurchases({ page, limit: 20, companyId: companyFilter || undefined });
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 200 });
  const createPurchase = useCreatePurchase();

  const [form, setForm] = useState({ companyId: '', supplier: '', items: [{ productId: '', quantity: 0, unitCost: 0 }] as { productId: string; quantity: number; unitCost: number }[] });

  const openCreate = () => { setForm({ companyId: '', supplier: '', items: [{ productId: '', quantity: 0, unitCost: 0 }] }); setShowModal(true); };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { productId: '', quantity: 0, unitCost: 0 }] }));
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: string, value: any) => setForm(prev => { const items = [...prev.items]; items[idx] = { ...items[idx], [field]: value }; return { ...prev, items }; });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalCost = form.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    await createPurchase.mutateAsync({ ...form, totalCost });
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
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><ShoppingCart size={24} /> Compras / Ingresos</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><Plus size={18} /> Nueva Compra</button>
      </div>
      <div className="mb-4">
        <select value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg">
          <option value="">Todas las empresas</option>
          {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name} - {c.ruc}</option>)}
        </select>
      </div>
      <DataTable columns={columns} data={purchases} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Compra">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
              <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                <option value="">Seleccionar...</option>
                {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label><input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-gray-700">Items</label><button type="button" onClick={addItem} className="text-sm text-green-600 hover:text-green-800">+ Agregar item</button></div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm" required>
                    <option value="">Producto...</option>
                    {products.map((p: Product) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" placeholder="Cant." min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-sm" required />
                  <input type="number" placeholder="Costo" min="0.01" step="0.01" value={item.unitCost || ''} onChange={(e) => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)} className="w-24 px-2 py-1 border rounded text-sm" required />
                  {form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-red-500"><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm font-medium text-gray-700">Total: S/ {form.items.reduce((s, i) => s + i.quantity * i.unitCost, 0).toFixed(2)}</div>
          </div>
          <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Registrar Compra</button>
        </form>
      </Modal>
    </div>
  );
}

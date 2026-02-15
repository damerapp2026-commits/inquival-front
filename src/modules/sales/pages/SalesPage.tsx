import React, { useState } from 'react';
import { useSales, useCreateSale } from '../hooks/useSales';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { useClients } from '../../clients/hooks/useClients';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import type { Sale, Company, Product, ProductPrice, Client, PriceTier } from '../../../shared/types';

export function SalesPage() {
  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useSales({ page, limit: 20, companyId: companyFilter || undefined });
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 200 });
  const { data: clientsData } = useClients({ limit: 200 });
  const { data: priceTiers } = usePriceTiers();
  const createSale = useCreateSale();

  const [form, setForm] = useState({ companyId: '', clientId: '', items: [{ productId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0 }] as { productId: string; quantity: number; priceTier: string; unitPrice: number; subtotal: number }[] });

  const openCreate = () => { setForm({ companyId: '', clientId: '', items: [{ productId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0 }] }); setShowModal(true); };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { productId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0 }] }));
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const updateItem = (idx: number, field: string, value: any) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'productId' && items[idx].priceTier) {
        const product = products.find((p: Product) => p.id === value);
        const tier = tiers.find((t: PriceTier) => t.id === items[idx].priceTier);
        const priceEntry = product?.prices?.find((p: ProductPrice) => p.priceTierId === tier?.id);
        if (priceEntry) items[idx].unitPrice = priceEntry.price;
      }
      if (field === 'priceTier' && items[idx].productId) {
        const product = products.find((p: Product) => p.id === items[idx].productId);
        const priceEntry = product?.prices?.find((p: ProductPrice) => p.priceTierId === value);
        if (priceEntry) items[idx].unitPrice = priceEntry.price;
      }
      items[idx].subtotal = items[idx].quantity * items[idx].unitPrice;
      return { ...prev, items };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = form.items.reduce((sum, item) => sum + item.subtotal, 0);
    await createSale.mutateAsync({ ...form, total });
    setShowModal(false);
  };

  const companyList = Array.isArray(companies) ? companies : [];
  const products = productsData?.data || [];
  const clients = clientsData?.data || [];
  const tiers = Array.isArray(priceTiers) ? priceTiers : [];
  const sales = data?.data || [];
  const total = data?.total || 0;

  const getCompanyName = (id: string) => companyList.find((c: Company) => c.id === id)?.name || 'N/A';
  const getClientName = (id?: string) => id ? clients.find((c: Client) => c.id === id)?.name || 'N/A' : 'Sin cliente';

  const columns = [
    { key: 'date', header: 'Fecha', render: (item: Sale) => new Date(item.date).toLocaleDateString('es-PE') },
    { key: 'companyId', header: 'Empresa', render: (item: Sale) => getCompanyName(item.companyId) },
    { key: 'clientId', header: 'Cliente', render: (item: Sale) => getClientName(item.clientId) },
    { key: 'items', header: 'Items', render: (item: Sale) => `${item.items.length} producto(s)` },
    { key: 'total', header: 'Total', render: (item: Sale) => `S/ ${item.total.toFixed(2)}` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Receipt size={24} /> Ventas</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><Plus size={18} /> Nueva Venta</button>
      </div>
      <div className="mb-4">
        <select value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg">
          <option value="">Todas las empresas</option>
          {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name} - {c.ruc}</option>)}
        </select>
      </div>
      <DataTable columns={columns} data={sales} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Venta">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
              <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                <option value="">Seleccionar...</option>
                {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Cliente (opcional)</label>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Sin cliente</option>
                {clients.map((c: Client) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
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
                  <select value={item.priceTier} onChange={(e) => updateItem(idx, 'priceTier', e.target.value)} className="w-28 px-2 py-1 border rounded text-sm" required>
                    <option value="">Rango...</option>
                    {tiers.map((t: PriceTier) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input type="number" placeholder="Cant." min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-sm" required />
                  <input type="number" placeholder="Precio" min="0.01" step="0.01" value={item.unitPrice || ''} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-24 px-2 py-1 border rounded text-sm" required />
                  <span className="text-xs text-gray-500 w-20 text-right">S/ {item.subtotal.toFixed(2)}</span>
                  {form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-red-500"><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm font-bold text-gray-700">Total: S/ {form.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2)}</div>
          </div>
          <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Registrar Venta</button>
        </form>
      </Modal>
    </div>
  );
}

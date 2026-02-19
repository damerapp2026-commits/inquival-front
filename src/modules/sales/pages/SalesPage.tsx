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

  const [form, setForm] = useState({
    clientId: '',
    hasBoleta: false,
    paymentMethod: 'CASH' as 'CASH' | 'CREDIT',
    items: [{ productId: '', companyId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0 }],
  });

  const openCreate = () => {
    setForm({ clientId: '', hasBoleta: false, paymentMethod: 'CASH', items: [{ productId: '', companyId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0 }] });
    setShowModal(true);
  };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { productId: '', companyId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0 }] }));
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const updateItem = (idx: number, field: string, value: any) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'productId' && items[idx].priceTier) {
        const product = products.find((p: Product) => p.id === value);
        const priceEntry = product?.prices?.find((p: ProductPrice) => p.priceTierId === items[idx].priceTier);
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

  const getCompanyName = (id?: string) => id ? companyList.find((c: Company) => c.id === id)?.name || 'N/A' : 'Mixta';
  const getClientName = (id?: string) => id ? clients.find((c: Client) => c.id === id)?.name || 'N/A' : 'Sin cliente';

  const columns = [
    { key: 'date', header: 'Fecha', render: (item: Sale) => new Date(item.date).toLocaleDateString('es-PE') },
    { key: 'companyId', header: 'Empresa', render: (item: Sale) => {
      const companyIds = [...new Set(item.items.map(i => i.companyId))];
      if (companyIds.length === 1) return getCompanyName(companyIds[0]);
      return <span className="text-purple-600 font-medium">Mixta</span>;
    }},
    { key: 'clientId', header: 'Cliente', render: (item: Sale) => getClientName(item.clientId) },
    { key: 'items', header: 'Items', render: (item: Sale) => `${item.items.length} producto(s)` },
    { key: 'total', header: 'Total', render: (item: Sale) => `S/ ${item.total.toFixed(2)}` },
    { key: 'hasBoleta', header: 'Boleta', render: (item: Sale) => item.hasBoleta ? <span className="text-green-600 font-medium">Si</span> : <span className="text-gray-400">No</span> },
    { key: 'paymentMethod', header: 'Pago', render: (item: Sale) => item.paymentMethod === 'CREDIT' ? <span className="text-orange-600 font-medium">Credito</span> : <span className="text-green-600">Efectivo</span> },
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente {form.paymentMethod === 'CREDIT' ? '(obligatorio)' : '(opcional)'}</label>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required={form.paymentMethod === 'CREDIT'}>
                <option value="">Sin cliente</option>
                {clients.map((c: Client) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.hasBoleta} onChange={(e) => setForm({ ...form, hasBoleta: e.target.checked })} className="w-4 h-4 text-green-600 rounded" />
                <span className="text-sm font-medium text-gray-700">Boleta</span>
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="paymentMethod" value="CASH" checked={form.paymentMethod === 'CASH'} onChange={() => setForm({ ...form, paymentMethod: 'CASH' })} className="text-green-600" />
                  <span className="text-sm">Efectivo</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="paymentMethod" value="CREDIT" checked={form.paymentMethod === 'CREDIT'} onChange={() => setForm({ ...form, paymentMethod: 'CREDIT' })} className="text-green-600" />
                  <span className="text-sm">Credito</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-gray-700">Items</label><button type="button" onClick={addItem} className="text-sm text-green-600 hover:text-green-800">+ Agregar item</button></div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select value={item.companyId} onChange={(e) => updateItem(idx, 'companyId', e.target.value)} className="w-28 px-2 py-1 border rounded text-sm" required>
                    <option value="">Empresa...</option>
                    {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
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

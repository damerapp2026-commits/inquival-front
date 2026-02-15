import React, { useState } from 'react';
import { useStock, useStockAlerts, useTransferStock } from '../hooks/useStock';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { Package, ArrowRightLeft, AlertTriangle, Trash2 } from 'lucide-react';
import type { Stock, Company, Product } from '../../../shared/types';

export function StockPage() {
  const [page, setPage] = useState(1);
  const [companyId, setCompanyId] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 200 });
  const { data, isLoading } = useStock(companyId, { page, limit: 20 });
  const { data: alerts } = useStockAlerts(companyId, 10);
  const transferStock = useTransferStock();

  const [transferForm, setTransferForm] = useState({ fromCompanyId: '', toCompanyId: '', items: [{ productId: '', quantity: 0 }] as { productId: string; quantity: number }[] });

  const companyList = Array.isArray(companies) ? companies : [];
  const products = productsData?.data || [];
  const stockItems = data?.data || [];
  const total = data?.total || 0;
  const alertList = Array.isArray(alerts) ? alerts : [];

  const getProductName = (id: string) => products.find((p: Product) => p.id === id)?.name || 'N/A';
  const getCompanyName = (id: string) => companyList.find((c: Company) => c.id === id)?.name || 'N/A';

  const openTransfer = () => { setTransferForm({ fromCompanyId: companyId || '', toCompanyId: '', items: [{ productId: '', quantity: 0 }] }); setShowTransfer(true); };

  const addTransferItem = () => setTransferForm(prev => ({ ...prev, items: [...prev.items, { productId: '', quantity: 0 }] }));
  const removeTransferItem = (idx: number) => setTransferForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateTransferItem = (idx: number, field: string, value: any) => setTransferForm(prev => { const items = [...prev.items]; items[idx] = { ...items[idx], [field]: value }; return { ...prev, items }; });

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    await transferStock.mutateAsync(transferForm);
    setShowTransfer(false);
  };

  // Auto-select first company
  React.useEffect(() => {
    if (!companyId && companyList.length > 0) setCompanyId(companyList[0].id);
  }, [companyList, companyId]);

  const columns = [
    { key: 'productId', header: 'Producto', render: (item: Stock) => getProductName(item.productId) },
    { key: 'quantity', header: 'Cantidad', render: (item: Stock) => (
      <span className={item.quantity <= 10 ? 'text-red-600 font-bold' : ''}>{item.quantity}</span>
    )},
    { key: 'lastUpdated', header: 'Última actualización', render: (item: Stock) => new Date(item.lastUpdated).toLocaleDateString('es-PE') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Package size={24} /> Stock</h1>
        <button onClick={openTransfer} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><ArrowRightLeft size={18} /> Transferir Stock</button>
      </div>

      {alertList.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800 font-medium mb-1"><AlertTriangle size={16} /> Stock bajo ({alertList.length} productos)</div>
          <div className="text-sm text-yellow-700">{alertList.map((a: Stock) => `${getProductName(a.productId)}: ${a.quantity}`).join(' | ')}</div>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {companyList.map((c: Company) => (
          <button key={c.id} onClick={() => { setCompanyId(c.id); setPage(1); }} className={`px-4 py-2 rounded-lg font-medium ${companyId === c.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {c.name}
          </button>
        ))}
      </div>
      <DataTable columns={columns} data={stockItems} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      <Modal isOpen={showTransfer} onClose={() => setShowTransfer(false)} title="Transferir Stock entre Empresas">
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <select value={transferForm.fromCompanyId} onChange={(e) => setTransferForm({ ...transferForm, fromCompanyId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                <option value="">Seleccionar...</option>
                {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Hacia</label>
              <select value={transferForm.toCompanyId} onChange={(e) => setTransferForm({ ...transferForm, toCompanyId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                <option value="">Seleccionar...</option>
                {companyList.filter((c: Company) => c.id !== transferForm.fromCompanyId).map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-gray-700">Productos</label><button type="button" onClick={addTransferItem} className="text-sm text-green-600 hover:text-green-800">+ Agregar</button></div>
            <div className="space-y-2">
              {transferForm.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select value={item.productId} onChange={(e) => updateTransferItem(idx, 'productId', e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm" required>
                    <option value="">Producto...</option>
                    {products.map((p: Product) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" placeholder="Cantidad" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateTransferItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-28 px-2 py-1 border rounded text-sm" required />
                  {transferForm.items.length > 1 && <button type="button" onClick={() => removeTransferItem(idx)} className="text-red-500"><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Realizar Transferencia</button>
        </form>
      </Modal>
    </div>
  );
}

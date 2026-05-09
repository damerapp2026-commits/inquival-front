import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePurchases } from '../hooks/usePurchases';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { Plus, ShoppingCart, Eye, Search } from 'lucide-react';
import type { Purchase } from '../../../shared/types';

export function PurchasesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [laboratoryFilter, setLaboratoryFilter] = useState('');
  const [labSearch, setLabSearch] = useState('');

  const { data, isLoading } = usePurchases({ page, limit: 20, laboratoryId: laboratoryFilter || undefined });
  const { data: laboratories } = useLaboratories();

  const labList = Array.isArray(laboratories) ? laboratories : [];
  const purchases = data?.data || [];
  const total = data?.total || 0;

  const filteredLabs = useMemo(() => {
    const term = labSearch.trim().toLowerCase();
    const active = labList.filter((l: any) => l.isActive !== false);
    if (!term) return active;
    return active.filter((l: any) => l.name?.toLowerCase().includes(term));
  }, [labList, labSearch]);

  const columns = [
    { key: 'date', header: 'Fecha', render: (item: Purchase) => new Date(item.date).toLocaleDateString('es-PE') },
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
      <button onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${item.id}`); }} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium"><Eye size={15} /> Ver</button>
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><ShoppingCart size={24} /> Compras / Ingresos</h1>
        <Link to="/purchases/new" className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={18} /> Nueva Compra</Link>
      </div>
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar laboratorio..."
            value={labSearch}
            onChange={(e) => setLabSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={laboratoryFilter}
          onChange={(e) => { setLaboratoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg bg-white"
        >
          <option value="">Todos los laboratorios</option>
          {filteredLabs.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <DataTable columns={columns} data={purchases} isLoading={isLoading} hoverClass="hover:bg-primary-50" />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
    </div>
  );
}

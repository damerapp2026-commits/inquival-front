import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePurchases } from '../hooks/usePurchases';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { Plus, ShoppingCart, Eye } from 'lucide-react';
import type { Purchase, Company } from '../../../shared/types';

export function PurchasesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState('');

  const { data, isLoading } = usePurchases({ page, limit: 20, companyId: companyFilter || undefined });
  const { data: companies } = useCompanies();

  const companyList = Array.isArray(companies) ? companies : [];
  const purchases = data?.data || [];
  const total = data?.total || 0;

  const getCompanyName = (id: string) => companyList.find((c: Company) => c.id === id)?.name || 'N/A';

  const columns = [
    { key: 'date', header: 'Fecha', render: (item: Purchase) => new Date(item.date).toLocaleDateString('es-PE') },
    { key: 'companyId', header: 'Almacén', render: (item: Purchase) => getCompanyName(item.companyId) },
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
      <div className="mb-4">
        <select value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg">
          <option value="">Todos los almacenes</option>
          {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}{c.ruc ? ` — ${c.ruc}` : ''}</option>)}
        </select>
      </div>
      <DataTable columns={columns} data={purchases} isLoading={isLoading} hoverClass="hover:bg-primary-50" />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePurchases } from '../hooks/usePurchases';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { Plus, ShoppingCart, Eye, Wrench } from 'lucide-react';
import type { Purchase } from '../../../shared/types';
import { formatDateEs } from '../../../shared/utils/date.util';

export function PurchasesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [laboratoryFilter, setLaboratoryFilter] = useState('');

  const { data, isLoading } = usePurchases({ page, limit: 20, laboratoryId: laboratoryFilter || undefined });
  const { data: laboratories } = useLaboratories();

  const labList = Array.isArray(laboratories) ? laboratories : [];
  const purchases = data?.data || [];
  const total = data?.total || 0;

  const labOptions = useMemo(
    () => labList
      .filter((l: any) => l.isActive !== false)
      .map((l: any) => ({ value: l.id, label: l.name })),
    [labList],
  );

  const columns = [
    { key: 'date', header: 'Fecha', render: (item: Purchase) => formatDateEs(item.date) },
    { key: 'supplier', header: 'Proveedor' },
    { key: 'items', header: 'Items', render: (item: Purchase) => `${item.items.length} producto(s)` },
    { key: 'totalCost', header: 'Total', render: (item: Purchase) => {
      const isUsd = !!item.totalCostUsd;
      return (
        <div>
          {isUsd ? (
            <>
              <span className="font-medium">$ {item.totalCostUsd!.toFixed(2)} USD</span>
              <span className="block text-xs text-gray-500">≈ S/ {item.totalCost.toFixed(2)}{item.exchangeRate ? ` · TC ${item.exchangeRate.toFixed(4)}` : ''}</span>
            </>
          ) : (
            <span className="font-medium">S/ {item.totalCost.toFixed(2)} PEN</span>
          )}
        </div>
      );
    }},
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
        <div className="flex items-center gap-2">
          <Link
            to="/cash-register/migrate?tab=purchases"
            className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100"
            title="Reasignar compras a la caja correcta según su fecha"
          >
            <Wrench size={14} /> Migrar fechas
          </Link>
          <Link to="/purchases/new" className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={18} /> Nueva Compra</Link>
        </div>
      </div>
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 max-w-md">
          <SearchableSelect
            options={labOptions}
            value={laboratoryFilter}
            onChange={(v) => { setLaboratoryFilter(v); setPage(1); }}
            placeholder="Buscar laboratorio... (todos)"
            minChars={1}
            className="py-2"
          />
        </div>
      </div>
      <DataTable columns={columns} data={purchases} isLoading={isLoading} hoverClass="hover:bg-primary-50" />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
    </div>
  );
}

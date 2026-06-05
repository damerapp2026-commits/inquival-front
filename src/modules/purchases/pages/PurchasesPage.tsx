import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePurchases } from '../hooks/usePurchases';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { Plus, ShoppingCart, Eye, Wrench, Search, X } from 'lucide-react';
import type { Purchase } from '../../../shared/types';
import { formatDateEs } from '../../../shared/utils/date.util';

const DATE_PRESETS = [
  {
    id: 'mes',
    label: 'Este mes',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    },
  },
  {
    id: 'trimestre',
    label: 'Trimestre',
    getRange: () => {
      const now = new Date();
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    },
  },
  {
    id: 'año',
    label: 'Este año',
    getRange: () => {
      const now = new Date();
      return { start: `${now.getFullYear()}-01-01`, end: now.toISOString().split('T')[0] };
    },
  },
] as const;

export function PurchasesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSupplier, setDebouncedSupplier] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState('');

  const { data, isLoading } = usePurchases({
    page,
    limit: 20,
    supplier: debouncedSupplier || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const purchases = data?.data || [];
  const total = data?.total || 0;
  const totalPen: number = (data as any)?.totalPen ?? 0;
  const totalUsd: number = (data as any)?.totalUsd ?? 0;

  const handleSupplierChange = (val: string) => {
    setSupplierSearch(val);
    clearTimeout((handleSupplierChange as any)._t);
    (handleSupplierChange as any)._t = setTimeout(() => { setDebouncedSupplier(val); setPage(1); }, 400);
  };

  const applyPreset = (preset: typeof DATE_PRESETS[number]) => {
    const { start, end } = preset.getRange();
    setStartDate(start);
    setEndDate(end);
    setActivePreset(preset.id);
    setPage(1);
  };

  const clearDates = () => {
    setStartDate('');
    setEndDate('');
    setActivePreset('');
    setPage(1);
  };

  const handleCustomDate = (field: 'start' | 'end', val: string) => {
    if (field === 'start') setStartDate(val);
    else setEndDate(val);
    setActivePreset('custom');
    setPage(1);
  };

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
      <div className="mb-4 flex flex-col gap-3">
        {/* Búsqueda por proveedor */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={supplierSearch}
            onChange={(e) => handleSupplierChange(e.target.value)}
            placeholder="Buscar por proveedor..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Filtros de fecha */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Presets rápidos */}
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activePreset === preset.id
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-400 hover:text-primary-700'
              }`}
            >
              {preset.label}
            </button>
          ))}

          <span className="text-gray-200 select-none">|</span>

          {/* Rango personalizado */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Desde</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleCustomDate('start', e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
            <span className="text-xs text-gray-500">Hasta</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleCustomDate('end', e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          {/* Limpiar */}
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={clearDates}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              title="Quitar filtro de fecha"
            >
              <X size={13} /> Limpiar
            </button>
          )}
        </div>
      </div>
      {/* Resumen de totales */}
      {!isLoading && total > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
          <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">
            {total} compra{total !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">·</span>
          <span className="font-semibold text-gray-800">
            S/ {totalPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {totalUsd > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="font-semibold text-blue-700">
                $ {totalUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </>
          )}
        </div>
      )}

      <DataTable columns={columns} data={purchases} isLoading={isLoading} hoverClass="hover:bg-primary-50" />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
    </div>
  );
}

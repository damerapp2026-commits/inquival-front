import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpDown, Download, Package, Search, TrendingUp } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Pagination } from '../../../shared/components/Pagination';
import { useProfitability } from '../hooks/useDashboard';

type ProfitabilityRow = {
  productId: string;
  productName: string;
  totalSold: number;
  totalRevenue: number;
  avgUnitPrice: number;
  unitCost: number | null;
  totalCost: number | null;
  grossProfit: number | null;
  marginPercent: number | null;
};

type SortOption = 'profit-desc' | 'revenue-desc' | 'quantity-desc' | 'margin-desc' | 'name-asc';

const PAGE_SIZE = 20;

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentMonthRange() {
  const now = new Date();
  return {
    start: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toInputDate(now),
  };
}

function validInputDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function numberOrZero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAmount(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQuantity(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function ProfitabilityDetailPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const monthRange = currentMonthRange();
  const startDate = validInputDate(searchParams.get('start')) ? searchParams.get('start')! : monthRange.start;
  const endDate = validInputDate(searchParams.get('end')) ? searchParams.get('end')! : monthRange.end;
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('profit-desc');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useProfitability(startDate, endDate);

  const rows = useMemo<ProfitabilityRow[]>(() => {
    if (!Array.isArray(data)) return [];
    return data.map((raw: any) => ({
      productId: String(raw?.productId || ''),
      productName: String(raw?.productName || 'Producto eliminado'),
      totalSold: numberOrZero(raw?.totalSold),
      totalRevenue: numberOrZero(raw?.totalRevenue),
      avgUnitPrice: numberOrZero(raw?.avgUnitPrice),
      unitCost: nullableNumber(raw?.unitCost),
      totalCost: nullableNumber(raw?.totalCost),
      grossProfit: nullableNumber(raw?.grossProfit),
      marginPercent: nullableNumber(raw?.marginPercent),
    }));
  }, [data]);

  const totals = useMemo(() => {
    const rowsWithCost = rows.filter((row) => row.totalCost != null);
    const totalRevenue = rows.reduce((sum, row) => sum + row.totalRevenue, 0);
    const revenueWithCost = rowsWithCost.reduce((sum, row) => sum + row.totalRevenue, 0);
    const totalCost = rowsWithCost.reduce((sum, row) => sum + (row.totalCost || 0), 0);
    const grossProfit = revenueWithCost - totalCost;
    const marginPercent = revenueWithCost > 0 ? (grossProfit / revenueWithCost) * 100 : 0;
    return {
      totalRevenue,
      totalCost,
      grossProfit,
      marginPercent,
      missingCostCount: rows.length - rowsWithCost.length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-PE');
    const filtered = term
      ? rows.filter((row) => row.productName.toLocaleLowerCase('es-PE').includes(term))
      : [...rows];

    return filtered.sort((a, b) => {
      if (sortBy === 'name-asc') return a.productName.localeCompare(b.productName, 'es-PE');
      if (sortBy === 'revenue-desc') return b.totalRevenue - a.totalRevenue;
      if (sortBy === 'quantity-desc') return b.totalSold - a.totalSold;
      if (sortBy === 'margin-desc') return (b.marginPercent ?? Number.NEGATIVE_INFINITY) - (a.marginPercent ?? Number.NEGATIVE_INFINITY);
      return (b.grossProfit ?? Number.NEGATIVE_INFINITY) - (a.grossProfit ?? Number.NEGATIVE_INFINITY);
    });
  }, [rows, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateDate = (field: 'start' | 'end', value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(field, value);
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const resetToCurrentMonth = () => {
    setSearchParams({ start: monthRange.start, end: monthRange.end }, { replace: true });
    setPage(1);
  };

  const exportExcel = async () => {
    if (filteredRows.length === 0) {
      toast.error('No hay productos para exportar');
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const exportRows = filteredRows.map((row) => ({
        Producto: row.productName,
        'Cantidad vendida': row.totalSold,
        'Ingresos (S/)': Math.round(row.totalRevenue * 100) / 100,
        'Precio promedio (S/)': Math.round(row.avgUnitPrice * 100) / 100,
        'Costo unitario (S/)': row.unitCost == null ? 'Sin costo' : Math.round(row.unitCost * 100) / 100,
        'Costo total (S/)': row.totalCost == null ? 'Sin costo' : Math.round(row.totalCost * 100) / 100,
        'Ganancia bruta (S/)': row.grossProfit == null ? 'Sin costo' : Math.round(row.grossProfit * 100) / 100,
        'Margen bruto (%)': row.marginPercent == null ? 'Sin costo' : Math.round(row.marginPercent * 100) / 100,
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rentabilidad');
      XLSX.writeFile(workbook, `rentabilidad_${startDate}_a_${endDate}.xlsx`);
      toast.success(`${filteredRows.length} producto(s) exportado(s)`);
    } catch {
      toast.error('No se pudo exportar el reporte');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-1 rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50"
            aria-label="Volver al dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <TrendingUp size={25} className="text-emerald-600" />
              Rentabilidad por producto
            </h1>
            <p className="mt-1 text-sm text-gray-500">Detalle de todos los productos vendidos durante el periodo seleccionado</p>
          </div>
        </div>

        <button
          type="button"
          onClick={exportExcel}
          disabled={isLoading || filteredRows.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={17} /> Exportar Excel
        </button>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Desde</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => updateDate('start', event.target.value)}
              className="block rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal normal-case text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
          <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Hasta</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={toInputDate(new Date())}
              onChange={(event) => updateDate('end', event.target.value)}
              className="block rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal normal-case text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
          <button type="button" onClick={resetToCurrentMonth} className="mb-2 text-xs font-semibold text-primary-600 hover:underline">
            Este mes
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-800">
        <span className="font-semibold">Importante:</span> los ingresos representan ventas registradas, incluidas las ventas al contado y a crédito; no necesariamente dinero ya cobrado. La ganancia bruta se calcula como ingresos menos costo de producto y no descuenta gastos operativos.
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Ingresos de todos los productos" value={`S/ ${formatAmount(totals.totalRevenue)}`} color="text-blue-700" />
        <SummaryCard label="Costo de todos los productos" value={`S/ ${formatAmount(totals.totalCost)}`} color="text-orange-600" />
        <SummaryCard label="Ganancia bruta total" value={`S/ ${formatAmount(totals.grossProfit)}`} color={totals.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'} />
        <SummaryCard label="Margen bruto total" value={`${totals.marginPercent.toFixed(1)}%`} color={totals.marginPercent >= 0 ? 'text-emerald-700' : 'text-red-600'} />
      </div>

      {totals.missingCostCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Hay {totals.missingCostCount} producto(s) sin costo registrado. La ganancia y el margen consideran únicamente los productos que tienen costo disponible.
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <Package size={19} className="text-primary-600" /> Todos los productos del periodo
            </h2>
            <p className="mt-1 text-xs text-gray-400">{filteredRows.length} de {rows.length} producto(s)</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Buscar producto..."
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-64"
              />
            </label>
            <label className="relative">
              <ArrowUpDown size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={sortBy}
                onChange={(event) => { setSortBy(event.target.value as SortOption); setPage(1); }}
                className="w-full appearance-none rounded-lg border border-gray-200 py-2 pl-9 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-auto"
              >
                <option value="profit-desc">Mayor ganancia</option>
                <option value="revenue-desc">Mayores ingresos</option>
                <option value="quantity-desc">Mayor cantidad vendida</option>
                <option value="margin-desc">Mayor margen</option>
                <option value="name-asc">Nombre A–Z</option>
              </select>
            </label>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-400">Calculando rentabilidad...</div>
        ) : isError ? (
          <div className="flex h-64 items-center justify-center text-sm text-red-500">No se pudo cargar el reporte de rentabilidad</div>
        ) : pageRows.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-400">No se encontraron productos en el periodo</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="min-w-[240px] px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-right">Cantidad</th>
                    <th className="px-4 py-3 text-right">Ingresos</th>
                    <th className="px-4 py-3 text-right">Costo unitario</th>
                    <th className="px-4 py-3 text-right">Costo total</th>
                    <th className="px-4 py-3 text-right">Ganancia bruta</th>
                    <th className="px-4 py-3 text-right">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageRows.map((row, index) => (
                    <tr key={row.productId || `${row.productName}-${index}`} className="hover:bg-gray-50/70">
                      <td className="px-4 py-3 text-gray-400">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.productName}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatQuantity(row.totalSold)}</td>
                      <td className="px-4 py-3 text-right font-medium text-blue-700">S/ {formatAmount(row.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{row.unitCost == null ? <MissingCost /> : `S/ ${formatAmount(row.unitCost)}`}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{row.totalCost == null ? <MissingCost /> : `S/ ${formatAmount(row.totalCost)}`}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${row.grossProfit == null ? '' : row.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {row.grossProfit == null ? <MissingCost /> : `S/ ${formatAmount(row.grossProfit)}`}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${row.marginPercent == null ? '' : row.marginPercent >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {row.marginPercent == null ? <MissingCost /> : `${row.marginPercent.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 px-5 pb-5">
              <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function MissingCost() {
  return <span className="whitespace-nowrap text-xs font-medium text-amber-600">Sin costo</span>;
}

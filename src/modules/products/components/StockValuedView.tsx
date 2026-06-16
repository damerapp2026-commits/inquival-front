import { useMemo, useState } from 'react';
import { Download, Loader2, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useProducts } from '../hooks/useProducts';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';
import { useStockByProductSummary } from '../../stock/hooks/useStock';
import type { Product } from '../../../shared/types';

interface StockValuedViewProps {
  enabled: boolean;
}

interface StockValuedRow {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number | null;
  currency: string;
  total: number | null;
  laboratoryId?: string;
  laboratoryName: string;
}

const formatCost = (value: number) => value.toFixed(4).replace(/\.?0+$/, '');
const moneySymbol = (currency?: string) => currency === 'USD' ? '$' : 'S/';

export function StockValuedView({ enabled }: StockValuedViewProps) {
  const { data: productsData, isLoading: productsLoading, isFetching: productsFetching } = useProducts(
    enabled ? { page: 1, limit: 10000 } : undefined,
  );
  const { data: stockSummaryData, isLoading: stockLoading, isFetching: stockFetching } = useStockByProductSummary();
  const { data: laboratoriesData } = useLaboratories();

  const [search, setSearch] = useState('');
  const [laboratoryId, setLaboratoryId] = useState('');

  const products: Product[] = (productsData as any)?.data || (Array.isArray(productsData) ? productsData : []) || [];
  const laboratories: any[] = Array.isArray(laboratoriesData) ? laboratoriesData : [];
  const labsById = useMemo(
    () => new Map(laboratories.map((lab: any) => [lab.id, lab])),
    [laboratories],
  );
  const stockByProduct = useMemo(
    () => new Map((stockSummaryData || []).map((s: any) => [s.productId, s])),
    [stockSummaryData],
  );

  const rows: StockValuedRow[] = useMemo(() => {
    return products
      .map((product) => {
        const stock = stockByProduct.get(product.id) as any;
        const quantity = Number(stock?.totalQuantity || 0);
        const unitCost = typeof product.lastCostPrice === 'number' && product.lastCostPrice > 0
          ? product.lastCostPrice
          : null;
        const currency = product.lastCostCurrency || 'PEN';
        const lab = product.laboratoryId ? labsById.get(product.laboratoryId) as any : null;
        return {
          productId: product.id,
          productName: product.name,
          quantity,
          unitCost,
          currency,
          total: unitCost == null ? null : Math.round(quantity * unitCost * 100) / 100,
          laboratoryId: product.laboratoryId,
          laboratoryName: lab?.name || 'Sin laboratorio',
        };
      })
      .filter((row) => row.quantity > 0)
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }, [labsById, products, stockByProduct]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (laboratoryId && row.laboratoryId !== laboratoryId) return false;
      if (!term) return true;
      return (
        row.productName.toLowerCase().includes(term) ||
        row.laboratoryName.toLowerCase().includes(term)
      );
    });
  }, [laboratoryId, rows, search]);

  const totalsByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of filteredRows) {
      if (row.total == null) continue;
      totals.set(row.currency, Math.round(((totals.get(row.currency) || 0) + row.total) * 100) / 100);
    }
    return Array.from(totals.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRows]);

  const missingCostCount = filteredRows.filter((row) => row.unitCost == null).length;
  const isLoading = productsLoading || stockLoading;
  const isFetching = productsFetching || stockFetching;

  const exportXlsx = () => {
    const data = [
      ['INVENTARIO VALORIZADO INVERSIONES QUIVAL SAC'],
      [],
      ['PRODUCTO', 'CANTIDAD', 'MONEDA', 'P.U. COSTO', 'TOTAL', 'LABORATORIO'],
      ...filteredRows.map((row) => [
        row.productName,
        row.quantity,
        row.currency,
        row.unitCost ?? '',
        row.total ?? '',
        row.laboratoryName === 'Sin laboratorio' ? '' : row.laboratoryName,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock valorizado');
    XLSX.writeFile(wb, `stock_valorizado_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="Buscar producto o laboratorio..."
            />
          </div>
          <select
            value={laboratoryId}
            onChange={(e) => setLaboratoryId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">Todos los laboratorios</option>
            {laboratories.filter((lab: any) => lab.isActive !== false).map((lab: any) => (
              <option key={lab.id} value={lab.id}>{lab.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={exportXlsx}
          disabled={filteredRows.length === 0}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} /> Exportar Excel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Productos con stock</div>
          <div className="text-xl font-bold text-gray-800 tabular-nums">{filteredRows.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Sin costo</div>
          <div className="text-xl font-bold text-amber-600 tabular-nums">{missingCostCount}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Valor total</div>
          <div className="text-sm font-bold text-primary-700 tabular-nums mt-1">
            {totalsByCurrency.length === 0 ? '—' : totalsByCurrency.map(([currency, total]) => (
              <span key={currency} className="mr-3 whitespace-nowrap">{moneySymbol(currency)} {total.toFixed(2)}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Inventario valorizado</h2>
            <p className="text-xs text-gray-500">Cantidad actual multiplicada por el último costo registrado.</p>
          </div>
          {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold min-w-[260px]">Producto</th>
                <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                <th className="px-4 py-3 text-right font-semibold">P.U. costo</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-left font-semibold min-w-[180px]">Laboratorio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    <Loader2 size={18} className="animate-spin inline-block mr-2" /> Cargando stock valorizado...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">No hay productos con stock para mostrar.</td>
                </tr>
              ) : filteredRows.map((row) => {
                const sym = moneySymbol(row.currency);
                return (
                  <tr key={row.productId} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.productName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.unitCost == null ? <span className="text-gray-300">—</span> : <span>{sym} {formatCost(row.unitCost)}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-800">
                      {row.total == null ? <span className="text-gray-300">—</span> : <span>{sym} {row.total.toFixed(2)}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.laboratoryName === 'Sin laboratorio' ? <span className="text-gray-300">—</span> : row.laboratoryName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

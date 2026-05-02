import { useMemo, useState } from 'react';
import { Search, Loader2, FileSpreadsheet, X } from 'lucide-react';
import { usePriceCatalog } from '../../purchases/hooks/usePurchases';
import { useCategories } from '../../categories/hooks/useCategories';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';

interface PriceCatalogRow {
  productId: string;
  productName: string;
  categoryId?: string;
  categoryName?: string;
  laboratoryId?: string;
  laboratoryName?: string;
  activeIngredient?: string;
  unit?: string;
  taxType?: string;
  supplierId?: string;
  supplierName: string;
  supplierRuc?: string;
  lastPurchaseDate?: string;
  currency: 'PEN' | 'USD';
  exchangeRate?: number;
  unitPriceSinIgvUsd?: number;
  unitPriceSinIgvPen?: number;
  unitPriceConIgvUsd?: number;
  unitPriceConIgvPen?: number;
  unitCost?: number;
  precioVenta?: number;
  precioMinorista?: number;
  precioEspecial?: number;
  markupPercent?: number;
  documentSeries?: string;
  documentNumber?: string;
}

interface Props {
  enabled: boolean;
}

const fmt = (n?: number) => (n != null ? n.toFixed(2) : '—');
const fmtDate = (d?: string) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' });
};

export function PriceCatalogView({ enabled }: Props) {
  const { data, isLoading, isFetching } = usePriceCatalog({ enabled });
  const { data: categoriesData } = useCategories();
  const { data: laboratoriesData } = useLaboratories();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [laboratoryId, setLaboratoryId] = useState('');

  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData as any)?.data || [];
  const laboratories = Array.isArray(laboratoriesData) ? laboratoriesData : [];

  const rows: PriceCatalogRow[] = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryId && r.categoryId !== categoryId) return false;
      if (laboratoryId && r.laboratoryId !== laboratoryId) return false;
      if (!term) return true;
      return (
        r.productName?.toLowerCase().includes(term) ||
        r.activeIngredient?.toLowerCase().includes(term) ||
        r.supplierName?.toLowerCase().includes(term)
      );
    });
  }, [rows, search, categoryId, laboratoryId]);

  const clearFilters = () => { setSearch(''); setCategoryId(''); setLaboratoryId(''); };
  const hasActiveFilters = !!(search || categoryId || laboratoryId);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por producto, ingrediente activo o proveedor…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
            />
          </div>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={laboratoryId}
            onChange={(e) => setLaboratoryId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">Todos los laboratorios</option>
            {laboratories.filter((l: any) => l.isActive).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600"
            >
              <X size={12} /> Limpiar
            </button>
          )}
          <div className="ml-auto text-xs text-gray-500 flex items-center gap-2">
            {(isLoading || isFetching) && <Loader2 size={14} className="animate-spin" />}
            <span>{filtered.length} de {rows.length} registros</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-700">Catálogo de precios por proveedor</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium">Producto</th>
                <th className="text-left px-3 py-2 font-medium">Categoría</th>
                <th className="text-left px-3 py-2 font-medium">Ing. activo</th>
                <th className="text-left px-3 py-2 font-medium">Laboratorio</th>
                <th className="text-left px-3 py-2 font-medium">Proveedor</th>
                <th className="text-right px-2 py-2 font-medium bg-amber-100 text-amber-800">USD s/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-stone-100 text-stone-700">PEN s/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-amber-100 text-amber-800">USD c/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-stone-100 text-stone-700">PEN c/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-cyan-100 text-cyan-800">P. Mayorista</th>
                <th className="text-right px-2 py-2 font-medium bg-cyan-100 text-cyan-800">P. Minorista</th>
                <th className="text-right px-2 py-2 font-medium bg-orange-100 text-orange-800">Margen %</th>
                <th className="text-right px-3 py-2 font-medium">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 size={20} className="animate-spin inline" /> Cargando catálogo…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-gray-400">
                    {rows.length === 0
                      ? 'Aún no hay compras registradas para alimentar el catálogo.'
                      : 'Ningún registro coincide con los filtros.'}
                  </td>
                </tr>
              )}
              {filtered.map((r, idx) => (
                <tr key={`${r.productId}-${r.supplierId || 'none'}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.productName}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.categoryName || '—'}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.activeIngredient || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.laboratoryName ? (
                      <span className="text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                        {r.laboratoryName}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-gray-800">{r.supplierName}</div>
                    {r.supplierRuc && <div className="text-[10px] text-gray-400">RUC {r.supplierRuc}</div>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums bg-amber-50 text-amber-900">{fmt(r.unitPriceSinIgvUsd)}</td>
                  <td className="px-2 py-2 text-right tabular-nums bg-stone-50 text-stone-800">{fmt(r.unitPriceSinIgvPen)}</td>
                  <td className="px-2 py-2 text-right tabular-nums bg-amber-50 text-amber-900">{fmt(r.unitPriceConIgvUsd)}</td>
                  <td className="px-2 py-2 text-right tabular-nums bg-stone-50 text-stone-800">{fmt(r.unitPriceConIgvPen)}</td>
                  <td className="px-2 py-2 text-right tabular-nums bg-cyan-50 text-cyan-900">{fmt(r.precioMinorista)}</td>
                  <td className="px-2 py-2 text-right tabular-nums bg-cyan-50 text-cyan-900">{fmt(r.precioVenta)}</td>
                  <td className="px-2 py-2 text-right tabular-nums bg-orange-50 text-orange-900 font-medium">
                    {r.markupPercent != null ? `${r.markupPercent.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                    <div>{fmtDate(r.lastPurchaseDate)}</div>
                    {r.documentSeries && r.documentNumber && (
                      <div className="text-[10px] text-gray-400">{r.documentSeries}-{r.documentNumber}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 flex flex-wrap gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" /> Precio USD</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-stone-100 border border-stone-200" /> Precio PEN</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-cyan-100 border border-cyan-200" /> Precio de venta</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-orange-100 border border-orange-200" /> Margen</span>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Search, Loader2, FileSpreadsheet, X, Check, AlertTriangle, DollarSign } from 'lucide-react';
import { usePriceCatalog, useUpdatePriceCatalog } from '../../purchases/hooks/usePurchases';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';
import { useTodayTipoCambio } from '../../../shared/hooks/useLookup';
import type { Product } from '../../../shared/types';

const IGV_RATE = 0.18;
const r2 = (n: number) => Math.round(n * 100) / 100;
const appliesIgv = (taxType?: string) => !taxType || taxType === 'GRAVADO';

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

interface MergedRow {
  productId: string;
  productName: string;
  laboratoryId?: string;
  laboratoryName?: string;
  categoryId?: string;
  activeIngredient?: string;
  taxType?: string;
  unitPriceSinIgvUsd?: number;
  unitPriceSinIgvPen?: number;
  unitPriceConIgvUsd?: number;
  unitPriceConIgvPen?: number;
  precioMinorista?: number;
  markupPercent?: number;
  lastPurchaseDate?: string;
  documentSeries?: string;
  documentNumber?: string;
  hasPurchase: boolean;
}

interface Props {
  enabled: boolean;
}

type EditableField =
  | 'unitPriceSinIgvUsd'
  | 'unitPriceSinIgvPen'
  | 'unitPriceConIgvUsd'
  | 'unitPriceConIgvPen'
  | 'precioMinorista'
  | 'markupPercent';

const fmt = (n?: number) => (n != null ? n.toFixed(2) : '');
const fmtDate = (d?: string) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' });
};

export function PriceCatalogView({ enabled }: Props) {
  const { data: catalogData, isLoading: catalogLoading, isFetching: catalogFetching } = usePriceCatalog({ enabled });
  const { data: productsData, isLoading: productsLoading, isFetching: productsFetching } = useProducts(
    enabled ? { page: 1, limit: 1000 } : undefined,
  );
  const { data: categoriesData } = useCategories();
  const { data: laboratoriesData } = useLaboratories();
  const { data: tipoCambioData, isLoading: tcLoading } = useTodayTipoCambio(enabled);
  const tc = tipoCambioData?.venta ?? null;
  const updatePriceCatalog = useUpdatePriceCatalog();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [laboratoryId, setLaboratoryId] = useState('');
  const [edits, setEdits] = useState<Record<string, Partial<Record<EditableField, string>>>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

  const categories: any[] = Array.isArray(categoriesData) ? categoriesData : (categoriesData as any)?.data || [];
  const laboratories: any[] = Array.isArray(laboratoriesData) ? laboratoriesData : [];
  const products: Product[] = (productsData as any)?.data || (Array.isArray(productsData) ? productsData : []) || [];
  const catalogRows: PriceCatalogRow[] = Array.isArray(catalogData) ? catalogData : [];

  const catalogByProduct = useMemo(() => {
    const map = new Map<string, PriceCatalogRow>();
    for (const row of catalogRows) {
      const existing = map.get(row.productId);
      if (!existing) {
        map.set(row.productId, row);
        continue;
      }
      const a = row.lastPurchaseDate ? new Date(row.lastPurchaseDate).getTime() : 0;
      const b = existing.lastPurchaseDate ? new Date(existing.lastPurchaseDate).getTime() : 0;
      if (a > b) map.set(row.productId, row);
    }
    return map;
  }, [catalogRows]);

  const labsById = useMemo(
    () => new Map(laboratories.map((l: any) => [l.id, l])),
    [laboratories],
  );

  const merged: MergedRow[] = useMemo(() => {
    return products.map((p) => {
      const row = catalogByProduct.get(p.id);
      const labName = p.laboratoryId ? (labsById.get(p.laboratoryId) as any)?.name : undefined;
      return {
        productId: p.id,
        productName: p.name,
        laboratoryId: p.laboratoryId,
        laboratoryName: labName ?? row?.laboratoryName,
        categoryId: p.categoryId,
        activeIngredient: p.activeIngredient,
        taxType: (p as any).taxType ?? row?.taxType,
        unitPriceSinIgvUsd: row?.unitPriceSinIgvUsd,
        unitPriceSinIgvPen: row?.unitPriceSinIgvPen,
        unitPriceConIgvUsd: row?.unitPriceConIgvUsd,
        unitPriceConIgvPen: row?.unitPriceConIgvPen,
        precioMinorista: row?.precioMinorista,
        markupPercent: row?.markupPercent,
        lastPurchaseDate: row?.lastPurchaseDate,
        documentSeries: row?.documentSeries,
        documentNumber: row?.documentNumber,
        hasPurchase: !!row,
      };
    });
  }, [products, catalogByProduct, labsById]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return merged.filter((r) => {
      if (categoryId && r.categoryId !== categoryId) return false;
      if (laboratoryId && (r.laboratoryId || '') !== laboratoryId) return false;
      if (!term) return true;
      return (
        r.productName?.toLowerCase().includes(term) ||
        r.activeIngredient?.toLowerCase().includes(term)
      );
    });
  }, [merged, search, categoryId, laboratoryId]);

  const clearFilters = () => { setSearch(''); setCategoryId(''); setLaboratoryId(''); };
  const hasActiveFilters = !!(search || categoryId || laboratoryId);

  const isLoading = catalogLoading || productsLoading;
  const isFetching = catalogFetching || productsFetching;

  const getInputValue = (row: MergedRow, field: EditableField): string => {
    const edited = edits[row.productId]?.[field];
    if (edited !== undefined) return edited;
    return fmt(row[field] as number | undefined);
  };

  const computeDerivedFromUsdSinIgv = (usdSinIgv: number, taxType?: string): {
    unitPriceSinIgvPen: number;
    unitPriceConIgvUsd: number;
    unitPriceConIgvPen: number;
  } | null => {
    if (!tc || !Number.isFinite(usdSinIgv) || usdSinIgv < 0) return null;
    const igvFactor = appliesIgv(taxType) ? 1 + IGV_RATE : 1;
    const unitPriceSinIgvPen = r2(usdSinIgv * tc);
    const unitPriceConIgvUsd = r2(usdSinIgv * igvFactor);
    const unitPriceConIgvPen = r2(usdSinIgv * igvFactor * tc);
    return { unitPriceSinIgvPen, unitPriceConIgvUsd, unitPriceConIgvPen };
  };

  const handleChange = (productId: string, field: EditableField, value: string) => {
    setEdits((prev) => {
      const current = prev[productId] || {};
      const next: Partial<Record<EditableField, string>> = { ...current, [field]: value };

      if (field === 'unitPriceSinIgvUsd') {
        const row = merged.find((r) => r.productId === productId);
        const trimmed = value.trim();
        const num = parseFloat(trimmed);
        if (trimmed === '' || !Number.isFinite(num) || num < 0 || !tc) {
          delete next.unitPriceSinIgvPen;
          delete next.unitPriceConIgvUsd;
          delete next.unitPriceConIgvPen;
        } else {
          const derived = computeDerivedFromUsdSinIgv(num, row?.taxType);
          if (derived) {
            next.unitPriceSinIgvPen = derived.unitPriceSinIgvPen.toFixed(2);
            next.unitPriceConIgvUsd = derived.unitPriceConIgvUsd.toFixed(2);
            next.unitPriceConIgvPen = derived.unitPriceConIgvPen.toFixed(2);
          }
        }
      }

      return { ...prev, [productId]: next };
    });
  };

  const clearEdit = (productId: string, field: EditableField) => {
    setEdits((prev) => {
      const productEdits = prev[productId];
      if (!productEdits) return prev;
      const { [field]: _omit, ...rest } = productEdits;
      const next = { ...prev };
      if (Object.keys(rest).length === 0) delete next[productId];
      else next[productId] = rest;
      return next;
    });
  };

  const flashSaved = (productId: string) => {
    setSavedIds((s) => new Set(s).add(productId));
    setTimeout(() => {
      setSavedIds((s) => {
        const n = new Set(s);
        n.delete(productId);
        return n;
      });
    }, 1500);
  };

  const handleBlur = async (row: MergedRow, field: EditableField) => {
    const editedValue = edits[row.productId]?.[field];
    if (editedValue === undefined) return;

    const trimmed = editedValue.trim();
    if (trimmed === '') {
      clearEdit(row.productId, field);
      return;
    }
    const num = parseFloat(trimmed);
    if (!Number.isFinite(num) || num < 0) {
      clearEdit(row.productId, field);
      return;
    }

    const stored = row[field] as number | undefined;
    if (stored != null && Math.abs(stored - num) < 1e-6 && field !== 'unitPriceSinIgvUsd') {
      clearEdit(row.productId, field);
      return;
    }

    let payload: Record<string, number> = { [field]: num };
    let fieldsToClear: EditableField[] = [field];

    if (field === 'unitPriceSinIgvUsd' && tc) {
      const derived = computeDerivedFromUsdSinIgv(num, row.taxType);
      if (derived) {
        payload = {
          unitPriceSinIgvUsd: num,
          unitPriceSinIgvPen: derived.unitPriceSinIgvPen,
          unitPriceConIgvUsd: derived.unitPriceConIgvUsd,
          unitPriceConIgvPen: derived.unitPriceConIgvPen,
        };
        fieldsToClear = [
          'unitPriceSinIgvUsd',
          'unitPriceSinIgvPen',
          'unitPriceConIgvUsd',
          'unitPriceConIgvPen',
        ];
      }
    }

    setSavingIds((s) => new Set(s).add(row.productId));
    setErrorIds((s) => {
      const n = new Set(s);
      n.delete(row.productId);
      return n;
    });
    try {
      await updatePriceCatalog.mutateAsync({
        productId: row.productId,
        data: payload,
      });
      fieldsToClear.forEach((f) => clearEdit(row.productId, f));
      flashSaved(row.productId);
    } catch {
      setErrorIds((s) => new Set(s).add(row.productId));
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(row.productId);
        return n;
      });
    }
  };

  const renderInput = (row: MergedRow, field: EditableField, bgClass: string) => {
    const isSaving = savingIds.has(row.productId);
    return (
      <input
        type="number"
        step="0.01"
        min="0"
        value={getInputValue(row, field)}
        placeholder={row.hasPurchase ? '0.00' : '—'}
        onChange={(e) => handleChange(row.productId, field, e.target.value)}
        onBlur={() => handleBlur(row, field)}
        disabled={isSaving}
        className={`w-20 px-1.5 py-1 border border-transparent rounded text-right tabular-nums focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200 disabled:opacity-50 ${bgClass}`}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por producto o ingrediente activo…"
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
            <span>{filtered.length} de {merged.length} productos</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-[11px] text-blue-800">
            <DollarSign size={12} />
            {tcLoading ? (
              <span className="inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Cargando TC…</span>
            ) : tc ? (
              <span>
                <span className="font-medium">TC hoy: S/ {tc.toFixed(4)}</span>
                {tipoCambioData?.fecha && (
                  <span className="text-blue-600/70"> · {tipoCambioData.fecha}</span>
                )}
              </span>
            ) : (
              <span className="text-blue-700/80">TC no disponible — autollenado USD desactivado</span>
            )}
          </div>
          <p className="text-[11px] text-gray-500">
            Editá <span className="font-medium text-amber-700">USD s/IGV</span> y los otros 3 precios se autocompletan con el TC del día. Cualquier celda se puede editar manualmente.
          </p>
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
                <th className="text-left px-3 py-2 font-medium">Laboratorio</th>
                <th className="text-right px-2 py-2 font-medium bg-amber-100 text-amber-800">USD s/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-stone-100 text-stone-700">PEN s/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-amber-100 text-amber-800">USD c/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-stone-100 text-stone-700">PEN c/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-cyan-100 text-cyan-800">P. Mayorista</th>
                <th className="text-right px-2 py-2 font-medium bg-orange-100 text-orange-800">Margen %</th>
                <th className="text-right px-3 py-2 font-medium">Última compra</th>
                <th className="text-center px-2 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 size={20} className="animate-spin inline" /> Cargando catálogo…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    {merged.length === 0
                      ? 'No hay productos cargados.'
                      : 'Ningún producto coincide con los filtros.'}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const isSaving = savingIds.has(r.productId);
                const isSaved = savedIds.has(r.productId);
                const hasError = errorIds.has(r.productId);
                return (
                  <tr key={r.productId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      <div>{r.productName}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.laboratoryName ? (
                        <span className="text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                          {r.laboratoryName}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-1 py-1 text-right tabular-nums bg-amber-50">
                      {renderInput(r, 'unitPriceSinIgvUsd', 'bg-amber-50 text-amber-900')}
                    </td>
                    <td className="px-1 py-1 text-right tabular-nums bg-stone-50">
                      {renderInput(r, 'unitPriceSinIgvPen', 'bg-stone-50 text-stone-800')}
                    </td>
                    <td className="px-1 py-1 text-right tabular-nums bg-amber-50">
                      {renderInput(r, 'unitPriceConIgvUsd', 'bg-amber-50 text-amber-900')}
                    </td>
                    <td className="px-1 py-1 text-right tabular-nums bg-stone-50">
                      {renderInput(r, 'unitPriceConIgvPen', 'bg-stone-50 text-stone-800')}
                    </td>
                    <td className="px-1 py-1 text-right tabular-nums bg-cyan-50">
                      {renderInput(r, 'precioMinorista', 'bg-cyan-50 text-cyan-900')}
                    </td>
                    <td className="px-1 py-1 text-right tabular-nums bg-orange-50">
                      {renderInput(r, 'markupPercent', 'bg-orange-50 text-orange-900 font-medium')}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                      <div>{fmtDate(r.lastPurchaseDate)}</div>
                      {r.documentSeries && r.documentNumber && (
                        <div className="text-[10px] text-gray-400">{r.documentSeries}-{r.documentNumber}</div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      {isSaving ? (
                        <Loader2 size={14} className="animate-spin inline text-gray-500" />
                      ) : hasError ? (
                        <AlertTriangle size={14} className="inline text-red-500" />
                      ) : isSaved ? (
                        <Check size={14} className="inline text-emerald-600" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 flex flex-wrap gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" /> Precio USD</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-stone-100 border border-stone-200" /> Precio PEN</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-cyan-100 border border-cyan-200" /> Precio mayorista</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-orange-100 border border-orange-200" /> Margen</span>
        </div>
      </div>
    </div>
  );
}

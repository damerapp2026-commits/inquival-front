import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, FileSpreadsheet, X, Check, AlertTriangle, DollarSign, RotateCcw } from 'lucide-react';
import { usePriceCatalog, useUpdatePriceCatalog } from '../../purchases/hooks/usePurchases';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { useStockByProductSummary } from '../../stock/hooks/useStock';
import { useTodayTipoCambio } from '../../../shared/hooks/useLookup';
import type { Product } from '../../../shared/types';

const IGV_RATE = 0.18;
const r2 = (n: number) => Math.round(n * 100) / 100;
const appliesIgv = (taxType?: string) => !taxType || taxType === 'GRAVADO';

const STORAGE_KEY = 'priceCatalog:globalRates:v1';
const DEFAULT_MARGEN_DIST = 1.12;
const DEFAULT_MARGEN_FINAL = 1.09;

interface GlobalRates {
  tcOverride: number | null;
  margenDist: number;
  margenFinal: number;
}

const loadRates = (): GlobalRates => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tcOverride: null, margenDist: DEFAULT_MARGEN_DIST, margenFinal: DEFAULT_MARGEN_FINAL };
    const parsed = JSON.parse(raw);
    return {
      tcOverride: typeof parsed.tcOverride === 'number' && parsed.tcOverride > 0 ? parsed.tcOverride : null,
      margenDist: typeof parsed.margenDist === 'number' && parsed.margenDist > 0 ? parsed.margenDist : DEFAULT_MARGEN_DIST,
      margenFinal: typeof parsed.margenFinal === 'number' && parsed.margenFinal > 0 ? parsed.margenFinal : DEFAULT_MARGEN_FINAL,
    };
  } catch {
    return { tcOverride: null, margenDist: DEFAULT_MARGEN_DIST, margenFinal: DEFAULT_MARGEN_FINAL };
  }
};

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
  precioVenta?: number;
  storedSellPrice?: number;
  storedSellPriceTier?: string;
  markupPercent?: number;
  stockQuantity: number;
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
  | 'precioMinorista';

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
  const { data: priceTiersData } = usePriceTiers();
  const { data: stockSummaryData } = useStockByProductSummary();
  const { data: tipoCambioData, isLoading: tcLoading } = useTodayTipoCambio(enabled);
  const tcDay = tipoCambioData?.venta ?? null;
  const updatePriceCatalog = useUpdatePriceCatalog();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [laboratoryId, setLaboratoryId] = useState('');
  const [edits, setEdits] = useState<Record<string, Partial<Record<EditableField, string>>>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

  const [rates, setRates] = useState<GlobalRates>(() => loadRates());
  const [tcInput, setTcInput] = useState<string>(() => {
    const r = loadRates();
    return r.tcOverride != null ? String(r.tcOverride) : '';
  });
  const [margenDistInput, setMargenDistInput] = useState<string>(() => String(loadRates().margenDist));
  const [margenFinalInput, setMargenFinalInput] = useState<string>(() => String(loadRates().margenFinal));
  const tc = rates.tcOverride ?? tcDay;
  const margenDist = rates.margenDist;
  const margenFinal = rates.margenFinal;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rates)); } catch { /* ignore */ }
  }, [rates]);

  const categories: any[] = Array.isArray(categoriesData) ? categoriesData : (categoriesData as any)?.data || [];
  const laboratories: any[] = Array.isArray(laboratoriesData) ? laboratoriesData : [];
  const priceTiers: any[] = Array.isArray(priceTiersData) ? priceTiersData : [];
  const products: Product[] = (productsData as any)?.data || (Array.isArray(productsData) ? productsData : []) || [];
  const catalogRows: PriceCatalogRow[] = Array.isArray(catalogData) ? catalogData : [];
  const stockByProduct = useMemo(
    () => new Map((stockSummaryData || []).map((s: any) => [s.productId, s])),
    [stockSummaryData],
  );

  const sortedTiers = useMemo(
    () => priceTiers.slice().sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0)),
    [priceTiers],
  );

  const tiersById = useMemo(
    () => new Map(priceTiers.map((t: any) => [t.id, t])),
    [priceTiers],
  );

  const lookupStoredPrice = (p: Product): { price?: number; tierName?: string } => {
    if (!p.prices?.length) return {};
    for (const t of sortedTiers) {
      const found = p.prices.find((px: any) => px.priceTierId === t.id && !px.companyId && px.price > 0);
      if (found) return { price: found.price, tierName: t.name };
    }
    const anyGlobal = p.prices.find((px: any) => !px.companyId && px.price > 0);
    if (anyGlobal) {
      const tier: any = tiersById.get(anyGlobal.priceTierId);
      return { price: anyGlobal.price, tierName: tier?.name };
    }
    const anyPrice = p.prices.find((px: any) => px.price > 0);
    if (anyPrice) {
      const tier: any = tiersById.get(anyPrice.priceTierId);
      return { price: anyPrice.price, tierName: tier?.name };
    }
    return {};
  };

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
      const stock = stockByProduct.get(p.id) as any;
      const labName = p.laboratoryId ? (labsById.get(p.laboratoryId) as any)?.name : undefined;
      const { price: storedSellPrice, tierName: storedSellPriceTier } = lookupStoredPrice(p);
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
        precioVenta: row?.precioVenta,
        storedSellPrice,
        storedSellPriceTier,
        markupPercent: row?.markupPercent,
        stockQuantity: Number(stock?.totalQuantity ?? 0),
        lastPurchaseDate: row?.lastPurchaseDate,
        documentSeries: row?.documentSeries,
        documentNumber: row?.documentNumber,
        hasPurchase: !!row,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, catalogByProduct, labsById, sortedTiers, tiersById, stockByProduct]);

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

  const precioTentativo = (row: MergedRow): number | undefined => {
    const penConIgv = row.unitPriceConIgvPen;
    if (penConIgv != null && Number.isFinite(penConIgv) && penConIgv > 0) {
      return r2(penConIgv * margenDist);
    }
    return undefined;
  };

  const facturacionSinIgv = (row: MergedRow): number | undefined => {
    const penSinIgv = row.unitPriceSinIgvPen;
    if (penSinIgv != null && Number.isFinite(penSinIgv) && penSinIgv > 0) {
      return r2(penSinIgv * margenFinal);
    }
    return undefined;
  };

  const renderPrecioFinalInput = (row: MergedRow) => {
    const isSaving = savingIds.has(row.productId);
    const editedRaw = edits[row.productId]?.precioMinorista;
    const hasEdit = editedRaw !== undefined;
    const hasSaved = row.precioMinorista != null;

    const fallbackPrice = row.storedSellPrice ?? row.precioVenta;
    const fallbackSource = row.storedSellPrice != null
      ? `${row.storedSellPriceTier ?? 'precio guardado'}`
      : row.precioVenta != null
        ? 'última compra'
        : null;

    const value = hasEdit
      ? editedRaw!
      : hasSaved
        ? fmt(row.precioMinorista)
        : fallbackPrice != null ? fmt(fallbackPrice) : '';

    const isFromFallback = !hasEdit && !hasSaved && fallbackPrice != null;
    const bgClass = isFromFallback
      ? 'bg-cyan-50/40 text-cyan-700 italic'
      : 'bg-cyan-50 text-cyan-900';

    return (
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        placeholder={row.hasPurchase ? '0.00' : '—'}
        onChange={(e) => handleChange(row.productId, 'precioMinorista', e.target.value)}
        onBlur={() => handleBlur(row, 'precioMinorista')}
        disabled={isSaving}
        title={isFromFallback ? `Precio guardado (${fallbackSource}). Editá para sobreescribir solo en este catálogo.` : undefined}
        className={`w-20 px-1.5 py-1 border border-transparent rounded text-right tabular-nums focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200 disabled:opacity-50 ${bgClass}`}
      />
    );
  };

  const handleTcChange = (raw: string) => {
    setTcInput(raw);
    const trimmed = raw.trim();
    if (trimmed === '') {
      setRates((r) => ({ ...r, tcOverride: null }));
      return;
    }
    const num = parseFloat(trimmed);
    if (Number.isFinite(num) && num > 0) {
      setRates((r) => ({ ...r, tcOverride: num }));
    }
  };

  const handleMargenChange = (kind: 'dist' | 'final', raw: string) => {
    if (kind === 'dist') setMargenDistInput(raw);
    else setMargenFinalInput(raw);
    const trimmed = raw.trim();
    const fallback = kind === 'dist' ? DEFAULT_MARGEN_DIST : DEFAULT_MARGEN_FINAL;
    if (trimmed === '') {
      setRates((r) => ({ ...r, [kind === 'dist' ? 'margenDist' : 'margenFinal']: fallback }));
      return;
    }
    const num = parseFloat(trimmed);
    if (Number.isFinite(num) && num > 0) {
      setRates((r) => ({ ...r, [kind === 'dist' ? 'margenDist' : 'margenFinal']: num }));
    }
  };

  const resetRates = () => {
    setRates({ tcOverride: null, margenDist: DEFAULT_MARGEN_DIST, margenFinal: DEFAULT_MARGEN_FINAL });
    setTcInput('');
    setMargenDistInput(String(DEFAULT_MARGEN_DIST));
    setMargenFinalInput(String(DEFAULT_MARGEN_FINAL));
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
        <div className="mt-3 grid grid-cols-1 md:grid-cols-[auto_auto_auto_auto_1fr] gap-2 md:gap-3 items-start">
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">T.C. (S/ por USD)</label>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 border border-blue-200">
              <DollarSign size={12} className="text-blue-700" />
              {tcLoading && tcInput === '' ? (
                <Loader2 size={10} className="animate-spin text-blue-700" />
              ) : (
                <input
                  type="text"
                  inputMode="decimal"
                  value={tcInput !== '' ? tcInput : (tcDay != null ? tcDay.toFixed(4) : '')}
                  onChange={(e) => handleTcChange(e.target.value)}
                  placeholder="3.50"
                  className="w-20 bg-transparent text-sm font-semibold text-blue-900 tabular-nums focus:outline-none"
                />
              )}
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5">
              {rates.tcOverride != null ? 'Override manual' : tipoCambioData?.fecha ? `SBS ${tipoCambioData.fecha}` : tc ? 'Día actual' : 'No disponible'}
            </span>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">IGV</label>
            <div className="px-2 py-1 rounded-md bg-stone-100 border border-stone-200 text-sm font-semibold text-stone-700 tabular-nums">
              {(1 + IGV_RATE).toFixed(2)}
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5">Fijo 18%</span>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Margen Tentativo</label>
            <input
              type="text"
              inputMode="decimal"
              value={margenDistInput}
              onChange={(e) => handleMargenChange('dist', e.target.value)}
              className="w-24 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800 tabular-nums focus:outline-none focus:border-emerald-400"
            />
            <span className="text-[10px] text-gray-400 mt-0.5">PEN c/IGV × este factor</span>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Margen Facturación</label>
            <input
              type="text"
              inputMode="decimal"
              value={margenFinalInput}
              onChange={(e) => handleMargenChange('final', e.target.value)}
              className="w-24 px-2 py-1 rounded-md bg-orange-50 border border-orange-200 text-sm font-semibold text-orange-800 tabular-nums focus:outline-none focus:border-orange-400"
            />
            <span className="text-[10px] text-gray-400 mt-0.5">PEN s/IGV × este factor</span>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1">
            <button
              type="button"
              onClick={resetRates}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-md"
              title="Volver a valores por defecto (TC del día, 1.12, 1.09)"
            >
              <RotateCcw size={11} /> Restablecer
            </button>
            <p className="text-[11px] text-gray-500 max-w-md text-left md:text-right">
              Editá <span className="font-medium text-amber-700">USD s/IGV</span> para autocompletar precios con el T.C. de arriba. Si no hay precio distribuidor guardado, se sugiere automáticamente.
            </p>
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
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-100 text-[10px]">
                <th colSpan={3}></th>
                <th className="text-right px-2 py-1 font-medium tabular-nums" colSpan={2}>
                  T.C. <span className="text-blue-700">{tc != null ? tc.toFixed(2) : '—'}</span>
                </th>
                <th className="text-right px-2 py-1 font-medium tabular-nums" colSpan={2}>
                  IGV <span className="text-stone-700">{(1 + IGV_RATE).toFixed(2)}</span>
                </th>
                <th className="text-right px-2 py-1 font-medium tabular-nums bg-emerald-50">
                  <span className="text-emerald-700">×{margenDist.toFixed(2)}</span>
                </th>
                <th className="text-right px-2 py-1 font-medium tabular-nums">
                  <span className="text-gray-400">guardado</span>
                </th>
                <th className="text-right px-2 py-1 font-medium tabular-nums bg-orange-50">
                  <span className="text-orange-700">×{margenFinal.toFixed(2)}</span>
                </th>
                <th colSpan={2}></th>
              </tr>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <th className="text-left px-2 py-2 font-medium w-[180px] max-w-[180px]">Nombre</th>
                <th className="text-left px-2 py-2 font-medium w-[110px] max-w-[110px]">Laboratorio</th>
                <th className="text-right px-2 py-2 font-medium w-16">Stock</th>
                <th className="text-right px-2 py-2 font-medium bg-amber-100 text-amber-800">USD s/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-stone-100 text-stone-700">PEN s/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-amber-100 text-amber-800">USD c/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-stone-100 text-stone-700">PEN c/IGV</th>
                <th className="text-right px-2 py-2 font-medium bg-emerald-100 text-emerald-800">P. Tentativo</th>
                <th className="text-right px-2 py-2 font-medium bg-cyan-100 text-cyan-800">P. Final</th>
                <th className="text-right px-2 py-2 font-medium bg-orange-100 text-orange-800">Facturación s/IGV</th>
                <th className="text-right px-3 py-2 font-medium">Última compra</th>
                <th className="text-center px-2 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 size={20} className="animate-spin inline" /> Cargando catálogo…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-400">
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
                    <td className="px-2 py-2 font-medium text-gray-800 w-[180px] max-w-[180px]">
                      <div className="truncate" title={r.productName}>{r.productName}</div>
                    </td>
                    <td className="px-2 py-2 w-[110px] max-w-[110px]">
                      {r.laboratoryName ? (
                        <span className="block truncate text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded" title={r.laboratoryName}>
                          {r.laboratoryName}
                        </span>
                      ) : '—'}
                    </td>
                    <td className={`px-2 py-2 text-right tabular-nums w-16 ${r.stockQuantity <= 10 ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                      {r.stockQuantity}
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
                    <td className="px-2 py-2 text-right tabular-nums bg-emerald-50 text-emerald-900 font-medium">
                      {(() => {
                        const tentativo = precioTentativo(r);
                        return tentativo != null ? tentativo.toFixed(2) : <span className="text-gray-300 font-normal">—</span>;
                      })()}
                    </td>
                    <td className="px-1 py-1 text-right tabular-nums bg-cyan-50">
                      {renderPrecioFinalInput(r)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums bg-orange-50 text-orange-900 font-semibold">
                      {(() => {
                        const fact = facturacionSinIgv(r);
                        return fact != null ? fact.toFixed(2) : <span className="text-gray-300 font-normal">—</span>;
                      })()}
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
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-200" /> P. Tentativo (PEN c/IGV × {margenDist.toFixed(2)})</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-cyan-100 border border-cyan-200" /> P. Final (BD, editable)</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-orange-100 border border-orange-200" /> Facturación s/IGV (PEN s/IGV × {margenFinal.toFixed(2)})</span>
        </div>
      </div>
    </div>
  );
}

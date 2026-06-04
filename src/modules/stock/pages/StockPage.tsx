import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStock, useStockAlerts, useTransferStock, useStockByProductSummary } from '../hooks/useStock';
import { useStockAdjustments } from '../hooks/useStockAdjustments';
import { useProductLots, useExpiringLots } from '../hooks/useProductLots';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { stockService } from '../services/stockService';
import { stockAdjustmentService } from '../services/stockAdjustmentService';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { Package, ArrowRightLeft, AlertTriangle, Trash2, Plus, ClipboardList, ChevronDown, ChevronUp, Search, CalendarClock, Boxes, Download, Upload, Loader2, Ban, HelpCircle, PenLine, AlertCircle, Pencil } from 'lucide-react';
import type { Stock, Company, Product, StockAdjustment, ProductLot } from '../../../shared/types';

const ADJUSTMENT_REASONS = [
  { value: 'Conteo físico', icon: ClipboardList },
  { value: 'Merma / vencimiento', icon: AlertCircle },
  { value: 'Robo / pérdida', icon: Ban },
  { value: 'Error de carga', icon: Pencil },
  { value: 'Ingreso manual', icon: PenLine },
  { value: 'Otro motivo', icon: HelpCircle },
] as const;

export function StockPage() {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'inventory' | 'lots' | 'adjustments' | 'transfers' | null) || 'inventory';
  const [activeTab, setActiveTab] = useState<'inventory' | 'lots' | 'adjustments' | 'transfers'>(initialTab);
  const [page, setPage] = useState(1);
  const [companyId, setCompanyId] = useState('');
  const [allWarehouses, setAllWarehouses] = useState(true);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjPage, setAdjPage] = useState(1);
  const [showLowStockDetail, setShowLowStockDetail] = useState(false);
  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const debouncedSearch = useDebounce(searchFilter);
  const [showExpiringDetail, setShowExpiringDetail] = useState(false);
  const initialLotFilter = (searchParams.get('filter') as 'all' | 'active' | 'expiring' | 'expired' | null) || 'all';
  const [lotFilter, setLotFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>(initialLotFilter);
  const [lotDateFilter, setLotDateFilter] = useState('');
  const [lotDateDirection, setLotDateDirection] = useState<'before' | 'after'>('before');
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'inventory' || t === 'lots' || t === 'adjustments' || t === 'transfers') setActiveTab(t);
    const f = searchParams.get('filter');
    if (f === 'all' || f === 'active' || f === 'expiring' || f === 'expired') setLotFilter(f);
  }, [searchParams]);
  const [expandedStock, setExpandedStock] = useState<Record<string, boolean>>({});

  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 10000, includeInactive: true });
  const { data, isLoading } = useStock(companyId, { page, limit: 20 });
  const { data: alerts } = useStockAlerts(companyId, 10);
  const transferStock = useTransferStock();
  const { data: adjustmentsData, isLoading: adjLoading } = useStockAdjustments({ page: adjPage, limit: 20, companyId: companyId || undefined });
  const { data: lotsData, isLoading: lotsLoading } = useProductLots(companyId);
  const { data: expiringData } = useExpiringLots(companyId, 30);
  const { data: allWarehousesSummary, isLoading: allWarehousesLoading } = useStockByProductSummary();

  const [transferForm, setTransferForm] = useState({ fromCompanyId: '', toCompanyId: '', items: [{ productId: '', quantity: 0, lotAllocations: [] as { lotId: string; quantity: number }[] }] });
  const { data: transferSourceLotsData } = useProductLots(transferForm.fromCompanyId);
  const transferSourceAllLots: ProductLot[] = Array.isArray(transferSourceLotsData) ? transferSourceLotsData : [];
  const transferSourceLotsByProduct = transferSourceAllLots.reduce<Record<string, ProductLot[]>>((acc, l) => {
    if (!acc[l.productId]) acc[l.productId] = [];
    acc[l.productId].push(l);
    return acc;
  }, {});
  const companyList = Array.isArray(companies) ? companies : [];

  // Bulk adjustment modal state
  const [adjCompanyId, setAdjCompanyId] = useState('');
  const [adjAllWarehouses, setAdjAllWarehouses] = useState(true);
  const [adjSearch, setAdjSearch] = useState('');
  const debouncedAdjSearch = useDebounce(adjSearch);
  // Selection keyed by `${productId}__${companyId}` so the same product can be
  // adjusted independently in several warehouses when the "Todos" view is active.
  const [adjSelected, setAdjSelected] = useState<Record<string, boolean>>({});
  const [adjNewQty, setAdjNewQty] = useState<Record<string, string>>({});
  const [adjReason, setAdjReason] = useState<string>('Conteo físico');
  const [adjApplying, setAdjApplying] = useState(false);
  const [adjProgress, setAdjProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [adjFlashProductId, setAdjFlashProductId] = useState<string | null>(null);

  const makeRowKey = (productId: string, companyId: string) => `${productId}__${companyId}`;
  const parseRowKey = (key: string): { productId: string; companyId: string } => {
    const idx = key.indexOf('__');
    return { productId: key.slice(0, idx), companyId: key.slice(idx + 2) };
  };

  // Fetch every product (no ingredient filter) and every stock row for the chosen warehouse
  // when the bulk modal is open. The per-warehouse query is gated on showAdjustment AND a
  // specific warehouse being selected (i.e. not in "Todos" mode).
  const { data: adjProductsData } = useProducts(showAdjustment ? { limit: 10000 } : undefined);
  const { data: adjStockResponse } = useQuery({
    queryKey: ['stock', adjCompanyId, 'bulk-adjust'],
    queryFn: () => stockService.getByCompany(adjCompanyId, { limit: 9999 }),
    enabled: !!adjCompanyId && !adjAllWarehouses && showAdjustment,
  });

  const adjAllProducts: Product[] = useMemo(() => {
    const list: Product[] = (adjProductsData?.data || []).filter((p: Product) => p.isActive !== false);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [adjProductsData]);
  const adjStockByProductId: Record<string, number> = useMemo(() => {
    const list: any[] = Array.isArray(adjStockResponse) ? adjStockResponse : adjStockResponse?.data || [];
    const map: Record<string, number> = {};
    list.forEach((s: any) => {
      const pid = s.productId || s.product?.id || s.product?._id || s.product;
      if (pid) map[String(pid)] = Number(s.quantity) || 0;
    });
    return map;
  }, [adjStockResponse]);

  type AdjRow = { key: string; productId: string; productName: string; productUnit?: string; companyId: string; companyName: string; currentQty: number };

  const adjRows: AdjRow[] = useMemo(() => {
    if (adjAllWarehouses) {
      const summary = Array.isArray(allWarehousesSummary) ? allWarehousesSummary : [];
      const productsById = new Map<string, Product>(adjAllProducts.map(p => [p.id, p]));
      const companiesById = new Map<string, Company>(companyList.map((c: Company) => [c.id, c]));
      const rows: AdjRow[] = [];
      summary.forEach(s => {
        const p = productsById.get(s.productId);
        if (!p) return;
        (s.byCompany || []).forEach(b => {
          if (!(b.quantity > 0)) return;
          const c = companiesById.get(b.companyId);
          if (!c) return;
          rows.push({
            key: makeRowKey(p.id, b.companyId),
            productId: p.id,
            productName: p.name,
            productUnit: p.unit,
            companyId: b.companyId,
            companyName: c.name,
            currentQty: b.quantity,
          });
        });
      });
      return rows.sort((a, b) => a.productName.localeCompare(b.productName) || a.companyName.localeCompare(b.companyName));
    }
    const c = companyList.find((c: Company) => c.id === adjCompanyId);
    return adjAllProducts.map(p => ({
      key: makeRowKey(p.id, adjCompanyId),
      productId: p.id,
      productName: p.name,
      productUnit: p.unit,
      companyId: adjCompanyId,
      companyName: c?.name || '',
      currentQty: adjStockByProductId[p.id] ?? 0,
    }));
  }, [adjAllWarehouses, allWarehousesSummary, adjAllProducts, companyList, adjCompanyId, adjStockByProductId]);

  const adjRowsByKey = useMemo(() => {
    const map = new Map<string, AdjRow>();
    adjRows.forEach(r => map.set(r.key, r));
    return map;
  }, [adjRows]);

  const adjVisibleRows = useMemo(() => {
    const q = debouncedAdjSearch.trim().toLowerCase();
    if (!q) return adjRows;
    return adjRows.filter(r => r.productName.toLowerCase().includes(q));
  }, [adjRows, debouncedAdjSearch]);

  const adjSelectedCount = Object.values(adjSelected).filter(Boolean).length;
  const adjPendingChanges = useMemo(() => {
    return Object.entries(adjSelected)
      .filter(([, sel]) => sel)
      .map(([key]) => {
        const row = adjRowsByKey.get(key);
        const { productId, companyId } = parseRowKey(key);
        const current = row?.currentQty ?? 0;
        const raw = adjNewQty[key];
        const parsed = raw === undefined || raw === '' ? current : Number(raw);
        const next = isNaN(parsed) ? current : parsed;
        const delta = Math.round((next - current) * 100) / 100;
        return { key, productId, companyId, current, next, delta };
      })
      .filter(c => Math.abs(c.delta) > 0.0001 && c.next >= 0 && !!c.companyId);
  }, [adjSelected, adjNewQty, adjRowsByKey]);
  const adjHasInvalid = useMemo(() => {
    return Object.entries(adjSelected)
      .filter(([, sel]) => sel)
      .some(([key]) => {
        const raw = adjNewQty[key];
        if (raw === undefined || raw === '') return false;
        const parsed = Number(raw);
        return isNaN(parsed) || parsed < 0;
      });
  }, [adjSelected, adjNewQty]);
  const adjCanApply = !adjApplying && (adjAllWarehouses || !!adjCompanyId) && !!adjReason && adjPendingChanges.length > 0 && !adjHasInvalid;

  // Bulk import state
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreview, setImportPreview] = useState<{ productId: string; productName: string; companyId: string; companyName: string; currentQty: number; newQty: number; delta: number }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [exporting, setExporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const products = productsData?.data || [];
  const searchActive = !!debouncedSearch.trim();
  const filteredProductIds = useMemo(() => {
    if (!searchActive) return null;
    const q = debouncedSearch.trim().toLowerCase();
    return new Set<string>(
      products
        .filter((p: Product) =>
          p.name.toLowerCase().includes(q) ||
          (p.activeIngredient || '').toLowerCase().includes(q)
        )
        .map((p: Product) => p.id)
    );
  }, [products, debouncedSearch, searchActive]);
  const stockItems = (data?.data || []).filter((s: Stock) => !filteredProductIds || filteredProductIds.has(s.productId) || (s.productName || '').toLowerCase().includes(debouncedSearch.trim().toLowerCase()));
  const total = stockItems.length;
  const alertList = Array.isArray(alerts) ? alerts : [];
  const adjustments = adjustmentsData?.data || [];
  const adjTotal = adjustmentsData?.total || 0;
  const allLots: ProductLot[] = Array.isArray(lotsData) ? lotsData : [];
  const expiringLots: ProductLot[] = Array.isArray(expiringData) ? expiringData : [];

  const daysUntil = (date?: string) => {
    if (!date) return Infinity;
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };
  const lotStatus = (lot: ProductLot): { label: string; color: string; days: number } => {
    const d = daysUntil(lot.expirationDate);
    if (d === Infinity) return { label: 'Sin fecha', color: 'bg-gray-100 text-gray-600 border-gray-300', days: d };
    if (d < 0) return { label: `Vencido hace ${-d}d`, color: 'bg-red-100 text-red-700 border-red-300', days: d };
    if (d <= 7) return { label: `${d}d`, color: 'bg-orange-100 text-orange-700 border-orange-300', days: d };
    if (d <= 30) return { label: `${d}d`, color: 'bg-yellow-100 text-yellow-800 border-yellow-300', days: d };
    return { label: `${d}d`, color: 'bg-green-100 text-green-700 border-green-300', days: d };
  };

  const filteredLots = allLots.filter(l => {
    if (lotFilter !== 'all') {
      const d = daysUntil(l.expirationDate);
      if (lotFilter === 'active' && !(l.currentQuantity > 0 && d > 30)) return false;
      if (lotFilter === 'expiring' && !(l.currentQuantity > 0 && d >= 0 && d <= 30)) return false;
      if (lotFilter === 'expired' && !(d < 0)) return false;
    }
    if (lotDateFilter) {
      if (!l.expirationDate) return false;
      const lotDate = new Date(l.expirationDate).getTime();
      const cutoff = new Date(lotDateFilter).getTime();
      if (lotDateDirection === 'before') return lotDate <= cutoff;
      return lotDate >= cutoff;
    }
    return true;
  }).sort((a, b) => daysUntil(a.expirationDate) - daysUntil(b.expirationDate));

  const lotsByProduct = allLots.reduce<Record<string, ProductLot[]>>((acc, l) => {
    if (!acc[l.productId]) acc[l.productId] = [];
    acc[l.productId].push(l);
    return acc;
  }, {});

  const getProductName = (id: string) => products.find((p: Product) => p.id === id)?.name || 'N/A';
  const getStockProductName = (s: Stock) => s.productName || products.find((p: Product) => p.id === s.productId)?.name || (s.productMissing ? 'Producto eliminado' : 'N/A');
  const getCompanyName = (id: string) => companyList.find((c: Company) => c.id === id)?.name || 'N/A';

  const openTransfer = () => { setTransferForm({ fromCompanyId: companyId || '', toCompanyId: '', items: [{ productId: '', quantity: 0, lotAllocations: [] }] }); setShowTransfer(true); };
  const openAdjustment = (preset?: { productId?: string; companyId?: string }) => {
    // If a specific warehouse is supplied (e.g. editing a past adjustment) we land on that
    // warehouse tab; otherwise default to the cross-warehouse "Todos" view so a product that
    // only exists in another warehouse isn't hidden behind a misleading "stock 0".
    if (preset?.companyId) {
      setAdjAllWarehouses(false);
      setAdjCompanyId(preset.companyId);
      setAdjSelected(preset.productId ? { [makeRowKey(preset.productId, preset.companyId)]: true } : {});
    } else {
      setAdjAllWarehouses(true);
      setAdjCompanyId('');
      setAdjSelected({});
    }
    setAdjSearch('');
    setAdjNewQty({});
    setAdjReason('Conteo físico');
    setAdjProgress({ done: 0, total: 0, errors: 0 });
    setAdjFlashProductId(preset?.productId || null);
    setShowAdjustment(true);
  };
  const closeAdjustment = () => {
    if (adjApplying) return;
    setShowAdjustment(false);
    setAdjSelected({});
    setAdjNewQty({});
    setAdjSearch('');
    setAdjFlashProductId(null);
  };
  const toggleAdjRow = (key: string) => {
    setAdjSelected(prev => {
      const next = { ...prev };
      const wasSelected = !!next[key];
      if (wasSelected) delete next[key]; else next[key] = true;
      // Toggling off discards the typed value so re-toggling shows the live current stock
      if (wasSelected) {
        setAdjNewQty(qty => { const n = { ...qty }; delete n[key]; return n; });
      }
      return next;
    });
  };
  const selectAllVisibleAdj = () => {
    setAdjSelected(prev => {
      const next = { ...prev };
      adjVisibleRows.forEach(r => { next[r.key] = true; });
      return next;
    });
  };
  const clearAdjSelection = () => { setAdjSelected({}); setAdjNewQty({}); };

  const addTransferItem = () => setTransferForm(prev => ({ ...prev, items: [...prev.items, { productId: '', quantity: 0, lotAllocations: [] }] }));
  const transferSourceLots = (productId: string): ProductLot[] => {
    return (transferSourceLotsByProduct[productId] || []).filter(l => l.currentQuantity > 0);
  };
  const autoFifoAllocate = (idx: number) => {
    setTransferForm(prev => {
      const items = [...prev.items];
      const it = items[idx];
      const src = transferSourceLots(it.productId).sort((a, b) => {
        const da = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
        const db = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
        return da - db;
      });
      let remaining = it.quantity;
      const allocations: { lotId: string; quantity: number }[] = [];
      for (const lot of src) {
        if (remaining <= 0) break;
        const take = Math.min(lot.currentQuantity, remaining);
        allocations.push({ lotId: lot.id, quantity: take });
        remaining -= take;
      }
      items[idx] = { ...it, lotAllocations: allocations };
      return { ...prev, items };
    });
  };
  const updateAllocation = (itemIdx: number, lotId: string, quantity: number) => {
    setTransferForm(prev => {
      const items = [...prev.items];
      const allocs = [...(items[itemIdx].lotAllocations || [])];
      const i = allocs.findIndex(a => a.lotId === lotId);
      if (quantity <= 0) {
        if (i >= 0) allocs.splice(i, 1);
      } else {
        if (i >= 0) allocs[i] = { lotId, quantity };
        else allocs.push({ lotId, quantity });
      }
      items[itemIdx] = { ...items[itemIdx], lotAllocations: allocs };
      return { ...prev, items };
    });
  };
  const removeTransferItem = (idx: number) => setTransferForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateTransferItem = (idx: number, field: string, value: any) => setTransferForm(prev => { const items = [...prev.items]; items[idx] = { ...items[idx], [field]: value }; return { ...prev, items }; });

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const it of transferForm.items) {
      const product = products.find((p: Product) => p.id === it.productId);
      if (product?.tracksLot) {
        const sum = (it.lotAllocations || []).reduce((s, a) => s + a.quantity, 0);
        if (Math.abs(sum - it.quantity) > 0.0001) {
          const { default: toast } = await import('react-hot-toast');
          toast.error(`Para ${product.name} la suma de lotes (${sum}) debe coincidir con la cantidad (${it.quantity})`);
          return;
        }
      }
    }
    const payload = {
      ...transferForm,
      items: transferForm.items.map(it => {
        const product = products.find((p: Product) => p.id === it.productId);
        return product?.tracksLot && it.lotAllocations?.length
          ? { productId: it.productId, quantity: it.quantity, lotAllocations: it.lotAllocations }
          : { productId: it.productId, quantity: it.quantity };
      }),
    };
    await transferStock.mutateAsync(payload);
    setShowTransfer(false);
  };
  const applyBulkAdjustments = async () => {
    if (!adjCanApply) return;
    setAdjApplying(true);
    setAdjProgress({ done: 0, total: adjPendingChanges.length, errors: 0 });
    let done = 0;
    let errors = 0;
    for (const change of adjPendingChanges) {
      try {
        await stockAdjustmentService.create({
          productId: change.productId,
          companyId: change.companyId,
          type: change.delta > 0 ? 'INCREASE' : 'DECREASE',
          quantity: Math.abs(change.delta),
          reason: adjReason,
        });
        done++;
      } catch {
        errors++;
      }
      setAdjProgress({ done: done + errors, total: adjPendingChanges.length, errors });
    }
    queryClient.invalidateQueries({ queryKey: ['stock'] });
    queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
    queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
    queryClient.invalidateQueries({ queryKey: ['stock-by-product-summary'] });
    setAdjApplying(false);
    if (errors === 0) {
      toast.success(`${done} ajuste${done !== 1 ? 's' : ''} aplicado${done !== 1 ? 's' : ''}`);
      setShowAdjustment(false);
      setAdjSelected({});
      setAdjNewQty({});
      setAdjSearch('');
      setAdjFlashProductId(null);
    } else {
      toast.error(`${done} aplicado${done !== 1 ? 's' : ''}, ${errors} con error`);
    }
  };

  const handleExportStockExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      // Fetch fresh companies and products at click time so the export does not depend on cached state
      const { companyService } = await import('../../companies/services/companyService');
      const { productService } = await import('../../products/services/productService');
      const [freshCompaniesRaw, freshProductsRaw] = await Promise.all([
        companyService.getAll(),
        productService.getAll({ limit: 9999 }),
      ]);

      // Robustly resolve list shape from different response wrappings
      const resolveList = (raw: any): any[] => {
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.data?.data)) return raw.data.data;
        return [];
      };
      const freshCompanies: Company[] = resolveList(freshCompaniesRaw);
      // Accept products where isActive is explicitly true OR undefined (legacy rows)
      const allProducts: Product[] = resolveList(freshProductsRaw).filter((p: Product) => p.isActive !== false);

      // Log raw shapes to help diagnose if numbers come out wrong
      // eslint-disable-next-line no-console
      console.log('[stock-export] companies raw:', freshCompaniesRaw, '→ resolved:', freshCompanies.length);
      // eslint-disable-next-line no-console
      console.log('[stock-export] products raw:', freshProductsRaw, '→ resolved:', allProducts.length);

      if (freshCompanies.length === 0) {
        toast.error('No hay almacenes registrados. Crea al menos uno en /companies.');
        return;
      }
      if (allProducts.length === 0) {
        toast.error('No hay productos detectados. Revisa la consola del navegador para ver la respuesta del backend.');
        return;
      }

      const stocksByCompany: Record<string, Record<string, number>> = {};
      for (const company of freshCompanies) {
        if (!company.isActive) continue;
        try {
          const result: any = await stockService.getByCompany(company.id, { limit: 9999 });
          const list: any[] = Array.isArray(result) ? result : result?.data || [];
          const map: Record<string, number> = {};
          list.forEach((s: any) => {
            const pid = s.productId || s.product?.id || s.product?._id || s.product;
            if (pid) map[String(pid)] = s.quantity;
          });
          stocksByCompany[company.id] = map;
        } catch {
          stocksByCompany[company.id] = {};
        }
      }

      const rows: any[] = [];
      for (const company of freshCompanies) {
        if (!company.isActive) continue;
        for (const product of allProducts) {
          const current = stocksByCompany[company.id]?.[product.id] ?? 0;
          rows.push({
            'ID Almacen (no editar)': company.id,
            'Almacen': company.name,
            'ID Producto (no editar)': product.id,
            'Producto': product.name,
            'Unidad': product.unit,
            'Stock Actual': current,
            'Stock Nuevo': current,
          });
        }
      }

      if (rows.length === 0) {
        toast.error('No hay filas para exportar');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 32 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock');
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `stock_${dateStr}.xlsx`);
      toast.success(`${rows.length} filas exportadas (${freshCompanies.length} almacenes × ${allProducts.length} productos)`);
    } catch (err: any) {
      toast.error('Error al exportar: ' + (err?.message || 'desconocido'));
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (importFileRef.current) importFileRef.current.value = '';
    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      if (rows.length === 0) { toast.error('El archivo está vacío'); return; }

      // Fetch fresh companies and products to validate against current data
      const { companyService } = await import('../../companies/services/companyService');
      const { productService } = await import('../../products/services/productService');
      const [freshCompaniesRaw, freshProductsRaw] = await Promise.all([
        companyService.getAll(),
        productService.getAll({ limit: 9999 }),
      ]);
      const resolveList = (raw: any): any[] => {
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.data?.data)) return raw.data.data;
        return [];
      };
      const freshCompanies: Company[] = resolveList(freshCompaniesRaw);
      const productById = new Map<string, Product>(
        resolveList(freshProductsRaw).map((p: Product) => [p.id, p])
      );
      const companyById = new Map<string, Company>(freshCompanies.map((c: Company) => [c.id, c]));

      const preview: typeof importPreview = [];
      let skipped = 0;
      for (const row of rows) {
        const productId = String(row['ID Producto (no editar)'] || '').trim();
        const companyId = String(row['ID Almacen (no editar)'] || '').trim();
        const newQtyRaw = row['Stock Nuevo'];
        const currentQtyRaw = row['Stock Actual'];

        if (!productId || !companyId) { skipped++; continue; }
        const newQty = Number(newQtyRaw);
        const currentQty = Number(currentQtyRaw);
        if (isNaN(newQty) || newQty < 0) { skipped++; continue; }

        const product = productById.get(productId);
        const company = companyById.get(companyId);
        if (!product || !company) { skipped++; continue; }

        const delta = Math.round((newQty - (isNaN(currentQty) ? 0 : currentQty)) * 100) / 100;
        if (delta === 0) continue;

        preview.push({ productId, productName: product.name, companyId, companyName: company.name, currentQty: isNaN(currentQty) ? 0 : currentQty, newQty, delta });
      }

      if (preview.length === 0) {
        toast(skipped > 0 ? `Sin cambios detectados (${skipped} filas ignoradas)` : 'Sin cambios detectados', { icon: 'ℹ️' });
        return;
      }

      setImportPreview(preview);
      setImportProgress({ done: 0, total: preview.length, errors: 0 });
      setShowImportPreview(true);
      if (skipped > 0) toast(`${skipped} fila(s) ignorada(s) por datos inválidos`, { icon: '⚠️' });
    } catch (err: any) {
      toast.error('Error al leer el archivo: ' + (err?.message || 'desconocido'));
    }
  };

  const applyImport = async () => {
    setImporting(true);
    let done = 0;
    let errors = 0;

    // Obtener el stock LIVE al momento de aplicar (no el del Excel que puede estar desactualizado).
    // Esto evita duplicar stock cuando el Excel fue exportado antes de registrar compras:
    // el delta se calcula como (stockNuevo - stockActualLive), no (stockNuevo - stockActualExcel).
    const companiesInvolved = [...new Set(importPreview.map(p => p.companyId))];
    const liveStockByKey: Record<string, number> = {};
    try {
      for (const cid of companiesInvolved) {
        const result: any = await stockService.getByCompany(cid, { limit: 9999 });
        const list: any[] = Array.isArray(result) ? result : result?.data || [];
        list.forEach((s: any) => {
          const pid = s.productId || s.product?.id || s.product?._id || s.product;
          if (pid) liveStockByKey[`${String(pid)}:${cid}`] = Number(s.quantity) || 0;
        });
      }
    } catch {
      toast.error('No se pudo verificar el stock actual. Intenta de nuevo.');
      setImporting(false);
      return;
    }

    for (const change of importPreview) {
      try {
        const liveQty = liveStockByKey[`${change.productId}:${change.companyId}`] ?? 0;
        const liveDelta = Math.round((change.newQty - liveQty) * 100) / 100;
        if (Math.abs(liveDelta) < 0.001) { done++; setImportProgress({ done: done + errors, total: importPreview.length, errors }); continue; }
        await stockAdjustmentService.create({
          productId: change.productId,
          companyId: change.companyId,
          type: liveDelta > 0 ? 'INCREASE' : 'DECREASE',
          quantity: Math.abs(liveDelta),
          reason: 'Carga masiva por Excel',
        });
        done++;
      } catch {
        errors++;
      }
      setImportProgress({ done: done + errors, total: importPreview.length, errors });
    }
    queryClient.invalidateQueries({ queryKey: ['stock'] });
    queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
    queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
    setImporting(false);
    if (errors === 0) {
      toast.success(`${done} ajuste(s) aplicado(s)`);
      setShowImportPreview(false);
      setImportPreview([]);
    } else {
      toast.error(`${done} aplicado(s), ${errors} con error`);
    }
  };

  React.useEffect(() => { if (!companyId && companyList.length > 0) setCompanyId(companyList[0].id); }, [companyList, companyId]);
  React.useEffect(() => {
    if (!adjFlashProductId) return;
    const t = setTimeout(() => setAdjFlashProductId(null), 1800);
    return () => clearTimeout(t);
  }, [adjFlashProductId]);

  const stockColumns = [
    { key: 'productId', header: 'Producto', render: (item: Stock) => getProductName(item.productId) },
    { key: 'quantity', header: 'Cantidad', render: (item: Stock) => <span className={item.quantity <= 10 ? 'text-red-600 font-bold' : ''}>{item.quantity}</span> },
    { key: 'lastUpdated', header: 'Ultima actualizacion', render: (item: Stock) => new Date(item.lastUpdated).toLocaleDateString('es-PE') },
  ];

  const adjColumns = [
    { key: 'date', header: 'Fecha', render: (item: StockAdjustment) => new Date(item.date).toLocaleDateString('es-PE') },
    { key: 'productId', header: 'Producto', render: (item: StockAdjustment) => getProductName(item.productId) },
    { key: 'companyId', header: 'Almacén', render: (item: StockAdjustment) => getCompanyName(item.companyId) },
    { key: 'type', header: 'Tipo', render: (item: StockAdjustment) => item.type === 'INCREASE' ? <span className="text-primary-600 font-medium">Aumento</span> : <span className="text-red-600 font-medium">Disminucion</span> },
    { key: 'quantity', header: 'Cantidad', render: (item: StockAdjustment) => item.quantity },
    { key: 'previousQuantity', header: 'Anterior', render: (item: StockAdjustment) => item.previousQuantity },
    { key: 'newQuantity', header: 'Nuevo', render: (item: StockAdjustment) => item.newQuantity },
    { key: 'reason', header: 'Razon', render: (item: StockAdjustment) => <span className="text-sm text-gray-600">{item.reason}</span> },
  ];

  const tabs = [
    { id: 'inventory' as const, label: 'Inventario', icon: Package },
    { id: 'lots' as const, label: 'Lotes', icon: Boxes },
    { id: 'adjustments' as const, label: 'Ajustes', icon: ClipboardList },
    { id: 'transfers' as const, label: 'Transferencias', icon: ArrowRightLeft },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Package size={24} /> Stock</h1>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'inventory' && (
            <>
              <button
                onClick={handleExportStockExcel}
                disabled={exporting}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm"
                title="Descargar Excel con stock actual de todos los productos en todos los almacenes"
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Descargar Excel
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportFileSelected}
              />
              <button
                onClick={() => importFileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                title="Subir Excel modificado. Cada fila con cambio en 'Stock Nuevo' generará un ajuste."
              >
                <Upload size={16} /> Subir Excel
              </button>
              <button onClick={() => openAdjustment()} className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"><Plus size={16} /> Ajuste</button>
              <button onClick={openTransfer} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><ArrowRightLeft size={16} /> Transferir</button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b">
        {tabs.map(tab => { const Icon = tab.icon; return (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1); setAdjPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} />{tab.label}
          </button>
        ); })}
      </div>

      {alertList.length > 0 && activeTab === 'inventory' && !allWarehouses && (() => {
        // Clasificar alertas en 3 grupos: agotados, críticos, sin referencia
        type AlertItem = Stock & { _name: string };
        const enriched: AlertItem[] = alertList.map((a: Stock) => ({ ...a, _name: getProductName(a.productId) }));
        const orphan = enriched.filter(a => a._name === 'N/A');
        const known = enriched.filter(a => a._name !== 'N/A');
        const outOfStock = known.filter(a => a.quantity === 0).sort((a, b) => a._name.localeCompare(b._name));
        const critical = known.filter(a => a.quantity > 0).sort((a, b) => a.quantity - b.quantity || a._name.localeCompare(b._name));

        const MAX_VISIBLE = 30;
        const visibleCritical = showAllLowStock ? critical : critical.slice(0, MAX_VISIBLE);
        const hiddenCount = Math.max(0, critical.length - MAX_VISIBLE);

        return (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowLowStockDetail(v => !v)}
              className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-yellow-100 transition-colors"
            >
              <div className="flex items-center gap-2 text-yellow-900">
                <AlertTriangle size={18} className="flex-shrink-0" />
                <div>
                  <div className="font-semibold">Stock bajo ({alertList.length} productos)</div>
                  <div className="text-xs text-yellow-800 mt-0.5">
                    {outOfStock.length > 0 && <span className="text-red-700 font-medium">{outOfStock.length} agotados</span>}
                    {outOfStock.length > 0 && critical.length > 0 && <span className="mx-1">·</span>}
                    {critical.length > 0 && <span>{critical.length} con poco stock</span>}
                    {orphan.length > 0 && <span className="ml-1 text-gray-600">· {orphan.length} sin referencia</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-yellow-800 text-sm font-medium flex-shrink-0">
                {showLowStockDetail ? <>Ocultar <ChevronUp size={16} /></> : <>Ver detalle <ChevronDown size={16} /></>}
              </div>
            </button>

            {showLowStockDetail && (
              <div className="px-3 pb-3 pt-1 space-y-3 border-t border-yellow-200">
                {outOfStock.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Agotados ({outOfStock.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {outOfStock.map((a) => (
                        <button
                          key={`${a.productId}-${a.companyId}`}
                          onClick={() => openAdjustment({ productId: a.productId, companyId: a.companyId })}
                          className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-medium border border-red-200 transition-colors"
                          title="Click para ajustar stock"
                        >
                          {a._name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {critical.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-yellow-800 uppercase tracking-wide mb-2">Stock crítico ({critical.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {visibleCritical.map((a) => (
                        <button
                          key={`${a.productId}-${a.companyId}`}
                          onClick={() => openAdjustment({ productId: a.productId, companyId: a.companyId })}
                          className="px-2 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded text-xs font-medium border border-yellow-300 transition-colors"
                          title="Click para ajustar stock"
                        >
                          {a._name} <span className="text-yellow-700">· {a.quantity}</span>
                        </button>
                      ))}
                      {!showAllLowStock && hiddenCount > 0 && (
                        <button
                          onClick={() => setShowAllLowStock(true)}
                          className="px-2 py-1 bg-white hover:bg-gray-50 text-gray-700 rounded text-xs font-medium border border-gray-300"
                        >
                          Ver más (+{hiddenCount})
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {orphan.length > 0 && (
                  <div className="pt-2 border-t border-yellow-200">
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      {orphan.length} {orphan.length === 1 ? 'registro sin referencia' : 'registros sin referencia'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Estos registros referencian productos que ya no existen en la base. Es seguro ignorarlos o limpiarlos manualmente desde Mongo.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {expiringLots.length > 0 && (activeTab === 'inventory' || activeTab === 'lots') && !(activeTab === 'inventory' && allWarehouses) && (() => {
        const expired = expiringLots.filter(l => daysUntil(l.expirationDate) < 0);
        const sevenDays = expiringLots.filter(l => { const d = daysUntil(l.expirationDate); return d >= 0 && d <= 7; });
        const thirtyDays = expiringLots.filter(l => { const d = daysUntil(l.expirationDate); return d > 7 && d <= 30; });
        return (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
            <button onClick={() => setShowExpiringDetail(v => !v)} className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-orange-100 transition-colors">
              <div className="flex items-center gap-2 text-orange-900">
                <CalendarClock size={18} className="flex-shrink-0" />
                <div>
                  <div className="font-semibold">Lotes por vencer ({expiringLots.length})</div>
                  <div className="text-xs text-orange-800 mt-0.5">
                    {expired.length > 0 && <span className="text-red-700 font-medium">{expired.length} vencidos</span>}
                    {expired.length > 0 && (sevenDays.length + thirtyDays.length) > 0 && <span className="mx-1">·</span>}
                    {sevenDays.length > 0 && <span>{sevenDays.length} en 7 días</span>}
                    {sevenDays.length > 0 && thirtyDays.length > 0 && <span className="mx-1">·</span>}
                    {thirtyDays.length > 0 && <span>{thirtyDays.length} en 30 días</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-orange-800 text-sm font-medium flex-shrink-0">
                {showExpiringDetail ? <>Ocultar <ChevronUp size={16} /></> : <>Ver detalle <ChevronDown size={16} /></>}
              </div>
            </button>
            {showExpiringDetail && (
              <div className="px-3 pb-3 pt-1 space-y-3 border-t border-orange-200">
                {[{ label: 'Vencidos', list: expired, tone: 'bg-red-100 text-red-800 border-red-300' }, { label: 'Próximos 7 días', list: sevenDays, tone: 'bg-orange-100 text-orange-800 border-orange-300' }, { label: 'Próximos 30 días', list: thirtyDays, tone: 'bg-yellow-100 text-yellow-800 border-yellow-300' }].filter(g => g.list.length > 0).map(g => (
                  <div key={g.label}>
                    <div className="text-xs font-bold uppercase tracking-wide mb-2 text-gray-700">{g.label} ({g.list.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.list.map((l) => {
                        const st = lotStatus(l);
                        return (
                          <button key={l.id} onClick={() => { setActiveTab('lots'); setLotFilter(g.label === 'Vencidos' ? 'expired' : 'expiring'); }} className={`px-2 py-1 rounded text-xs font-medium border ${g.tone}`} title="Ir a la pestaña de lotes">
                            {getProductName(l.productId)} · {l.lotNumber} · <span>{st.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {(activeTab === 'inventory' || activeTab === 'adjustments' || activeTab === 'lots') && (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeTab === 'inventory' && (
            <button
              onClick={() => { setAllWarehouses(true); setPage(1); }}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 ${allWarehouses ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              title="Ver el stock consolidado de todos los almacenes"
            >
              <Boxes size={16} /> Todos los almacenes
            </button>
          )}
          {companyList.map((c: Company) => (
            <button key={c.id} onClick={() => { setCompanyId(c.id); setAllWarehouses(false); setPage(1); setAdjPage(1); }} className={`px-4 py-2 rounded-lg font-medium ${!allWarehouses && companyId === c.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'inventory' && allWarehouses && (() => {
        const summary = Array.isArray(allWarehousesSummary) ? allWarehousesSummary : [];
        const rows = summary
          .filter(s => !filteredProductIds || filteredProductIds.has(s.productId))
          .map(s => ({ ...s, _name: getProductName(s.productId) }))
          .sort((a, b) => a._name.localeCompare(b._name));
        return (
          <>
            <div className="mb-3 relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar por producto o ingrediente activo..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="bg-white rounded-xl shadow-card overflow-hidden border border-gray-100">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-8"></th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock total</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Almacenes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allWarehousesLoading ? (
                    <tr><td colSpan={4} className="text-center py-6 text-gray-400">Cargando...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-6 text-gray-400">Sin registros</td></tr>
                  ) : rows.map(item => {
                    const product = products.find((p: Product) => p.id === item.productId);
                    const name = product?.name || 'Producto eliminado';
                    const isOrphan = !product;
                    const isInactive = product?.isActive === false;
                    const isExpanded = expandedStock[item.productId];
                    const breakdown = (item.byCompany || []).slice().sort((a, b) => b.quantity - a.quantity);
                    const warehouseCount = breakdown.filter(b => b.quantity > 0).length;
                    return (
                      <React.Fragment key={item.productId}>
                        <tr className="hover:bg-primary-50 transition-colors">
                          <td className="px-2">
                            {breakdown.length > 0 && (
                              <button onClick={() => setExpandedStock(s => ({ ...s, [item.productId]: !s[item.productId] }))} className="p-1 text-gray-400 hover:text-primary-600">
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`font-medium ${isOrphan || isInactive ? 'text-gray-400 italic' : ''}`}>{name}</span>
                            {isOrphan && <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700 border border-red-300">HUÉRFANO</span>}
                            {!isOrphan && isInactive && <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600 border border-gray-300">INACTIVO</span>}
                            {product?.tracksLot && <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 border border-blue-200">LOTES</span>}
                          </td>
                          <td className={`px-3 py-2 ${item.totalQuantity <= 10 ? 'text-red-600 font-bold' : 'font-medium'}`}>{item.totalQuantity}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{warehouseCount} con stock</td>
                        </tr>
                        {isExpanded && breakdown.length > 0 && (
                          <tr className="bg-gray-50/70">
                            <td></td>
                            <td colSpan={3} className="px-3 py-2">
                              <div className="text-xs text-gray-500 mb-1">Desglose por almacén</div>
                              <div className="space-y-1">
                                {breakdown.map(b => (
                                  <div key={b.companyId} className="flex items-center gap-2 text-xs bg-white border border-gray-200 rounded px-2 py-1">
                                    <span className="font-medium text-gray-700">{getCompanyName(b.companyId)}</span>
                                    <span className={`ml-auto ${b.quantity === 0 ? 'text-gray-400' : b.quantity <= 10 ? 'text-red-600 font-semibold' : 'text-gray-700 font-medium'}`}>{b.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {activeTab === 'inventory' && !allWarehouses && (
        <>
          <div className="mb-3 relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar por producto o ingrediente activo..." value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }} className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8"></th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Últ. actualización</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={4} className="text-center py-6 text-gray-400">Cargando...</td></tr>
                ) : stockItems.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-gray-400">Sin registros</td></tr>
                ) : stockItems.map((item: Stock) => {
                  const product = products.find((p: Product) => p.id === item.productId);
                  const productLots = lotsByProduct[item.productId] || [];
                  const hasLots = product?.tracksLot && productLots.length > 0;
                  const isExpanded = expandedStock[item.id];
                  const isOrphan = item.productMissing === true || (!product && !item.productName);
                  const isInactive = item.productIsActive === false || product?.isActive === false;
                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-primary-50 transition-colors">
                        <td className="px-2">
                          {hasLots && (
                            <button onClick={() => setExpandedStock(s => ({ ...s, [item.id]: !s[item.id] }))} className="p-1 text-gray-400 hover:text-primary-600">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-medium ${isOrphan || isInactive ? 'text-gray-400 italic' : ''}`}>{getStockProductName(item)}</span>
                          {isOrphan && <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700 border border-red-300">HUÉRFANO</span>}
                          {!isOrphan && isInactive && <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600 border border-gray-300">INACTIVO</span>}
                          {product?.tracksLot && <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 border border-blue-200">LOTES</span>}
                        </td>
                        <td className={`px-3 py-2 ${item.quantity <= 10 ? 'text-red-600 font-bold' : ''}`}>{item.quantity}</td>
                        <td className="px-3 py-2 text-gray-500">{new Date(item.lastUpdated).toLocaleDateString('es-PE')}</td>
                      </tr>
                      {hasLots && isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td></td>
                          <td colSpan={3} className="px-3 py-2">
                            <div className="text-xs text-gray-500 mb-1">Lotes activos</div>
                            <div className="space-y-1">
                              {productLots.filter(l => l.currentQuantity > 0).map(l => {
                                const st = lotStatus(l);
                                return (
                                  <div key={l.id} className="flex items-center gap-2 text-xs bg-white border border-gray-200 rounded px-2 py-1">
                                    <span className="font-mono text-gray-700">{l.lotNumber}</span>
                                    <span className="text-gray-400">·</span>
                                    <span className="text-gray-600">{l.currentQuantity} / {l.initialQuantity}</span>
                                    <span className="text-gray-400">·</span>
                                    <span className="text-gray-600">{l.expirationDate ? `Vence ${new Date(l.expirationDate).toLocaleDateString('es-PE')}` : 'Sin vencimiento'}</span>
                                    <span className={`ml-auto px-1.5 py-0.5 rounded border text-[10px] font-medium ${st.color}`}>{st.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
        </>
      )}

      {activeTab === 'lots' && (
        <>
          <div className="flex gap-2 mb-3 flex-wrap items-center">
            {([{ id: 'all', label: 'Todos' }, { id: 'active', label: 'Activos' }, { id: 'expiring', label: 'Por vencer (30d)' }, { id: 'expired', label: 'Vencidos' }] as const).map(f => (
              <button key={f.id} onClick={() => setLotFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${lotFilter === f.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm text-gray-500 font-medium">F.V.:</span>
            <button
              onClick={() => setLotDateDirection('before')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${lotDateDirection === 'before' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
            >
              Antes de
            </button>
            <button
              onClick={() => setLotDateDirection('after')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${lotDateDirection === 'after' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
            >
              Después de
            </button>
            <input
              type="date"
              value={lotDateFilter}
              onChange={(e) => setLotDateFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
            {lotDateFilter && (
              <button
                onClick={() => setLotDateFilter('')}
                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Limpiar fecha
              </button>
            )}
            {lotDateFilter && (
              <span className="text-xs text-gray-400">
                {filteredLots.length} resultado{filteredLots.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lote</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual / Inicial</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vence</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recepción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lotsLoading ? (
                  <tr><td colSpan={6} className="text-center py-6 text-gray-400">Cargando...</td></tr>
                ) : filteredLots.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-gray-400">Sin lotes para este filtro</td></tr>
                ) : filteredLots.map(l => {
                  const st = lotStatus(l);
                  return (
                    <tr key={l.id} className="hover:bg-primary-50 transition-colors">
                      <td className="px-3 py-2 font-medium">{getProductName(l.productId)}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{l.lotNumber}</td>
                      <td className="px-3 py-2 text-right">{l.currentQuantity} / {l.initialQuantity}</td>
                      <td className="px-3 py-2">{l.expirationDate ? new Date(l.expirationDate).toLocaleDateString('es-PE') : '—'}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded border text-xs font-medium ${st.color}`}>{st.label}</span></td>
                      <td className="px-3 py-2 text-gray-500">{l.receivedAt ? new Date(l.receivedAt).toLocaleDateString('es-PE') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'adjustments' && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => openAdjustment()} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"><Plus size={18} /> Nuevo Ajuste</button>
          </div>
          <DataTable columns={adjColumns} data={adjustments} isLoading={adjLoading} />
          <Pagination page={adjPage} totalPages={Math.ceil(adjTotal / 20)} onPageChange={setAdjPage} />
        </>
      )}

      {activeTab === 'transfers' && (
        <div className="text-center py-12 text-gray-500">
          <ArrowRightLeft size={48} className="mx-auto mb-4 text-gray-300" />
          <p>Usa el boton "Transferir Stock" desde la pestana de Inventario para mover productos entre almacenes.</p>
        </div>
      )}

      <Modal isOpen={showTransfer} onClose={() => setShowTransfer(false)} title="Transferir Stock entre Almacenes" size="lg">
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-gray-700">Productos</label><button type="button" onClick={addTransferItem} className="text-sm text-primary-600 hover:text-primary-800">+ Agregar</button></div>
            <div className="space-y-2">
              {transferForm.items.map((item, idx) => {
                const product = products.find((p: Product) => p.id === item.productId);
                const hasLots = product?.tracksLot;
                const sourceLots = hasLots ? transferSourceLots(item.productId) : [];
                const allocSum = (item.lotAllocations || []).reduce((s, a) => s + a.quantity, 0);
                const mismatch = hasLots && item.quantity > 0 && Math.abs(allocSum - item.quantity) > 0.0001;
                return (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <SearchableSelect
                          options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
                          value={item.productId}
                          onChange={(v) => { updateTransferItem(idx, 'productId', v); updateTransferItem(idx, 'lotAllocations', []); }}
                          placeholder="Buscar producto..."
                          required
                        />
                      </div>
                      <input type="number" placeholder="Cantidad" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateTransferItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-28 px-2 py-1.5 border rounded text-sm" required />
                      {transferForm.items.length > 1 && <button type="button" onClick={() => removeTransferItem(idx)} className="text-red-500"><Trash2 size={14} /></button>}
                    </div>
                    {hasLots && item.productId && (
                      <div className="mt-2 border-t border-gray-200 pt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-600">Lotes a transferir <span className="text-red-500">*</span></span>
                          <button type="button" onClick={() => autoFifoAllocate(idx)} disabled={!item.quantity || sourceLots.length === 0} className="text-xs text-primary-600 hover:text-primary-800 disabled:opacity-40 disabled:cursor-not-allowed">
                            Auto FIFO (vence primero)
                          </button>
                        </div>
                        {sourceLots.length === 0 ? (
                          <div className="text-xs text-gray-400 italic py-1">No hay lotes disponibles en la sucursal origen para este producto.</div>
                        ) : (
                          <div className="space-y-1">
                            {sourceLots.map((lot) => {
                              const alloc = item.lotAllocations?.find(a => a.lotId === lot.id)?.quantity || 0;
                              const st = lotStatus(lot);
                              return (
                                <div key={lot.id} className="flex items-center gap-2 text-xs bg-white border border-gray-200 rounded px-2 py-1">
                                  <span className="font-mono text-gray-700 w-32 truncate" title={lot.lotNumber}>{lot.lotNumber}</span>
                                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${st.color}`}>{st.label}</span>
                                  <span className="text-gray-500 flex-1">Disponible: {lot.currentQuantity}</span>
                                  <input type="number" min="0" max={lot.currentQuantity} step="0.01" value={alloc || ''} onChange={(e) => updateAllocation(idx, lot.id, parseFloat(e.target.value) || 0)} placeholder="0" className="w-20 px-1.5 py-0.5 border rounded text-xs" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className={`mt-1 text-xs flex justify-between ${mismatch ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          <span>Suma asignada</span>
                          <span>{allocSum} / {item.quantity || 0}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <button type="submit" disabled={transferStock.isPending} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{transferStock.isPending ? 'Transfiriendo...' : 'Realizar Transferencia'}</button>
        </form>
      </Modal>

      <Modal isOpen={showAdjustment} onClose={closeAdjustment} title="Ajustar stock" size="2xl">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 -mt-2">
            Seleccioná uno o varios productos y registrá su nuevo stock. Cada cambio queda asentado en el ledger de movimientos.
          </p>

          {companyList.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setAdjAllWarehouses(true); setAdjCompanyId(''); setAdjSelected({}); setAdjNewQty({}); }}
                disabled={adjApplying}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${adjAllWarehouses ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'} disabled:opacity-50`}
              >
                Todos
              </button>
              {companyList.map((c: Company) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setAdjAllWarehouses(false); setAdjCompanyId(c.id); setAdjSelected({}); setAdjNewQty({}); }}
                  disabled={adjApplying}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!adjAllWarehouses && adjCompanyId === c.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'} disabled:opacity-50`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={adjSearch}
              onChange={(e) => setAdjSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <span className="text-sm text-gray-500 flex-shrink-0">
              <span className="font-semibold text-gray-800">{adjSelectedCount}</span> seleccionado{adjSelectedCount !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={selectAllVisibleAdj} disabled={adjApplying} className="text-orange-600 font-medium hover:text-orange-700 disabled:opacity-50">
              Seleccionar todos los visibles
            </button>
            {adjSelectedCount > 0 && (
              <button type="button" onClick={clearAdjSelection} disabled={adjApplying} className="text-gray-500 hover:text-gray-700 disabled:opacity-50">
                Limpiar selección
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                    {adjAllWarehouses && (
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Almacén</th>
                    )}
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock actual</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock final</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider pr-4">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adjVisibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={adjAllWarehouses ? 6 : 5} className="text-center py-8 text-gray-400">
                        {adjAllWarehouses ? 'Sin productos con stock en ningún almacén' : 'Sin productos'}
                      </td>
                    </tr>
                  ) : adjVisibleRows.map(row => {
                    const current = row.currentQty;
                    const isSelected = !!adjSelected[row.key];
                    const raw = adjNewQty[row.key];
                    const parsed = raw === undefined || raw === '' ? current : Number(raw);
                    const isInvalid = isSelected && raw !== undefined && raw !== '' && (isNaN(parsed) || parsed < 0);
                    const next = isInvalid ? current : (isNaN(parsed) ? current : parsed);
                    const delta = Math.round((next - current) * 100) / 100;
                    const flash = adjFlashProductId === row.productId;
                    return (
                      <tr
                        key={row.key}
                        className={`${isSelected ? 'bg-orange-50/60' : 'hover:bg-gray-50'} ${flash ? 'ring-2 ring-inset ring-orange-300' : ''} transition-colors`}
                      >
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAdjRow(row.key)}
                            disabled={adjApplying}
                            className="w-4 h-4 accent-orange-600 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800">{row.productName}</div>
                          {row.productUnit && <div className="text-[11px] text-gray-400">{row.productUnit}</div>}
                        </td>
                        {adjAllWarehouses && (
                          <td className="px-3 py-2 text-gray-600 text-xs">{row.companyName}</td>
                        )}
                        <td className="px-3 py-2 text-right text-gray-700">{current}</td>
                        <td className="px-3 py-2 text-right">
                          {isSelected ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={raw ?? String(current)}
                              onChange={(e) => setAdjNewQty(prev => ({ ...prev, [row.key]: e.target.value }))}
                              disabled={adjApplying}
                              className={`w-24 px-2 py-1 border rounded text-right text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${isInvalid ? 'border-red-400 bg-red-50' : 'border-gray-300'} disabled:opacity-50`}
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right pr-4">
                          {!isSelected ? (
                            <span className="text-gray-300">—</span>
                          ) : isInvalid ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Inválido</span>
                          ) : delta === 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Sin cambio</span>
                          ) : (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {adjSelectedCount > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Motivo del ajuste</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ADJUSTMENT_REASONS.map(r => {
                  const Icon = r.icon;
                  const active = adjReason === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setAdjReason(r.value)}
                      disabled={adjApplying}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${active ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'} disabled:opacity-50`}
                    >
                      <Icon size={14} className="flex-shrink-0" />
                      <span className="text-left">{r.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {adjApplying && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-orange-800">Aplicando ajustes…</span>
                <span className="text-orange-700">{adjProgress.done} / {adjProgress.total}</span>
              </div>
              <div className="h-2 bg-orange-100 rounded overflow-hidden">
                <div className="h-full bg-orange-600 transition-all" style={{ width: `${adjProgress.total > 0 ? (adjProgress.done / adjProgress.total) * 100 : 0}%` }} />
              </div>
              {adjProgress.errors > 0 && <div className="text-xs text-red-600 mt-2">{adjProgress.errors} con error</div>}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="text-xs flex items-center gap-1.5 min-h-[20px]">
              {adjHasInvalid ? (
                <span className="text-red-600 font-medium flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Hay valores inválidos (negativos o no numéricos)
                </span>
              ) : adjSelectedCount > 0 && adjPendingChanges.length === 0 ? (
                <span className="text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Modificá el stock final de algún producto seleccionado
                </span>
              ) : adjPendingChanges.length > 0 ? (
                <span className="text-gray-500">{adjPendingChanges.length} cambio{adjPendingChanges.length !== 1 ? 's' : ''} a aplicar</span>
              ) : null}
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={closeAdjustment}
                disabled={adjApplying}
                className="px-6 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyBulkAdjustments}
                disabled={!adjCanApply}
                className="px-6 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
              >
                {adjApplying ? <><Loader2 size={16} className="animate-spin" /> Aplicando…</> : 'Aplicar ajustes'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal carga masiva por Excel */}
      <Modal isOpen={showImportPreview} onClose={() => { if (!importing) { setShowImportPreview(false); setImportPreview([]); } }} title={`Vista previa: ${importPreview.length} cambio${importPreview.length !== 1 ? 's' : ''} a aplicar`} size="lg">
        <div className="space-y-4">
          {!importing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              Se generará <strong>1 ajuste por cada fila</strong> con la diferencia entre Stock Nuevo y Stock Actual.
              Las filas sin cambios se ignoran. Razón: <em>"Carga masiva por Excel"</em>.
            </div>
          )}

          {importing && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-orange-800">Aplicando ajustes…</span>
                <span className="text-orange-700">{importProgress.done} / {importProgress.total}</span>
              </div>
              <div className="h-2 bg-orange-100 rounded overflow-hidden">
                <div
                  className="h-full bg-orange-600 transition-all"
                  style={{ width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
                />
              </div>
              {importProgress.errors > 0 && (
                <div className="text-xs text-red-600 mt-2">{importProgress.errors} con error</div>
              )}
            </div>
          )}

          <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Almacén</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Actual</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Nuevo</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {importPreview.slice(0, 200).map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-600">{c.companyName}</td>
                    <td className="px-3 py-1.5">{c.productName}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{c.currentQty}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{c.newQty}</td>
                    <td className={`px-3 py-1.5 text-right font-bold ${c.delta > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {c.delta > 0 ? `+${c.delta}` : c.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {importPreview.length > 200 && (
              <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t">
                Mostrando los primeros 200 cambios de {importPreview.length}. Todos se aplicarán.
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setShowImportPreview(false); setImportPreview([]); }}
              disabled={importing}
              className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={applyImport}
              disabled={importing}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
            >
              {importing ? <><Loader2 size={16} className="animate-spin" /> Aplicando…</> : <>Aplicar {importPreview.length} ajuste{importPreview.length !== 1 ? 's' : ''}</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

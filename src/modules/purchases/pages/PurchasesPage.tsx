import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { usePurchases, useUpdatePurchaseFiscalEntity, useUpdatePurchaseMeta } from '../hooks/usePurchases';
import { purchaseService } from '../services/purchaseService';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { useFiscalEntities } from '../../fiscal-entities/hooks/useFiscalEntities';
import { PurchaseOrdersPage } from './PurchaseOrdersPage';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { Modal } from '../../../shared/components/Modal';
import { Plus, ShoppingCart, Eye, Wrench, Search, X, FileText, Download, ClipboardList, Percent, Loader2 } from 'lucide-react';
import type { Purchase, Company, Product, FiscalEntity } from '../../../shared/types';
import { formatDateEs } from '../../../shared/utils/date.util';
import toast from 'react-hot-toast';

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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [grModal, setGrModal] = useState<{ purchaseId: string; grSeries: string; grNumber: string; grDate: string } | null>(null);
  const [pendingFiscalEntityChange, setPendingFiscalEntityChange] = useState<{
    purchaseId: string;
    fiscalEntityId: string;
  } | null>(null);
  const updateMeta = useUpdatePurchaseMeta();
  const updateFiscalEntity = useUpdatePurchaseFiscalEntity();

  // Todo el estado vive en la URL para que "Atrás" desde el detalle restaure la página y filtros
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const activePreset = searchParams.get('preset') || '';
  const supplierParam = searchParams.get('supplier') || '';
  const currencyFilter = (searchParams.get('currency') || '') as '' | 'PEN' | 'USD';
  const paymentTypeFilter = (searchParams.get('paymentType') || '') as '' | 'CONTADO' | 'CREDITO';
  const fiscalEntityFilter = searchParams.get('fiscalEntityId') || '';
  const activeTab = searchParams.get('tab') === 'orders' ? 'orders' : 'purchases';

  // Estado local solo para el input (se escribe sin tocar la URL hasta el debounce)
  const [supplierSearch, setSupplierSearch] = useState(supplierParam);
  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);
  const supplierDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronizar el input si la URL cambia externamente (navegación con Atrás/Adelante)
  useEffect(() => { setSupplierSearch(supplierParam); }, [supplierParam]);
  useEffect(() => { setLocalStartDate(startDate); }, [startDate]);
  useEffect(() => { setLocalEndDate(endDate); }, [endDate]);

  const updateParams = (updates: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (!v) sp.delete(k); else sp.set(k, v);
    }
    setSearchParams(sp, { replace: true });
  };
  const setActiveTab = (tab: 'purchases' | 'orders') => updateParams({ tab: tab === 'orders' ? 'orders' : null, page: null });

  const apiPage = fiscalEntityFilter ? 1 : page;
  const apiLimit = fiscalEntityFilter ? 9999 : 20;

  const { data, isLoading } = usePurchases({
    page: apiPage,
    limit: apiLimit,
    supplier: supplierParam || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    currency: currencyFilter || undefined,
    paymentType: paymentTypeFilter || undefined,
  });

  const toggleCurrency = (c: 'PEN' | 'USD') =>
    updateParams({ currency: currencyFilter === c ? null : c, page: null });
  const togglePaymentType = (pt: 'CONTADO' | 'CREDITO') =>
    updateParams({ paymentType: paymentTypeFilter === pt ? null : pt, page: null });
  const toggleCombo = (c: 'PEN' | 'USD', pt: 'CONTADO' | 'CREDITO') => {
    const sameC = currencyFilter === c;
    const samePT = paymentTypeFilter === pt;
    updateParams({
      currency: sameC && samePT ? null : c,
      paymentType: sameC && samePT ? null : pt,
      page: null,
    });
  };
  const apiPurchases: Purchase[] = data?.data || [];
  const filteredByFiscalEntity = fiscalEntityFilter
    ? apiPurchases.filter((purchase) => purchase.fiscalEntityId === fiscalEntityFilter)
    : apiPurchases;
  const purchases = fiscalEntityFilter
    ? filteredByFiscalEntity.slice((page - 1) * 20, page * 20)
    : filteredByFiscalEntity;
  const total = fiscalEntityFilter ? filteredByFiscalEntity.length : data?.total || 0;

  const { data: companiesData } = useCompanies();
  const { data: productsData } = useProducts({ limit: 10000 });
  const { data: fiscalEntitiesData } = useFiscalEntities();
  const companies: Company[] = Array.isArray(companiesData) ? companiesData : [];
  const products: Product[] = productsData?.data || [];
  const fiscalEntities: FiscalEntity[] = (Array.isArray(fiscalEntitiesData) ? fiscalEntitiesData : []).filter((entity) => entity.isActive !== false);
  const companyMap = useMemo(() => new Map<string, Company>(companies.map((c) => [c.id, c])), [companies]);
  const productMap = useMemo(() => new Map<string, Product>(products.map((p) => [p.id, p])), [products]);
  const fiscalEntityMap = useMemo(() => new Map<string, FiscalEntity>(fiscalEntities.map((entity) => [entity.id, entity])), [fiscalEntities]);
  const fiscalTotals = useMemo(() => {
    const totals = {
      totalPen: 0,
      totalUsd: 0,
      totalPenContado: 0,
      totalUsdContado: 0,
      totalPenCredito: 0,
      totalUsdCredito: 0,
    };

    for (const purchase of filteredByFiscalEntity) {
      const isUsd = !!purchase.totalCostUsd;
      const penAmount = purchase.totalCost || 0;
      const usdAmount = purchase.totalCostUsd || 0;
      if (isUsd) totals.totalUsd += usdAmount;
      else totals.totalPen += penAmount;

      if (purchase.paymentType === 'CONTADO') {
        if (isUsd) totals.totalUsdContado += usdAmount;
        else totals.totalPenContado += penAmount;
      }
      if (purchase.paymentType === 'CREDITO') {
        if (isUsd) totals.totalUsdCredito += usdAmount;
        else totals.totalPenCredito += penAmount;
      }
    }

    return totals;
  }, [filteredByFiscalEntity]);
  const totalPen: number = fiscalEntityFilter ? fiscalTotals.totalPen : (data as any)?.totalPen ?? 0;
  const totalUsd: number = fiscalEntityFilter ? fiscalTotals.totalUsd : (data as any)?.totalUsd ?? 0;
  const totalPenContado: number = fiscalEntityFilter ? fiscalTotals.totalPenContado : (data as any)?.totalPenContado ?? 0;
  const totalUsdContado: number = fiscalEntityFilter ? fiscalTotals.totalUsdContado : (data as any)?.totalUsdContado ?? 0;
  const totalPenCredito: number = fiscalEntityFilter ? fiscalTotals.totalPenCredito : (data as any)?.totalPenCredito ?? 0;
  const totalUsdCredito: number = fiscalEntityFilter ? fiscalTotals.totalUsdCredito : (data as any)?.totalUsdCredito ?? 0;
  const handleSupplierChange = (val: string) => {
    setSupplierSearch(val);
    if (supplierDebounceRef.current) clearTimeout(supplierDebounceRef.current);
    supplierDebounceRef.current = setTimeout(() => {
      updateParams({ supplier: val || null, page: null });
    }, 400);
  };

  const applyPreset = (preset: typeof DATE_PRESETS[number]) => {
    const { start, end } = preset.getRange();
    updateParams({ startDate: start, endDate: end, preset: preset.id, page: null });
  };

  const clearDates = () => {
    setLocalStartDate('');
    setLocalEndDate('');
    updateParams({ startDate: null, endDate: null, preset: null, page: null });
  };

  const handleCustomDate = (field: 'start' | 'end', val: string) => {
    if (field === 'start') {
      setLocalStartDate(val);
      if (val) updateParams({ startDate: val, preset: 'custom', page: null });
    } else {
      setLocalEndDate(val);
      if (val) updateParams({ endDate: val, preset: 'custom', page: null });
    }
  };

  const setPage = (p: number) => updateParams({ page: p > 1 ? String(p) : null });

  const handleExportPurchases = async () => {
    try {
      const result = await purchaseService.getAll({
        limit: 9999,
        supplier: supplierParam || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        currency: currencyFilter || undefined,
        paymentType: paymentTypeFilter || undefined,
      });
      const allPurchases: Purchase[] = fiscalEntityFilter
        ? (result?.data || []).filter((purchase: Purchase) => purchase.fiscalEntityId === fiscalEntityFilter)
        : result?.data || [];
      if (allPurchases.length === 0) { toast.error('No hay datos para exportar'); return; }

      const XLSX = await import('xlsx');
      const rows = allPurchases.map((p) => {
        const productosStr = p.items.map((i) => `${productMap.get(i.productId)?.name || i.productId} x${i.quantity}`).join(', ');
        return {
          'Fecha': formatDateEs(p.issueDate || p.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
          'Proveedor': p.supplier,
          'RUC': p.supplierRuc || '',
          'Empresa': p.fiscalEntityId ? fiscalEntityMap.get(p.fiscalEntityId)?.legalName || p.fiscalEntityId : '',
          'Almacén': companyMap.get(p.companyId)?.name || p.companyId,
          'Productos': productosStr,
          'Tipo': p.paymentType === 'CREDITO' ? 'Crédito' : 'Contado',
          'Moneda': p.totalCostUsd ? 'USD' : 'PEN',
          'Total': Math.round((p.totalCostUsd ?? p.totalCost) * 100) / 100,
          'Total (S/)': Math.round(p.totalCost * 100) / 100,
          'Tipo de Cambio': p.exchangeRate || '',
          'Comprobante': [p.documentType, p.documentSeries, p.documentNumber].filter(Boolean).join(' '),
          'Guía Remisión': [p.grSeries, p.grNumber].filter(Boolean).join('-'),
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Compras');
      const range = startDate && endDate ? `${startDate}_a_${endDate}` : 'todas';
      XLSX.writeFile(wb, `compras_${range}.xlsx`);
      toast.success(`${rows.length} compra(s) exportada(s)`);
    } catch {
      toast.error('Error al exportar');
    }
  };

  const openGrModal = (item: Purchase) => {
    setGrModal({
      purchaseId: item.id,
      grSeries: item.grSeries || '',
      grNumber: item.grNumber || '',
      grDate: item.grDate ? item.grDate.slice(0, 10) : '',
    });
  };

  const handleGrSave = async () => {
    if (!grModal) return;
    await updateMeta.mutateAsync({
      id: grModal.purchaseId,
      data: {
        grSeries: grModal.grSeries,
        grNumber: grModal.grNumber,
        grDate: grModal.grDate,
      },
    });
    setGrModal(null);
  };

  const handleFiscalEntityChange = async (purchase: Purchase, fiscalEntityId: string) => {
    if (updateFiscalEntity.isPending || !fiscalEntityId || fiscalEntityId === purchase.fiscalEntityId) return;
    setPendingFiscalEntityChange({ purchaseId: purchase.id, fiscalEntityId });
    try {
      await updateFiscalEntity.mutateAsync({ id: purchase.id, fiscalEntityId });
    } finally {
      setPendingFiscalEntityChange(null);
    }
  };

  const columns = [
    { key: 'date', header: 'F. Emisión', render: (item: Purchase) => formatDateEs(item.issueDate || item.date, { day: '2-digit', month: '2-digit', year: 'numeric' }) },
    { key: 'supplier', header: 'Proveedor' },
    { key: 'fiscalEntityId', header: 'Empresa', render: (item: Purchase) => {
      const isChanging = pendingFiscalEntityChange?.purchaseId === item.id;
      const selectedFiscalEntityId = isChanging
        ? pendingFiscalEntityChange.fiscalEntityId
        : item.fiscalEntityId || '';
      return (
        <div className="relative min-w-[190px]" onClick={(event) => event.stopPropagation()}>
          <select
            value={selectedFiscalEntityId}
            onChange={(event) => handleFiscalEntityChange(item, event.target.value)}
            disabled={updateFiscalEntity.isPending || fiscalEntities.length === 0}
            aria-label={`Empresa receptora de la compra de ${item.supplier}`}
            className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-2.5 pr-8 text-xs font-medium text-gray-700 outline-none transition-colors hover:border-primary-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:cursor-wait disabled:opacity-60"
          >
            <option value="" disabled>Seleccionar empresa</option>
            {fiscalEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>{entity.legalName}</option>
            ))}
          </select>
          {isChanging && (
            <Loader2 size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-primary-600" />
          )}
        </div>
      );
    }},
    { key: 'document', header: 'Comprobante', render: (item: Purchase) => item.documentSeries && item.documentNumber
      ? <span className="font-mono text-xs text-gray-700">{item.documentSeries}-{item.documentNumber}</span>
      : <span className="text-gray-300">—</span>
    },
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
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${item.id}`, { state: { from: location.pathname + location.search } }); }} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium"><Eye size={15} /> Ver</button>
        <button
          onClick={(e) => { e.stopPropagation(); openGrModal(item); }}
          title={item.grSeries || item.grNumber ? `GR: ${[item.grSeries, item.grNumber].filter(Boolean).join('-')}` : 'Añadir Guía de Remisión'}
          className={`p-1 rounded hover:bg-gray-100 ${item.grSeries || item.grNumber ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <FileText size={14} />
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><ShoppingCart size={24} /> Compras / Ingresos</h1>
        <div className="flex items-center gap-2">
          {activeTab === 'purchases' && <Link
            to="/cash-register/migrate?tab=purchases"
            className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100"
            title="Reasignar compras a la caja correcta según su fecha"
          >
            <Wrench size={14} /> Migrar fechas
          </Link>}
          {activeTab === 'purchases'
            ? <Link to="/purchases/new" className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={18} /> Nueva Compra</Link>
            : <Link to="/purchases/orders/new" className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={18} /> Nueva Orden</Link>
          }
        </div>
      </div>
      <div className="flex border-b mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'purchases' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="inline-flex items-center gap-1.5"><ShoppingCart size={14} /> Compras</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'orders' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="inline-flex items-center gap-1.5"><ClipboardList size={14} /> Órdenes</span>
        </button>
      </div>
      {activeTab === 'orders' ? <PurchaseOrdersPage /> : <>
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

        {/* Filtro por entidad fiscal */}
        {fiscalEntities.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Empresa:</span>
            <select
              value={fiscalEntityFilter}
              onChange={(e) => updateParams({ fiscalEntityId: e.target.value || null, page: null })}
              className="min-w-[220px] px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas</option>
              {fiscalEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.legalName}
                </option>
              ))}
            </select>
            {fiscalEntityFilter && (
              <button
                type="button"
                onClick={() => updateParams({ fiscalEntityId: null, page: null })}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                title="Quitar filtro de empresa"
              >
                <X size={13} /> Limpiar
              </button>
            )}
          </div>
        )}

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
              value={localStartDate}
              onChange={(e) => handleCustomDate('start', e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
            <span className="text-xs text-gray-500">Hasta</span>
            <input
              type="date"
              value={localEndDate}
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
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={handleExportPurchases} className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-primary-700 bg-primary-100 border border-primary-300 rounded-lg hover:bg-primary-200 transition-colors">
            <Download size={14} /> Excel
          </button>

          {/* Contador + filtros de moneda */}
          <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <span className="text-xs text-gray-500 font-medium mr-1">{total} compra{total !== 1 ? 's' : ''}</span>
            {totalPen > 0 && (
              <button
                type="button"
                onClick={() => toggleCurrency('PEN')}
                title={currencyFilter === 'PEN' ? 'Quitar filtro S/' : 'Filtrar solo S/'}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${currencyFilter === 'PEN' ? 'bg-gray-700 text-white' : 'text-gray-700 hover:bg-gray-200'}`}
              >
                S/ {totalPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </button>
            )}
            {totalUsd > 0 && (
              <button
                type="button"
                onClick={() => toggleCurrency('USD')}
                title={currencyFilter === 'USD' ? 'Quitar filtro $' : 'Filtrar solo $'}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${currencyFilter === 'USD' ? 'bg-blue-700 text-white' : 'text-blue-700 hover:bg-blue-100'}`}
              >
                $ {totalUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </button>
            )}
          </div>

          {/* Contado */}
          {(totalPenContado > 0 || totalUsdContado > 0) && (
            <div className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm border transition-colors ${paymentTypeFilter === 'CONTADO' ? 'bg-primary-600 border-primary-600' : 'bg-primary-50 border-primary-200'}`}>
              <button
                type="button"
                onClick={() => togglePaymentType('CONTADO')}
                title={paymentTypeFilter === 'CONTADO' ? 'Quitar filtro Contado' : 'Filtrar solo Contado'}
                className={`text-xs font-semibold uppercase tracking-wide mr-1 ${paymentTypeFilter === 'CONTADO' ? 'text-white' : 'text-primary-700'}`}
              >
                Contado
              </button>
              {totalPenContado > 0 && (
                <button
                  type="button"
                  onClick={() => toggleCombo('PEN', 'CONTADO')}
                  title="Filtrar Contado en S/"
                  className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-colors ${currencyFilter === 'PEN' && paymentTypeFilter === 'CONTADO' ? 'bg-white text-primary-700' : paymentTypeFilter === 'CONTADO' ? 'text-white/90 hover:bg-white/20' : 'text-gray-700 hover:bg-primary-100'}`}
                >
                  S/ {totalPenContado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </button>
              )}
              {totalUsdContado > 0 && (
                <button
                  type="button"
                  onClick={() => toggleCombo('USD', 'CONTADO')}
                  title="Filtrar Contado en $"
                  className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-colors ${currencyFilter === 'USD' && paymentTypeFilter === 'CONTADO' ? 'bg-white text-blue-700' : paymentTypeFilter === 'CONTADO' ? 'text-white/90 hover:bg-white/20' : 'text-blue-700 hover:bg-primary-100'}`}
                >
                  $ {totalUsdContado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </button>
              )}
            </div>
          )}

          {/* Crédito */}
          {(totalPenCredito > 0 || totalUsdCredito > 0) && (
            <div className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm border transition-colors ${paymentTypeFilter === 'CREDITO' ? 'bg-orange-500 border-orange-500' : 'bg-orange-50 border-orange-200'}`}>
              <button
                type="button"
                onClick={() => togglePaymentType('CREDITO')}
                title={paymentTypeFilter === 'CREDITO' ? 'Quitar filtro Crédito' : 'Filtrar solo Crédito'}
                className={`text-xs font-semibold uppercase tracking-wide mr-1 ${paymentTypeFilter === 'CREDITO' ? 'text-white' : 'text-orange-700'}`}
              >
                Crédito
              </button>
              {totalPenCredito > 0 && (
                <button
                  type="button"
                  onClick={() => toggleCombo('PEN', 'CREDITO')}
                  title="Filtrar Crédito en S/"
                  className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-colors ${currencyFilter === 'PEN' && paymentTypeFilter === 'CREDITO' ? 'bg-white text-orange-700' : paymentTypeFilter === 'CREDITO' ? 'text-white/90 hover:bg-white/20' : 'text-gray-700 hover:bg-orange-100'}`}
                >
                  S/ {totalPenCredito.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </button>
              )}
              {totalUsdCredito > 0 && (
                <button
                  type="button"
                  onClick={() => toggleCombo('USD', 'CREDITO')}
                  title="Filtrar Crédito en $"
                  className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-colors ${currencyFilter === 'USD' && paymentTypeFilter === 'CREDITO' ? 'bg-white text-blue-700' : paymentTypeFilter === 'CREDITO' ? 'text-white/90 hover:bg-white/20' : 'text-blue-700 hover:bg-orange-100'}`}
                >
                  $ {totalUsdCredito.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </button>
              )}
            </div>
          )}

          {/* Limpiar filtros activos de moneda/tipo */}
          {(currencyFilter || paymentTypeFilter) && (
            <button
              type="button"
              onClick={() => updateParams({ currency: null, paymentType: null, page: null })}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              title="Quitar filtros de moneda/tipo"
            >
              <X size={13} /> Limpiar filtros
            </button>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={purchases}
        isLoading={isLoading}
        hoverClass="hover:bg-primary-50"
        renderSubRow={(purchase) => {
          if (!purchase.detraccionAmountPen) return null;
          return (
            <div className="mx-4 sm:mx-6 mb-2 -mt-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Percent size={14} /> Detracción (SPOT)
                </span>
                <span>
                  CxP separada:
                  <span className="ml-1 font-semibold tabular-nums">
                    S/ {purchase.detraccionAmountPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
                {purchase.detraccionDueDate && (
                  <span className="text-blue-600">
                    Vence: {formatDateEs(purchase.detraccionDueDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                )}
                <span className="text-blue-500">
                  Proveedor: Detracción - {purchase.supplier}
                </span>
              </div>
            </div>
          );
        }}
      />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      <Modal isOpen={!!grModal} onClose={() => setGrModal(null)} title="Guía de Remisión">
        {grModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Serie</label>
                <input
                  value={grModal.grSeries}
                  onChange={(e) => setGrModal({ ...grModal, grSeries: e.target.value.toUpperCase() })}
                  placeholder="T001"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correlativo</label>
                <input
                  value={grModal.grNumber}
                  onChange={(e) => setGrModal({ ...grModal, grNumber: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="00000001"
                  maxLength={8}
                  inputMode="numeric"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={grModal.grDate}
                  onChange={(e) => setGrModal({ ...grModal, grDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setGrModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGrSave}
                disabled={updateMeta.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {updateMeta.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      </>}
    </div>
  );
}

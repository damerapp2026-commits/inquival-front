import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePurchases, useUpdatePurchaseMeta } from '../hooks/usePurchases';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { Modal } from '../../../shared/components/Modal';
import { Plus, ShoppingCart, Eye, Wrench, Search, X, FileText } from 'lucide-react';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [grModal, setGrModal] = useState<{ purchaseId: string; grSeries: string; grNumber: string; grDate: string } | null>(null);
  const updateMeta = useUpdatePurchaseMeta();

  // Todo el estado vive en la URL para que "Atrás" desde el detalle restaure la página y filtros
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const activePreset = searchParams.get('preset') || '';
  const supplierParam = searchParams.get('supplier') || '';

  // Estado local solo para el input (se escribe sin tocar la URL hasta el debounce)
  const [supplierSearch, setSupplierSearch] = useState(supplierParam);

  // Sincronizar el input si la URL cambia externamente (navegación con Atrás/Adelante)
  useEffect(() => { setSupplierSearch(supplierParam); }, [supplierParam]);

  const updateParams = (updates: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (!v) sp.delete(k); else sp.set(k, v);
    }
    setSearchParams(sp, { replace: true });
  };

  const { data, isLoading } = usePurchases({
    page,
    limit: 20,
    supplier: supplierParam || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const purchases = data?.data || [];
  const total = data?.total || 0;
  const totalPen: number = (data as any)?.totalPen ?? 0;
  const totalUsd: number = (data as any)?.totalUsd ?? 0;
  const totalPenContado: number = (data as any)?.totalPenContado ?? 0;
  const totalUsdContado: number = (data as any)?.totalUsdContado ?? 0;
  const totalPenCredito: number = (data as any)?.totalPenCredito ?? 0;
  const totalUsdCredito: number = (data as any)?.totalUsdCredito ?? 0;

  const handleSupplierChange = (val: string) => {
    setSupplierSearch(val);
    clearTimeout((handleSupplierChange as any)._t);
    (handleSupplierChange as any)._t = setTimeout(() => {
      updateParams({ supplier: val || null, page: null });
    }, 400);
  };

  const applyPreset = (preset: typeof DATE_PRESETS[number]) => {
    const { start, end } = preset.getRange();
    updateParams({ startDate: start, endDate: end, preset: preset.id, page: null });
  };

  const clearDates = () => updateParams({ startDate: null, endDate: null, preset: null, page: null });

  const handleCustomDate = (field: 'start' | 'end', val: string) => {
    updateParams({ [field === 'start' ? 'startDate' : 'endDate']: val || null, preset: 'custom', page: null });
  };

  const setPage = (p: number) => updateParams({ page: p > 1 ? String(p) : null });

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
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${item.id}`); }} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium"><Eye size={15} /> Ver</button>
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
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Total general */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <span className="text-xs text-gray-500 font-medium">{total} compra{total !== 1 ? 's' : ''}</span>
            <span className="text-gray-300">|</span>
            <span className="font-semibold text-gray-800">
              S/ {totalPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {totalUsd > 0 && (
              <span className="font-semibold text-blue-700">
                · $ {totalUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            )}
          </div>

          {/* Contado */}
          {(totalPenContado > 0 || totalUsdContado > 0) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm">
              <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Contado</span>
              {totalPenContado > 0 && (
                <span className="font-semibold text-gray-800">
                  S/ {totalPenContado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
              {totalUsdContado > 0 && (
                <span className="font-semibold text-blue-700">
                  {totalPenContado > 0 ? '· ' : ''}$ {totalUsdContado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
              )}
            </div>
          )}

          {/* Crédito */}
          {(totalPenCredito > 0 || totalUsdCredito > 0) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm">
              <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Crédito</span>
              {totalPenCredito > 0 && (
                <span className="font-semibold text-gray-800">
                  S/ {totalPenCredito.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
              {totalUsdCredito > 0 && (
                <span className="font-semibold text-blue-700">
                  {totalPenCredito > 0 ? '· ' : ''}$ {totalUsdCredito.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <DataTable columns={columns} data={purchases} isLoading={isLoading} hoverClass="hover:bg-primary-50" />
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
    </div>
  );
}

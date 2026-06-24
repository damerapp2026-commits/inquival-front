import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCashRegisters, useCashRegisterById, useCloseCashRegister } from '../hooks/useCashRegister';
import { useUsers } from '../../users/hooks/useUsers';
import { useAuth } from '../../../app/providers/AuthProvider';
import { Pagination } from '../../../shared/components/Pagination';
import { Modal } from '../../../shared/components/Modal';
import {
  History, Wallet, Lock, ChevronDown, ChevronRight, Layers, Clock, ExternalLink,
  Eye, AlertCircle, ArrowUpCircle, ArrowDownCircle, ReceiptText, FileText, Calendar, Wrench,
} from 'lucide-react';
import type { CashRegister, CashRegisterEntry } from '../../../shared/types';
import { getTodayDateString, getMonthRange } from '../../../shared/utils/date.util';
import { groupEntries } from '../utils/groupEntries';

const categoryLabels: Record<string, string> = {
  SALE: 'Venta',
  CREDIT_PAYMENT: 'Pago Crédito',
  PURCHASE: 'Compra',
  ADJUSTMENT: 'Ajuste',
  SERVICES: 'Servicios',
  SALARY: 'Sueldos',
  SUPPLIES: 'Insumos',
  RENT: 'Alquiler',
  TRANSPORT: 'Transporte',
  OTHER: 'Otros',
};

const VENDOR_PALETTE = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];

function vendorColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return VENDOR_PALETTE[hash % VENDOR_PALETTE.length];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return '—'; }
}

function formatDDMMYYYY(date?: string) {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function formatPrettyDate(date?: string) {
  if (!date) return '';
  try {
    const d = new Date(date.includes('T') ? date : `${date}T00:00:00`);
    return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  } catch { return date; }
}

function sanitizeEntryDesc(desc: string): string {
  return desc.replace(/\s*·\s*TC\s+[\d.]+/g, '');
}

function methodFromDescription(desc: string) {
  const m = sanitizeEntryDesc(desc).match(/\[([^\]]+)\]$/);
  return m ? m[1] : null;
}

function stripMethod(desc: string) {
  return sanitizeEntryDesc(desc).replace(/\s*\[.*?\]\s*$/, '');
}

function legacyUsdAmount(desc: string): number | null {
  const m = desc.match(/\[USD\s+\$\s*([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function getEntryUsdAmount(e: { currency?: string; amountUsd?: number; description: string }): number | null {
  if (e.currency === 'USD' && e.amountUsd != null) return e.amountUsd;
  return legacyUsdAmount(e.description);
}

export function CashRegisterHistoryPage() {
  const navigate = useNavigate();
  const monthRange = getMonthRange();
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState(monthRange.start);
  const [endDate, setEndDate] = useState(monthRange.end);
  const [selectedId, setSelectedId] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeTarget, setCloseTarget] = useState<CashRegister | null>(null);
  const [closeNotes, setCloseNotes] = useState('');
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<'PEN' | 'USD' | null>(null);
  const [detailTab, setDetailTab] = useState<'PEN' | 'USD'>('PEN');

  const { data, isLoading } = useCashRegisters({ page, limit: 20, startDate: startDate || undefined, endDate: endDate || undefined });
  const { data: detail } = useCashRegisterById(selectedId);
  const closeRegister = useCloseCashRegister();
  const { data: usersData } = useUsers({ limit: 200 });
  const { user: currentUser } = useAuth();

  const userById = useMemo(() => {
    const list: any[] = Array.isArray(usersData) ? usersData : (usersData as any)?.data || [];
    const map: Record<string, string> = {};
    list.forEach((u) => { map[u.id] = u.fullName || u.username || ''; });
    if (currentUser?.id && !map[currentUser.id]) {
      map[currentUser.id] = currentUser.fullName || currentUser.username || '';
    }
    return map;
  }, [usersData, currentUser]);

  const registers: CashRegister[] = data?.data || [];
  const total = data?.total || 0;
  const today = getTodayDateString();

  const { uniqueMethods, uniqueVendors, hasUsdEntries } = useMemo(() => {
    const methods = new Set<string>();
    const vendors = new Set<string>();
    let usd = false;
    registers.forEach((r) => {
      r.entries.filter((e) => !e.isDeleted).forEach((e) => {
        const m = methodFromDescription(e.description);
        if (m) methods.add(m);
        if (e.createdBy) vendors.add(e.createdBy);
        if (getEntryUsdAmount(e) != null) usd = true;
      });
    });
    return { uniqueMethods: Array.from(methods).sort(), uniqueVendors: Array.from(vendors), hasUsdEntries: usd };
  }, [registers]);

  const passesFilter = (e: CashRegisterEntry): boolean => {
    if (methodFilter && methodFromDescription(e.description) !== methodFilter) return false;
    if (vendorFilter && e.createdBy !== vendorFilter) return false;
    if (currencyFilter === 'USD' && getEntryUsdAmount(e) == null) return false;
    if (currencyFilter === 'PEN' && getEntryUsdAmount(e) != null) return false;
    return true;
  };

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let incomeUsd = 0;
    let opens = 0;
    const methodMap = new Map<string, number>();
    registers.forEach((r) => {
      const active = r.entries.filter((e) => !e.isDeleted);
      active.filter((e) => e.type === 'INCOME').forEach((e) => {
        if (methodFilter && methodFromDescription(e.description) !== methodFilter) return;
        if (vendorFilter && e.createdBy !== vendorFilter) return;
        const usd = getEntryUsdAmount(e);
        if (usd != null) {
          incomeUsd += usd;
        } else {
          income += e.amount;
          const m = methodFromDescription(e.description);
          if (m) methodMap.set(m, (methodMap.get(m) || 0) + e.amount);
        }
      });
      active.filter((e) => e.type === 'EXPENSE').forEach((e) => {
        if (methodFilter && methodFromDescription(e.description) !== methodFilter) return;
        if (vendorFilter && e.createdBy !== vendorFilter) return;
        expense += e.amount;
      });
      if (r.status === 'OPEN') opens += 1;
    });
    const methodTotals = Array.from(methodMap.entries()).sort((a, b) => b[1] - a[1]);
    return { income, expense, incomeUsd, opens, count: registers.length, methodTotals };
  }, [registers, methodFilter, vendorFilter, currencyFilter]);

  const openDetail = (reg: CashRegister) => { setSelectedId(reg.id); setShowDetail(true); setDetailTab('PEN'); };
  const openClose = (reg: CashRegister) => { setCloseTarget(reg); setCloseNotes(''); setShowCloseModal(true); };
  const handleClose = async () => {
    if (!closeTarget) return;
    await closeRegister.mutateAsync({ registerId: closeTarget.id, data: { notes: closeNotes } });
    setShowCloseModal(false);
  };
  const goToSale = (saleId: string) => navigate(`/sales?openSaleId=${saleId}`);

  const detailEntries: CashRegisterEntry[] = (detail?.entries || []).filter((e: CashRegisterEntry) => !e.isDeleted);
  const detailGroups = useMemo(() => groupEntries(detailEntries), [detailEntries]);
  const detailHasUsd = useMemo(() => detailEntries.some(e => getEntryUsdAmount(e) != null), [detailEntries]);
  const detailEntriesForTab = useMemo(
    () => detailEntries.filter(e => detailTab === 'USD' ? getEntryUsdAmount(e) != null : getEntryUsdAmount(e) == null),
    [detailEntries, detailTab],
  );
  const detailGroupsForTab = useMemo(() => groupEntries(detailEntriesForTab), [detailEntriesForTab]);

  const detailMethodTotals = useMemo(() => {
    const allActive = (detail?.entries || []).filter((e: CashRegisterEntry) => !e.isDeleted && e.type === 'INCOME');
    const map = new Map<string, { pen: number; usd: number }>();
    allActive.forEach((e: CashRegisterEntry) => {
      const m = methodFromDescription(e.description) || 'Sin método';
      const usd = getEntryUsdAmount(e);
      const prev = map.get(m) || { pen: 0, usd: 0 };
      if (usd != null) map.set(m, { ...prev, usd: prev.usd + usd });
      else map.set(m, { ...prev, pen: prev.pen + e.amount });
    });
    return Array.from(map.entries())
      .filter(([, v]) => v.pen > 0 || v.usd > 0)
      .sort((a, b) => (b[1].pen + b[1].usd) - (a[1].pen + a[1].usd));
  }, [detail]);
  const [expandedDetailGroups, setExpandedDetailGroups] = useState<Set<string>>(new Set());
  const toggleDetailGroup = (id: string) => setExpandedDetailGroups((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const renderDetailEntry = (e: CashRegisterEntry, nested: boolean, key: React.Key) => {
    const method = methodFromDescription(e.description);
    const vendor = e.createdBy ? (userById[e.createdBy] || 'Usuario') : '';
    const isSale = e.referenceType === 'Sale' && !!e.referenceId;
    const descStripped = isSale ? stripMethod(e.description) : null;
    const clientFromDesc = descStripped && /^Venta\s+a\s+/i.test(descStripped)
      ? descStripped.replace(/^Venta\s+a\s+/i, '').trim()
      : null;
    const clientName = e.clientName || clientFromDesc;
    const displayClient = clientName && !/^sin\s*cliente$/i.test(clientName) ? clientName : null;
    const isPurchaseEntry = e.category === 'PURCHASE' && e.type === 'EXPENSE';
    const purchaseSupplier = isPurchaseEntry
      ? sanitizeEntryDesc(e.description).replace(/^[Cc]ompra\s+/i, '').split(':')[0].trim()
      : null;
    const voucherRef = (e.voucherSeries && e.voucherNumber) ? `${e.voucherSeries}-${e.voucherNumber}` : null;
    const isUsdEntry = getEntryUsdAmount(e) != null;
    return (
      <tr key={key} className={`${e.isDeleted ? 'opacity-50' : ''} ${nested ? 'bg-gray-50/50' : ''}`}>
        <td className={`px-3 py-2.5 ${nested ? 'pl-9' : ''}`}>
          <div className="flex items-center gap-1.5 text-gray-700 tabular-nums text-xs font-medium">
            <Clock size={11} className="text-gray-400" />
            {formatTime(e.createdAt)}
          </div>
        </td>
        <td className="px-3 py-2.5">
          {e.type === 'INCOME'
            ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700"><ArrowUpCircle size={10} /> Ingreso</span>
            : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700"><ArrowDownCircle size={10} /> Egreso</span>}
        </td>
        <td className="px-3 py-2.5 text-xs text-gray-600">{categoryLabels[e.category] || e.category}</td>
        <td className="px-3 py-2.5 text-xs text-gray-800">
          {isPurchaseEntry && purchaseSupplier
            ? <span className={e.isDeleted ? 'line-through text-gray-400' : 'font-medium'}>
                {purchaseSupplier}
                {voucherRef && <span className="font-normal text-gray-400 ml-1">({voucherRef})</span>}
              </span>
            : displayClient
            ? <span className={e.isDeleted ? 'line-through text-gray-400' : 'font-medium'}>{displayClient}</span>
            : <span className="text-gray-400 italic">—</span>}
        </td>
        <td className="px-3 py-2.5">
          {method
            ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{method}</span>
            : <span className="text-gray-300 text-xs">—</span>}
        </td>
        <td className="px-3 py-2.5">
          {vendor ? (
            <div className="inline-flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${vendorColor(vendor)}`}>{initialsFor(vendor)}</span>
              <span className="text-xs text-gray-600 truncate max-w-[100px]">{vendor.split(' ')[0]}</span>
            </div>
          ) : <span className="text-gray-300 text-xs">—</span>}
        </td>
        <td className="px-3 py-2.5 text-center">
          {e.voucherType === 'BOLETA' ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100"><ReceiptText size={10} /> Boleta</span>
            : e.voucherType === 'FACTURA' ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100"><FileText size={10} /> Factura</span>
            : <span className="text-gray-300 text-xs">—</span>}
        </td>
        <td className={`px-3 py-2.5 text-right text-xs font-semibold tabular-nums ${e.type === 'INCOME' ? (isUsdEntry ? 'text-emerald-600' : 'text-primary-700') : 'text-rose-600'}`}>
          {(() => {
            const usdAmt = getEntryUsdAmount(e);
            const isUsd = usdAmt != null;
            return isUsd
              ? <>{e.type === 'INCOME' ? '+' : '−'} $ {usdAmt!.toFixed(2)} <span className="text-[10px] font-bold">USD</span></>
              : <>{e.type === 'INCOME' ? '+' : '−'} S/ {e.amount.toFixed(2)}</>;
          })()}
        </td>
        <td className="px-3 py-2.5 text-center">
          {isSale && !nested && (
            <button onClick={() => goToSale(e.referenceId!)} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50" title="Ver venta"><ExternalLink size={13} /></button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
          <History size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Cajas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Revisa cierres anteriores y reconcilia operaciones pasadas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <Link to="/cash-register" className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-xl text-sm font-medium hover:border-primary-300 hover:text-primary-700 transition-colors">
          <Wallet size={15} /> Hoy
        </Link>
        <span className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold shadow-sm">
          <History size={15} /> Historial
        </span>
        <Link to="/cash-register/migrate" className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-sm font-medium hover:bg-amber-100 transition-colors" title="Reasignar ventas a su caja correcta">
          <Wrench size={14} /> Migrar ventas mal-asignadas
        </Link>
      </div>

      {/* Filter card */}
      <div className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 grid grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 sm:items-end">
            {hasUsdEntries && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Moneda</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setCurrencyFilter(currencyFilter === 'PEN' ? null : 'PEN')}
                    className={`px-3 py-2 transition-colors ${currencyFilter === 'PEN' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >S/</button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setCurrencyFilter(currencyFilter === 'USD' ? null : 'USD')}
                    className={`px-3 py-2 border-l border-gray-200 transition-colors ${currencyFilter === 'USD' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >$</button>
                </div>
              </div>
            )}
            {uniqueMethods.length > 0 && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Método de Pago</label>
                <select
                  value={methodFilter || ''}
                  onChange={(e) => setMethodFilter(e.target.value || null)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">Todos</option>
                  {uniqueMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            {uniqueVendors.length > 0 && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Vendedor</label>
                <select
                  value={vendorFilter || ''}
                  onChange={(e) => setVendorFilter(e.target.value || null)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">Todos</option>
                  {uniqueVendors.map((id) => <option key={id} value={id}>{userById[id] || id}</option>)}
                </select>
              </div>
            )}
            {(methodFilter || vendorFilter || currencyFilter) && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setMethodFilter(null); setVendorFilter(null); setCurrencyFilter(null); }}
                className="text-sm text-rose-500 hover:underline font-medium self-end pb-2"
              >Limpiar filtros</button>
            )}
          </div>
          {(startDate !== monthRange.start || endDate !== monthRange.end) && (
            <button
              onClick={() => { setStartDate(monthRange.start); setEndDate(monthRange.end); setPage(1); }}
              className="text-sm text-primary-600 hover:underline font-medium"
            >Mes actual</button>
          )}
        </div>
        {(summary.methodTotals.length > 0 || summary.incomeUsd > 0) && (
          <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-gray-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mr-1">Ingresos del período</span>
            {summary.methodTotals.map(([method, amount]) => (
              <span key={method} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                {method}: S/ {amount.toFixed(2)}
              </span>
            ))}
            {summary.incomeUsd > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
                $ {summary.incomeUsd.toFixed(2)} USD
              </span>
            )}
          </div>
        )}
      </div>

      {/* Period summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Calendar} label="Cajas" value={`${summary.count}`} accent="bg-gray-100 text-gray-700" />
        <KpiTile icon={ArrowUpCircle} label="Ingresos" value={`S/ ${summary.income.toFixed(2)}`} accent="bg-primary-100 text-primary-700" valueAccent="text-primary-700" subValue={summary.incomeUsd > 0 ? `+ $ ${summary.incomeUsd.toFixed(2)} USD` : undefined} />
        <KpiTile icon={ArrowDownCircle} label="Egresos" value={`S/ ${summary.expense.toFixed(2)}`} accent="bg-rose-100 text-rose-600" valueAccent="text-rose-600" />
        <KpiTile icon={Lock} label="Abiertas" value={`${summary.opens}`} accent="bg-amber-100 text-amber-700" valueAccent="text-amber-700" />
      </div>

      {/* Registers list */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Cajas del periodo</h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
          </div>
        ) : registers.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <AlertCircle size={22} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">No hay cajas en este rango</p>
            <p className="text-xs text-gray-400 mt-1">Ajusta las fechas para revisar otros periodos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/60">
                  <th className="px-4 sm:px-6 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-right">Apertura</th>
                  <th className="px-4 py-3 text-right">Ingresos</th>
                  <th className="px-4 py-3 text-right">Egresos</th>
                  <th className="px-4 py-3 text-right">Cierre</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registers.map((reg) => {
                  const active = reg.entries.filter((e) => !e.isDeleted);
                  const filtered = active.filter(passesFilter);
                  const income = filtered.filter((e) => e.type === 'INCOME' && getEntryUsdAmount(e) == null).reduce((s, e) => s + e.amount, 0);
                  const incomeUsdRow = filtered.filter((e) => e.type === 'INCOME').reduce((s, e) => s + (getEntryUsdAmount(e) ?? 0), 0);
                  const expense = filtered.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
                  return (
                    <tr key={reg.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 text-primary-700 flex items-center justify-center text-[11px] font-bold uppercase">
                            {formatPrettyDate(reg.date).split(' ')[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800 text-sm capitalize">{formatPrettyDate(reg.date)}</div>
                            <div className="text-[11px] text-gray-400 tabular-nums">{reg.date}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-700">S/ {reg.openingBalance.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-primary-700">
                        <div>+ S/ {income.toFixed(2)}</div>
                        {incomeUsdRow > 0 && <div className="text-emerald-600 text-[11px]">+ $ {incomeUsdRow.toFixed(2)}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-rose-600">− S/ {expense.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-gray-800">
                        {reg.closingBalance != null ? <div>S/ {reg.closingBalance.toFixed(2)}</div> : <span className="text-gray-300 font-normal">—</span>}
                        {reg.closingBalanceUsd != null && <div className="text-xs font-semibold text-emerald-600">$ {reg.closingBalanceUsd.toFixed(2)}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${reg.status === 'CLOSED' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${reg.status === 'CLOSED' ? 'bg-gray-400' : 'bg-emerald-500 animate-pulse'}`} />
                          {reg.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => openDetail(reg)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="Ver detalle"><Eye size={15} /></button>
                          {reg.status === 'OPEN' && reg.date !== today && (
                            <button onClick={() => openClose(reg)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-100" title="Cerrar caja">
                              <Lock size={12} /> Cerrar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      {/* Detail modal */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`Detalle · ${formatDDMMYYYY(detail?.date)}`} size="xl">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${detail?.status === 'CLOSED' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${detail?.status === 'CLOSED' ? 'bg-gray-400' : 'bg-emerald-500'}`} />
              {detail?.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}
            </span>
            {detail?.notes && <span className="text-gray-500 text-xs">Notas: {detail.notes}</span>}
            {detail?.closedBy && userById[detail.closedBy] && (
              <span className="text-xs text-gray-500">· Cerrada por <strong>{userById[detail.closedBy]}</strong></span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Caja S/</div>
              {(() => {
                const penEntries = detailEntries.filter(e => !e.isDeleted && getEntryUsdAmount(e) == null);
                const penIncome = penEntries.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
                const penExpense = penEntries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
                return (
                  <>
                    <div className="flex justify-between"><span className="text-gray-500">Apertura</span><span className="font-semibold tabular-nums">S/ {(detail?.openingBalance || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between text-primary-700"><span>+ Ingresos</span><span className="font-semibold tabular-nums">S/ {penIncome.toFixed(2)}</span></div>
                    <div className="flex justify-between text-rose-600"><span>− Egresos</span><span className="font-semibold tabular-nums">S/ {penExpense.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold pt-2 border-t border-gray-200 mt-1"><span>Cierre</span><span className="tabular-nums">{detail?.closingBalance != null ? `S/ ${detail.closingBalance.toFixed(2)}` : '—'}</span></div>
                  </>
                );
              })()}
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">Caja $</div>
              {(() => {
                const usdEntries = detailEntries.filter(e => !e.isDeleted && getEntryUsdAmount(e) != null);
                const usdIncome = usdEntries.filter(e => e.type === 'INCOME').reduce((s, e) => s + (getEntryUsdAmount(e) ?? 0), 0);
                const usdExpense = usdEntries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + (getEntryUsdAmount(e) ?? e.amount ?? 0), 0);
                return (
                  <>
                    <div className="flex justify-between"><span className="text-gray-500">Apertura</span><span className="font-semibold tabular-nums">$ {(detail?.openingBalanceUsd || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between text-emerald-600"><span>+ Ingresos</span><span className="font-semibold tabular-nums">$ {usdIncome.toFixed(2)}</span></div>
                    <div className="flex justify-between text-rose-600"><span>− Egresos</span><span className="font-semibold tabular-nums">$ {usdExpense.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-emerald-700 pt-2 border-t border-emerald-200 mt-1"><span>Cierre</span><span className="tabular-nums">{detail?.closingBalanceUsd != null ? `$ ${detail.closingBalanceUsd.toFixed(2)}` : '—'}</span></div>
                  </>
                );
              })()}
            </div>
          </div>

          {detailMethodTotals.length > 0 && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Ingresos por método de pago</span>
              </div>
              <div className="divide-y divide-gray-100">
                {detailMethodTotals.map(([method, totals]) => (
                  <div key={method} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{method}</span>
                    <div className="flex items-center gap-3 tabular-nums font-semibold">
                      {totals.pen > 0 && <span className="text-primary-700">+ S/ {totals.pen.toFixed(2)}</span>}
                      {totals.usd > 0 && <span className="text-emerald-600">+ $ {totals.usd.toFixed(2)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detailHasUsd && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button
                onClick={() => setDetailTab('PEN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${detailTab === 'PEN' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Wallet size={12} /> Caja S/
              </button>
              <button
                onClick={() => setDetailTab('USD')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${detailTab === 'USD' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Wallet size={12} /> Caja $
              </button>
            </div>
          )}

          <div className="border border-gray-100 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50/95 backdrop-blur">
                <tr className="border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Hora</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Categoría</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Método de Pago</th>
                  <th className="px-3 py-2 text-left">Vendedor</th>
                  <th className="px-3 py-2 text-center">Comprobante</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detailGroupsForTab.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-xs">Sin movimientos</td></tr>
                )}
                {detailGroupsForTab.map((g, gi) => {
                  if (!g.groupId || g.entries.length === 1) {
                    return renderDetailEntry(g.entries[0], false, gi);
                  }
                  const isOpen = expandedDetailGroups.has(g.groupId);
                  const first = g.entries[0];
                  const total = g.total ?? g.entries.reduce((s, e) => s + e.amount, 0);
                  const baseDesc = stripMethod(first.description.replace(/\s*\(\d+ de \d+\)\s*$/, ''));
                  const vendor = first.createdBy ? (userById[first.createdBy] || 'Usuario') : '';
                  return (
                    <React.Fragment key={g.groupId}>
                      <tr onClick={() => toggleDetailGroup(g.groupId!)} className={`cursor-pointer transition-colors ${first.type === 'INCOME' ? 'bg-emerald-50/40 hover:bg-emerald-50' : 'bg-rose-50/40 hover:bg-rose-50'}`}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 text-gray-700 tabular-nums text-xs font-medium">
                            <Clock size={11} className="text-gray-400" />
                            {formatTime(first.createdAt)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 text-xs">
                            {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            {first.type === 'INCOME'
                              ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Ingreso</span>
                              : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">Egreso</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs">{categoryLabels[first.category] || first.category}</td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold mr-1.5">
                            <Layers size={10} /> Grupo · {g.entries.length}
                          </span>
                          <span className="font-medium">{baseDesc}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center"><span className="text-gray-300 text-xs">—</span></td>
                        <td className="px-3 py-2.5">
                          {vendor ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${vendorColor(vendor)}`}>{initialsFor(vendor)}</span>
                              <span className="text-xs text-gray-600 truncate max-w-[100px]">{vendor.split(' ')[0]}</span>
                            </div>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center"><span className="text-gray-300 text-xs">—</span></td>
                        <td className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${first.type === 'INCOME' ? 'text-primary-700' : 'text-rose-600'}`}>
                          {first.type === 'INCOME' ? '+' : '−'} S/ {total.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5" />
                      </tr>
                      {isOpen && g.entries.map((e) => renderDetailEntry(e, true, `${g.groupId}-${e.id}`))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Close modal */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title={`Cerrar caja · ${closeTarget?.date || ''}`}>
        <div className="space-y-4">
          <div className="flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-sm text-amber-800">Esta caja quedó abierta. Al cerrarla no se podrán modificar sus entradas.</p>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Saldo apertura</span><span className="font-semibold tabular-nums">S/ {(closeTarget?.openingBalance || 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-primary-700"><span>+ Ingresos</span><span className="font-semibold tabular-nums">S/ {(closeTarget?.entries.filter(e => !e.isDeleted && e.type === 'INCOME').reduce((s, e) => s + e.amount, 0) || 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-rose-600"><span>− Egresos</span><span className="font-semibold tabular-nums">S/ {(closeTarget?.entries.filter(e => !e.isDeleted && e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0) || 0).toFixed(2)}</span></div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Notas <span className="text-gray-400 normal-case font-normal">— opcional</span></label>
            <textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" rows={2} />
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowCloseModal(false)} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button onClick={handleClose} disabled={closeRegister.isPending} className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl hover:bg-gray-900 disabled:opacity-50 font-semibold shadow-sm">
              {closeRegister.isPending ? 'Cerrando...' : 'Confirmar cierre'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, accent, valueAccent, subValue }: { icon: any; label: string; value: string; accent: string; valueAccent?: string; subValue?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}><Icon size={14} /></div>
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueAccent || 'text-gray-800'}`}>{value}</div>
      {subValue && <div className="text-sm font-semibold tabular-nums text-emerald-600 mt-0.5">{subValue}</div>}
    </div>
  );
}

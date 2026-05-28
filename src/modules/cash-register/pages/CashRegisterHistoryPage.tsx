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
  const m = sanitizeEntryDesc(desc).match(/\[(.+?)\]$/);
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

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let incomeUsd = 0;
    let opens = 0;
    registers.forEach((r) => {
      const active = r.entries.filter((e) => !e.isDeleted);
      income += active.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
      expense += active.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
      active.filter((e) => e.type === 'INCOME').forEach((e) => {
        const usd = getEntryUsdAmount(e);
        if (usd != null) incomeUsd += usd;
      });
      if (r.status === 'OPEN') opens += 1;
    });
    return { income, expense, incomeUsd, opens, count: registers.length };
  }, [registers]);

  const openDetail = (reg: CashRegister) => { setSelectedId(reg.id); setShowDetail(true); };
  const openClose = (reg: CashRegister) => { setCloseTarget(reg); setCloseNotes(''); setShowCloseModal(true); };
  const handleClose = async () => {
    if (!closeTarget) return;
    await closeRegister.mutateAsync({ registerId: closeTarget.id, data: { notes: closeNotes } });
    setShowCloseModal(false);
  };
  const goToSale = (saleId: string) => navigate(`/sales?openSaleId=${saleId}`);

  const detailEntries: CashRegisterEntry[] = (detail?.entries || []).filter((e: CashRegisterEntry) => !e.isDeleted);
  const detailGroups = useMemo(() => groupEntries(detailEntries), [detailEntries]);
  const [expandedDetailGroups, setExpandedDetailGroups] = useState<Set<string>>(new Set());
  const toggleDetailGroup = (id: string) => setExpandedDetailGroups((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const renderDetailEntry = (e: CashRegisterEntry, nested: boolean, key: React.Key) => {
    const description = stripMethod(e.description);
    const method = methodFromDescription(e.description);
    const vendor = e.createdBy ? (userById[e.createdBy] || 'Usuario') : '';
    const isSale = e.referenceType === 'Sale' && !!e.referenceId;
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
          <span className={e.isDeleted ? 'line-through text-gray-400' : ''}>{description}</span>
          {method && <span className="ml-2 text-[10px] text-blue-700 font-medium">[{method}]</span>}
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
        <td className={`px-3 py-2.5 text-right text-xs font-semibold tabular-nums ${e.type === 'INCOME' ? 'text-primary-700' : 'text-rose-600'}`}>
          {e.type === 'INCOME' ? '+' : '−'} S/ {e.amount.toFixed(2)}
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
      <div className="bg-white rounded-2xl shadow-card p-5 flex flex-col sm:flex-row sm:items-end gap-4">
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
        {(startDate !== monthRange.start || endDate !== monthRange.end) && (
          <button
            onClick={() => { setStartDate(monthRange.start); setEndDate(monthRange.end); setPage(1); }}
            className="text-sm text-primary-600 hover:underline font-medium"
          >Mes actual</button>
        )}
      </div>

      {/* Period summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Calendar} label="Cajas" value={`${summary.count}`} accent="bg-gray-100 text-gray-700" />
        <KpiTile icon={ArrowUpCircle} label="Ingresos" value={`S/ ${summary.income.toFixed(2)}`} accent="bg-primary-100 text-primary-700" valueAccent="text-primary-700" />
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
                  const incomeEntries = active.filter((e) => e.type === 'INCOME');
                  const income = incomeEntries.reduce((s, e) => s + e.amount, 0);
                  const expense = active.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);

                  // Per-method totals (income only)
                  const methodMap = new Map<string, number>();
                  let regUsdTotal = 0;
                  incomeEntries.forEach((e) => {
                    const m = methodFromDescription(e.description);
                    if (m) methodMap.set(m, (methodMap.get(m) || 0) + e.amount);
                    const usd = getEntryUsdAmount(e);
                    if (usd != null) regUsdTotal += usd;
                  });
                  const methodTotals = Array.from(methodMap.entries()).sort((a, b) => b[1] - a[1]);

                  return (
                    <React.Fragment key={reg.id}>
                      <tr className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 sm:px-6 pt-3.5 pb-1 whitespace-nowrap">
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
                        <td className="px-4 pt-3.5 pb-1 text-right tabular-nums text-gray-700">S/ {reg.openingBalance.toFixed(2)}</td>
                        <td className="px-4 pt-3.5 pb-1 text-right tabular-nums font-semibold text-primary-700">+ S/ {income.toFixed(2)}</td>
                        <td className="px-4 pt-3.5 pb-1 text-right tabular-nums font-semibold text-rose-600">− S/ {expense.toFixed(2)}</td>
                        <td className="px-4 pt-3.5 pb-1 text-right tabular-nums font-bold text-gray-800">
                          {reg.closingBalance != null ? `S/ ${reg.closingBalance.toFixed(2)}` : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                        <td className="px-4 pt-3.5 pb-1 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${reg.status === 'CLOSED' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${reg.status === 'CLOSED' ? 'bg-gray-400' : 'bg-emerald-500 animate-pulse'}`} />
                            {reg.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 pt-3.5 pb-1 text-right">
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
                      {/* Method breakdown row */}
                      {(methodTotals.length > 0 || regUsdTotal > 0) && (
                        <tr className="hover:bg-gray-50/60 transition-colors">
                          <td colSpan={7} className="px-4 sm:px-6 pt-0 pb-3">
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {methodTotals.map(([method, amount]) => (
                                <span key={method} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-100">
                                  {method}: S/ {amount.toFixed(2)}
                                </span>
                              ))}
                              {regUsdTotal > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-100">
                                  $ {regUsdTotal.toFixed(2)} USD
                                </span>
                              )}
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
        )}
      </div>

      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      {/* Detail modal */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`Detalle · ${detail?.date || ''}`} size="xl">
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

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Apertura</div>
              <div className="font-bold tabular-nums text-gray-800 mt-1">S/ {(detail?.openingBalance || 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Ingresos</div>
              <div className="font-bold tabular-nums text-primary-700 mt-1">+ S/ {detailEntries.filter(e => !e.isDeleted && e.type === 'INCOME').reduce((s, e) => s + e.amount, 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Egresos</div>
              <div className="font-bold tabular-nums text-rose-600 mt-1">− S/ {detailEntries.filter(e => !e.isDeleted && e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Cierre</div>
              <div className="font-bold tabular-nums text-gray-800 mt-1">{detail?.closingBalance != null ? `S/ ${detail.closingBalance.toFixed(2)}` : '—'}</div>
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50/95 backdrop-blur">
                <tr className="border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Hora</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Categoría</th>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-left">Vendedor</th>
                  <th className="px-3 py-2 text-center">Comprobante</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detailGroups.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400 text-xs">Sin movimientos</td></tr>
                )}
                {detailGroups.map((g, gi) => {
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

function KpiTile({ icon: Icon, label, value, accent, valueAccent }: { icon: any; label: string; value: string; accent: string; valueAccent?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}><Icon size={14} /></div>
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueAccent || 'text-gray-800'}`}>{value}</div>
    </div>
  );
}

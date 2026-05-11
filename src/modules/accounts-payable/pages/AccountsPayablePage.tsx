import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAccountsPayable, useAccountPayableById, useRegisterAPPayment, useUpdateNumeroUnico } from '../hooks/useAccountsPayable';
import { usePaymentAgreements, useCreatePaymentAgreement, useRegisterAgreementPayment, useCancelPaymentAgreement } from '../hooks/usePaymentAgreements';
import { Modal } from '../../../shared/components/Modal';
import {
  FileText, DollarSign, AlertCircle, Eye, Clock, CheckCircle, Hash, Save,
  ChevronLeft, ChevronRight, CalendarDays, X, Plus, Trash2, Ban, ClipboardList, Wand2, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { AccountPayable, AccountPayableInstallment, AccountPayablePayment, PaymentAgreement, AgreementInstallment, AgreementPayment } from '../../../shared/types';

// ─── NumeroUnicoEditor ───────────────────────────────────────────────────────
function NumeroUnicoEditor({ apId, installmentId, value, onSave, isPending, placeholder = 'N° único del banco' }: { apId: string; installmentId?: string; value?: string; onSave: (v: string) => void; isPending: boolean; placeholder?: string }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value, apId, installmentId]);
  const dirty = draft.trim() !== (value || '').trim();
  return (
    <div className="flex items-center gap-1">
      <div className="relative flex-1">
        <Hash size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder}
          className={`w-full pl-7 pr-2 py-1 border rounded text-xs ${!value ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`} />
      </div>
      {dirty && (
        <button type="button" onClick={() => onSave(draft.trim())} disabled={isPending}
          className="px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 disabled:opacity-50 flex items-center gap-0.5">
          <Save size={11} />
        </button>
      )}
    </div>
  );
}

// ─── Calendar helpers ────────────────────────────────────────────────────────
type DayPayment = { apId: string; supplier: string; purchaseRef?: string; amount: number; isOverdue: boolean; ap: AccountPayable; installmentId?: string; installmentIndex?: number; };

function groupPaymentsByDate(accounts: AccountPayable[]): Record<string, DayPayment[]> {
  const groups: Record<string, DayPayment[]> = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const ap of accounts) {
    if (ap.status === 'PAID' || ap.status === 'CONSOLIDATED') continue;
    if (ap.paymentScheduleType === 'INSTALLMENTS') {
      (ap.installments || []).forEach((inst, i) => {
        if (inst.status === 'PAID') return;
        const dateStr = inst.dueDate.slice(0, 10);
        const dueDate = new Date(dateStr + 'T00:00:00');
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push({ apId: ap.id, supplier: ap.supplier, purchaseRef: ap.purchaseRef, amount: inst.amount, isOverdue: dueDate < today, ap, installmentId: inst.id, installmentIndex: i + 1 });
      });
    } else if (ap.dueDate) {
      const dateStr = ap.dueDate.slice(0, 10);
      const dueDate = new Date(dateStr + 'T00:00:00');
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push({ apId: ap.id, supplier: ap.supplier, purchaseRef: ap.purchaseRef, amount: ap.pendingAmount, isOverdue: dueDate < today, ap });
    }
  }
  return groups;
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Status helpers ──────────────────────────────────────────────────────────
const apStatusLabels: Record<string, { label: string; cls: string }> = {
  PENDING:      { label: 'Pendiente',    cls: 'bg-yellow-100 text-yellow-800' },
  PARTIAL:      { label: 'Parcial',      cls: 'bg-blue-100 text-blue-800' },
  PAID:         { label: 'Pagado',       cls: 'bg-primary-100 text-primary-800' },
  CONSOLIDATED: { label: 'Consolidado',  cls: 'bg-purple-100 text-purple-800' },
};
const agStatusLabels: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Pendiente',  cls: 'bg-yellow-100 text-yellow-800' },
  PARTIAL:   { label: 'Parcial',    cls: 'bg-blue-100 text-blue-800' },
  PAID:      { label: 'Pagado',     cls: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Anulado',    cls: 'bg-gray-100 text-gray-500' },
};

// ─── Currency helpers ────────────────────────────────────────────────────────
const symFor = (ap?: { currency?: 'PEN' | 'USD' } | null): string => (ap?.currency === 'USD' ? '$' : 'S/');
type Buckets = { pen: number; usd: number };
const emptyBuckets = (): Buckets => ({ pen: 0, usd: 0 });
const addToBucket = (b: Buckets, amount: number, currency?: 'PEN' | 'USD') => {
  if (currency === 'USD') b.usd += amount; else b.pen += amount;
};
const fmtBuckets = (b: Buckets): string => {
  const parts: string[] = [];
  if (b.pen > 0) parts.push(`S/ ${b.pen.toFixed(2)}`);
  if (b.usd > 0) parts.push(`$ ${b.usd.toFixed(2)}`);
  return parts.length ? parts.join(' + ') : 'S/ 0.00';
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export function AccountsPayablePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'calendar' | 'agreements'>('calendar');
  const [supplierSearch, setSupplierSearch] = useState('');

  // ── Calendar state ──
  const [selectedDate, setSelectedDate] = useState<string | null>(() => searchParams.get('date'));
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = searchParams.get('date'); return d ? new Date(d + 'T00:00:00') : new Date();
  });
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedAP, setSelectedAP] = useState<AccountPayable | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, codigoTransferencia: '', notes: '' });

  // ── Agreements state ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAgPayModal, setShowAgPayModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<PaymentAgreement | null>(null);
  const [agPayForm, setAgPayForm] = useState({ amount: 0, codigoTransferencia: '', notes: '' });
  const [cancelReason, setCancelReason] = useState('');

  // ── Create agreement form state ──
  const [createSupplier, setCreateSupplier] = useState('');
  const [createSelectedIds, setCreateSelectedIds] = useState<Set<string>>(new Set());
  const [createSchedule, setCreateSchedule] = useState<'SINGLE_DATE' | 'INSTALLMENTS'>('SINGLE_DATE');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createInstallments, setCreateInstallments] = useState<{ amount: number; dueDate: string }[]>([{ amount: 0, dueDate: '' }]);
  const [createCurrency, setCreateCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [createInstallmentCount, setCreateInstallmentCount] = useState(3);

  // ── Data ──
  const { data, isLoading } = useAccountsPayable({ limit: 500 });
  const { data: detailAP } = useAccountPayableById(viewingId);
  const { data: agreements = [], isLoading: agLoading } = usePaymentAgreements();
  const registerAPPayment = useRegisterAPPayment();
  const updateNumero = useUpdateNumeroUnico();
  const createAgreement = useCreatePaymentAgreement();
  const registerAgPayment = useRegisterAgreementPayment();
  const cancelAgreement = useCancelPaymentAgreement();

  const allAccounts: AccountPayable[] = data?.data || [];
  const normalizedSearch = supplierSearch.trim().toLowerCase();
  const activeAccounts = useMemo(() => {
    const base = allAccounts.filter(ap => ap.status !== 'PAID' && ap.status !== 'CONSOLIDATED');
    if (!normalizedSearch) return base;
    return base.filter(ap => (ap.supplier || '').toLowerCase().includes(normalizedSearch));
  }, [allAccounts, normalizedSearch]);
  const paymentsByDate = useMemo(() => groupPaymentsByDate(activeAccounts), [activeAccounts]);
  const selectedPayments = selectedDate ? (paymentsByDate[selectedDate] || []) : [];

  const filteredAgreements = useMemo(() => {
    if (!normalizedSearch) return agreements;
    return (agreements as PaymentAgreement[]).filter(ag => (ag.supplier || '').toLowerCase().includes(normalizedSearch));
  }, [agreements, normalizedSearch]);

  // Flat list of every pending payment with its date and days-until-due
  const allPending = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const list: (DayPayment & { dateStr: string; daysDiff: number })[] = [];
    Object.entries(paymentsByDate).forEach(([dateStr, payments]) => {
      const dueMs = new Date(dateStr + 'T00:00:00').getTime();
      const daysDiff = Math.ceil((dueMs - todayMs) / 86400000);
      payments.forEach(p => list.push({ ...p, dateStr, daysDiff }));
    });
    return list;
  }, [paymentsByDate]);

  const summary = useMemo(() => {
    const overdue = emptyBuckets(), next7 = emptyBuckets(), total = emptyBuckets();
    let overdueCount = 0, next7Count = 0;
    allPending.forEach(p => {
      addToBucket(total, p.amount, p.ap.currency);
      if (p.daysDiff < 0) { addToBucket(overdue, p.amount, p.ap.currency); overdueCount++; }
      else if (p.daysDiff <= 7) { addToBucket(next7, p.amount, p.ap.currency); next7Count++; }
    });
    return { overdue, overdueCount, next7, next7Count, total, totalCount: allPending.length };
  }, [allPending]);

  // Pending grouped by supplier — overdue suppliers first, then by earliest due date
  const pendingBySupplier = useMemo(() => {
    const map: Record<string, typeof allPending> = {};
    allPending.forEach(p => { if (!map[p.supplier]) map[p.supplier] = []; map[p.supplier].push(p); });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.dateStr.localeCompare(b.dateStr)));
    return Object.entries(map)
      .map(([supplier, items]) => ({
        supplier,
        items,
        earliestDate: items[0].dateStr,
        hasOverdue: items.some(i => i.isOverdue),
        total: items.reduce((acc, p) => { addToBucket(acc, p.amount, p.ap.currency); return acc; }, emptyBuckets()),
      }))
      .sort((a, b) => {
        if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
        return a.earliestDate.localeCompare(b.earliestDate);
      });
  }, [allPending]);

  // Suppliers with active (non-CONSOLIDATED, non-PAID) APs for the create modal
  const supplierOptions = useMemo(() => {
    const map: Record<string, AccountPayable[]> = {};
    allAccounts.filter(ap => ap.status === 'PENDING' || ap.status === 'PARTIAL').forEach(ap => {
      if (!map[ap.supplier]) map[ap.supplier] = [];
      map[ap.supplier].push(ap);
    });
    return map;
  }, [allAccounts]);

  const supplierAPs = createSupplier ? (supplierOptions[createSupplier] || []) : [];
  const createTotal = useMemo(() =>
    supplierAPs.filter(ap => createSelectedIds.has(ap.id)).reduce((s, ap) => s + ap.pendingAmount, 0),
    [supplierAPs, createSelectedIds]
  );
  const createTotalBuckets = useMemo(() =>
    supplierAPs.filter(ap => createSelectedIds.has(ap.id)).reduce((acc, ap) => { addToBucket(acc, ap.pendingAmount, ap.currency); return acc; }, emptyBuckets()),
    [supplierAPs, createSelectedIds]
  );

  useEffect(() => {
    const d = searchParams.get('date');
    if (d && d !== selectedDate) { setSelectedDate(d); setCurrentMonth(new Date(d + 'T00:00:00')); }
  }, [searchParams]);

  // ── Calendar helpers ──
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear(); const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0);
    const days: (string | null)[] = [];
    const startDow = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(toDateStr(new Date(year, month, d)));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth]);

  const todayStr = toDateStr(new Date());
  const getDayColor = (dateStr: string): 'red' | 'yellow' | 'blue' | null => {
    const payments = paymentsByDate[dateStr];
    if (!payments?.length) return null;
    if (payments.some(p => p.isOverdue)) return 'red';
    const diff = Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000);
    return diff <= 3 ? 'yellow' : 'blue';
  };
  const colorStyle = {
    red:    { cell: 'border-red-200 bg-red-50 hover:bg-red-100',           selected: 'bg-red-600 text-white border-red-600',           count: 'text-red-700' },
    yellow: { cell: 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100',  selected: 'bg-yellow-500 text-white border-yellow-500',     count: 'text-yellow-700' },
    blue:   { cell: 'border-primary-100 bg-primary-50 hover:bg-primary-100', selected: 'bg-primary-600 text-white border-primary-600', count: 'text-primary-700' },
  };
  const handleDayClick = (dateStr: string) => {
    const next = selectedDate === dateStr ? null : dateStr;
    setSelectedDate(next);
    if (next) setSearchParams({ date: next }, { replace: true }); else setSearchParams({}, { replace: true });
  };

  // ── AP payment helpers ──
  const getNextInstallment = (ap: AccountPayable) =>
    ap.paymentScheduleType === 'INSTALLMENTS' ? (ap.installments?.find(i => i.status === 'PENDING') || null) : null;

  const openAPPayment = (ap: AccountPayable) => {
    setSelectedAP(ap);
    const next = getNextInstallment(ap);
    setPayForm({ amount: next ? next.amount : 0, codigoTransferencia: '', notes: '' });
    setShowPayModal(true);
  };
  const nextInstallment = selectedAP ? getNextInstallment(selectedAP) : null;
  const exceedsPending = selectedAP ? payForm.amount > selectedAP.pendingAmount : false;
  const handleAPPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exceedsPending) return;
    await registerAPPayment.mutateAsync({ apId: selectedAP!.id, data: payForm });
    setShowPayModal(false);
  };

  const getDueDateColor = (ap: AccountPayable) => {
    if (ap.status === 'PAID') return 'text-primary-600';
    const due = ap.paymentScheduleType === 'INSTALLMENTS' ? ap.installments?.find(i => i.status === 'PENDING')?.dueDate : ap.dueDate;
    if (!due) return 'text-gray-500';
    const diff = Math.ceil((new Date(due).getTime() - new Date().getTime()) / 86400000);
    if (diff < 0) return 'text-red-600 font-bold';
    if (diff <= 3) return 'text-yellow-600 font-medium';
    return 'text-primary-600';
  };
  const formatSelectedDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Agreement helpers ──
  const openAgPayment = (ag: PaymentAgreement) => {
    setSelectedAgreement(ag);
    const nextInst = ag.paymentScheduleType === 'INSTALLMENTS' ? ag.installments.find(i => i.status === 'PENDING') : null;
    setAgPayForm({ amount: nextInst ? nextInst.amount : 0, codigoTransferencia: '', notes: '' });
    setShowAgPayModal(true);
  };
  const agExceedsPending = selectedAgreement ? agPayForm.amount > selectedAgreement.pendingAmount : false;
  const handleAgPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (agExceedsPending || !selectedAgreement) return;
    await registerAgPayment.mutateAsync({ id: selectedAgreement.id, data: agPayForm });
    setShowAgPayModal(false);
  };

  const handleCancelAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgreement) return;
    await cancelAgreement.mutateAsync({ id: selectedAgreement.id, reason: cancelReason });
    setShowCancelModal(false); setCancelReason('');
  };

  // ── Create agreement helpers ──
  const resetCreateForm = () => {
    setCreateSupplier(''); setCreateSelectedIds(new Set());
    setCreateSchedule('SINGLE_DATE'); setCreateDueDate('');
    setCreateInstallments([{ amount: 0, dueDate: '' }]);
    setCreateCurrency('PEN'); setCreateInstallmentCount(3);
  };

  const generateAgreementInstallments = () => {
    if (createInstallmentCount < 1) return;
    if (createTotal <= 0) { toast.error('Selecciona las facturas primero'); return; }
    const base = Math.round((createTotal / createInstallmentCount) * 100) / 100;
    const todayBase = new Date().toISOString().slice(0, 10);
    const result: { amount: number; dueDate: string }[] = [];
    let accumulated = 0;
    for (let i = 0; i < createInstallmentCount; i++) {
      const due = new Date(todayBase + 'T00:00:00');
      due.setDate(due.getDate() + (i + 1) * 30);
      const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      const isLast = i === createInstallmentCount - 1;
      const amount = isLast ? Math.round((createTotal - accumulated) * 100) / 100 : base;
      accumulated = Math.round((accumulated + amount) * 100) / 100;
      result.push({ amount, dueDate: dueStr });
    }
    setCreateInstallments(result);
    toast.success(`${createInstallmentCount} cuota${createInstallmentCount > 1 ? 's' : ''} generada${createInstallmentCount > 1 ? 's' : ''}`);
  };

  const getCreateDiasPlazo = (dueDate: string, idx: number): number => {
    if (!dueDate) return 0;
    const prevDate = idx === 0 ? new Date().toISOString().slice(0, 10) : createInstallments[idx - 1]?.dueDate;
    if (!prevDate) return 0;
    return Math.round((new Date(dueDate + 'T00:00:00').getTime() - new Date(prevDate + 'T00:00:00').getTime()) / 86400000);
  };

  const updateCreateDiasPlazo = (idx: number, days: number) => {
    if (days < 1) return;
    const prevDate = idx === 0 ? new Date().toISOString().slice(0, 10) : createInstallments[idx - 1]?.dueDate;
    if (!prevDate) return;
    const base = new Date(prevDate + 'T00:00:00');
    base.setDate(base.getDate() + days);
    const dueStr = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    const updated = [...createInstallments];
    updated[idx] = { ...updated[idx], dueDate: dueStr };
    setCreateInstallments(updated);
  };

  const handleCreateAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAgreement.mutateAsync({
      accountPayableIds: Array.from(createSelectedIds),
      paymentScheduleType: createSchedule,
      currency: createCurrency,
      dueDate: createSchedule === 'SINGLE_DATE' ? createDueDate : undefined,
      installments: createSchedule === 'INSTALLMENTS' ? createInstallments : undefined,
    });
    setShowCreateModal(false); resetCreateForm();
  };

  const getAgNextDue = (ag: PaymentAgreement): string => {
    if (ag.paymentScheduleType === 'INSTALLMENTS') {
      const next = ag.installments.find(i => i.status === 'PENDING');
      return next ? new Date(next.dueDate).toLocaleDateString('es-PE') : '-';
    }
    return ag.dueDate ? new Date(ag.dueDate).toLocaleDateString('es-PE') : '-';
  };

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FileText size={24} /> Cuentas por Pagar</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'calendar' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <CalendarDays size={16} /> Calendario
        </button>
        <button onClick={() => setActiveTab('agreements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'agreements' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <ClipboardList size={16} /> Acuerdos de Pago
          {agreements.filter((a: PaymentAgreement) => a.status !== 'CANCELLED' && a.status !== 'PAID').length > 0 && (
            <span className="bg-purple-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {agreements.filter((a: PaymentAgreement) => a.status !== 'CANCELLED' && a.status !== 'PAID').length}
            </span>
          )}
        </button>
      </div>

      {/* Buscador de proveedor / laboratorio */}
      <div className="mb-4 max-w-md">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar proveedor / laboratorio..."
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-400 transition-colors"
          />
          {supplierSearch && (
            <button
              type="button"
              onClick={() => setSupplierSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              aria-label="Limpiar"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── TAB: CALENDARIO ── */}
      {activeTab === 'calendar' && (
        <>
        {/* KPI summary */}
        {!isLoading && summary.totalCount > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className={`bg-white rounded-xl border p-4 flex items-center gap-3 ${summary.overdueCount > 0 ? 'border-red-200' : 'border-gray-200'}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${summary.overdueCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <AlertCircle size={20} className={summary.overdueCount > 0 ? 'text-red-600' : 'text-gray-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] uppercase tracking-wider font-semibold ${summary.overdueCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>Vencido</div>
                <div className="font-bold text-gray-800 text-lg leading-tight">{fmtBuckets(summary.overdue)}</div>
                <div className="text-xs text-gray-500">{summary.overdueCount} pago{summary.overdueCount !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-yellow-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <Clock size={20} className="text-yellow-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-yellow-700 font-semibold">Próximos 7 días</div>
                <div className="font-bold text-gray-800 text-lg leading-tight">{fmtBuckets(summary.next7)}</div>
                <div className="text-xs text-gray-500">{summary.next7Count} pago{summary.next7Count !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-primary-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                <DollarSign size={20} className="text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-primary-700 font-semibold">Total pendiente</div>
                <div className="font-bold text-gray-800 text-lg leading-tight">{fmtBuckets(summary.total)}</div>
                <div className="text-xs text-gray-500">{summary.totalCount} pago{summary.totalCount !== 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Calendar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 w-full lg:w-auto lg:min-w-[360px]">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronLeft size={18} /></button>
              <span className="font-semibold text-gray-800 text-sm">{MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
              <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>)}
            </div>
            {isLoading ? (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Cargando...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((dateStr, idx) => {
                  if (!dateStr) return <div key={`e-${idx}`} className="min-h-[44px]" />;
                  const color = getDayColor(dateStr);
                  const count = paymentsByDate[dateStr]?.length || 0;
                  const isSelected = selectedDate === dateStr;
                  const isToday = dateStr === todayStr;
                  let cellClass = 'relative flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all min-h-[44px] border text-sm font-medium ';
                  if (isSelected) cellClass += color ? colorStyle[color].selected : 'bg-gray-700 text-white border-gray-700';
                  else if (color) cellClass += colorStyle[color].cell;
                  else cellClass += 'border-transparent hover:bg-gray-100 text-gray-700';
                  return (
                    <div key={dateStr} className={cellClass} onClick={() => handleDayClick(dateStr)}>
                      <span className={isToday && !isSelected ? 'text-primary-600 font-bold' : ''}>{new Date(dateStr+'T00:00:00').getDate()}</span>
                      {count > 0 && <span className={`text-[10px] font-bold leading-none mt-0.5 ${isSelected ? 'text-white/90' : color ? colorStyle[color].count : ''}`}>{count}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 justify-center">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Vencido</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Próximo</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-500 inline-block" /> Futuro</span>
            </div>
          </div>

          {/* Day panel */}
          <div className="flex-1 w-full">
            {selectedDate ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <div className="font-semibold text-gray-800 capitalize text-sm">{formatSelectedDate(selectedDate)}</div>
                    {selectedPayments.length > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {selectedPayments.length} pago{selectedPayments.length > 1 ? 's' : ''} · Total: <span className="font-semibold text-gray-700">{fmtBuckets(selectedPayments.reduce((acc,p)=>{ addToBucket(acc,p.amount,p.ap.currency); return acc; }, emptyBuckets()))}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleDayClick(selectedDate)} className="text-gray-400 hover:text-gray-600 mt-0.5"><X size={18} /></button>
                </div>
                {selectedPayments.length === 0 ? (
                  <div className="px-4 py-14 text-center text-gray-300"><CalendarDays size={36} className="mx-auto mb-2" /><div className="text-sm text-gray-400">Sin pagos pendientes para este día</div></div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {(() => {
                      const grouped: Record<string, DayPayment[]> = {};
                      selectedPayments.forEach(p => { if (!grouped[p.supplier]) grouped[p.supplier]=[]; grouped[p.supplier].push(p); });
                      return Object.entries(grouped).map(([supplier, payments]) => {
                        const hasMany = payments.length > 1;
                        const supplierTotal = payments.reduce((acc,p)=>{ addToBucket(acc,p.amount,p.ap.currency); return acc; }, emptyBuckets());
                        const supplierOverdue = payments.some(p=>p.isOverdue);
                        return (
                          <div key={supplier}>
                            {hasMany && (
                              <div className={`flex items-center justify-between px-4 py-2 ${supplierOverdue?'bg-red-50':'bg-gray-50'} border-b border-gray-100`}>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-800 text-sm">{supplier}</span>
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">{payments.length} facturas</span>
                                </div>
                                <span className={`text-sm font-bold ${supplierOverdue?'text-red-600':'text-gray-700'}`}>{fmtBuckets(supplierTotal)}</span>
                              </div>
                            )}
                            {payments.map((payment, idx) => (
                              <div key={`${payment.apId}-${payment.installmentId||idx}`} className={`p-4 ${hasMany?'pl-6':''} ${payment.isOverdue?'bg-red-50/40':''}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    {!hasMany && <div className="font-medium text-gray-800 text-sm">{payment.supplier}</div>}
                                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                      {payment.purchaseRef && <span className="text-[11px] font-mono font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{payment.purchaseRef}</span>}
                                      <span className="text-xs text-gray-500">{payment.installmentIndex ? `Cuota ${payment.installmentIndex}` : 'Pago único'}</span>
                                      {payment.isOverdue && <span className="text-red-600 font-medium text-xs flex items-center gap-0.5"><AlertCircle size={10} /> Vencido</span>}
                                    </div>
                                  </div>
                                  <div className={`font-bold text-sm flex-shrink-0 ${payment.isOverdue?'text-red-600':'text-gray-800'}`}>{symFor(payment.ap)} {payment.amount.toFixed(2)}</div>
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => setViewingId(payment.apId)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded hover:bg-blue-100 transition-colors"><Eye size={12} /> Ver detalle</button>
                                  {payment.ap.status !== 'PAID' && (
                                    <button onClick={() => openAPPayment(payment.ap)} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 px-2 py-1 bg-primary-50 rounded hover:bg-primary-100 transition-colors"><DollarSign size={12} /> Registrar pago</button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            ) : allPending.length === 0 ? (
              <div className="hidden lg:flex h-full min-h-[300px] items-center justify-center text-gray-300 bg-white rounded-xl border border-dashed border-gray-200">
                <div className="text-center"><CalendarDays size={40} className="mx-auto mb-2" /><div className="text-sm text-gray-400">No hay pagos pendientes</div></div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <div className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                      <FileText size={14} /> Pendientes ({allPending.length})
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Total: <span className="font-semibold text-gray-700">{fmtBuckets(summary.total)}</span>
                      {summary.overdueCount > 0 && <span className="ml-2 text-red-600 font-medium">· {summary.overdueCount} vencido{summary.overdueCount > 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">Vencidos primero</div>
                </div>
                <div className="divide-y divide-gray-100 max-h-[640px] overflow-y-auto">
                  {pendingBySupplier.map(({ supplier, items, hasOverdue, total }) => (
                    <div key={supplier}>
                      <div className={`flex items-center justify-between px-4 py-2 ${hasOverdue ? 'bg-red-50' : 'bg-gray-50'} border-b border-gray-100`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-gray-800 text-sm truncate">{supplier}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 flex-shrink-0">{items.length} pago{items.length > 1 ? 's' : ''}</span>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${hasOverdue ? 'text-red-600' : 'text-gray-700'}`}>{fmtBuckets(total)}</span>
                      </div>
                      {items.map((p, idx) => {
                        const daysLabel = p.daysDiff < 0
                          ? `Vencido hace ${Math.abs(p.daysDiff)} día${Math.abs(p.daysDiff) > 1 ? 's' : ''}`
                          : p.daysDiff === 0 ? 'Vence hoy'
                          : `Vence en ${p.daysDiff} día${p.daysDiff > 1 ? 's' : ''}`;
                        const dateCls = p.daysDiff < 0 ? 'text-red-600 font-medium' : p.daysDiff <= 3 ? 'text-yellow-600 font-medium' : 'text-gray-500';
                        return (
                          <div key={`${p.apId}-${p.installmentId || idx}`} className={`p-3 pl-6 ${p.isOverdue ? 'bg-red-50/40' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {p.purchaseRef && <span className="text-[11px] font-mono font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{p.purchaseRef}</span>}
                                  <span className="text-xs text-gray-500">{p.installmentIndex ? `Cuota ${p.installmentIndex}` : 'Pago único'}</span>
                                  <button onClick={() => handleDayClick(p.dateStr)} className="text-[11px] text-primary-600 hover:underline">
                                    {new Date(p.dateStr + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                                  </button>
                                  <span className={`text-xs ${dateCls} flex items-center gap-0.5`}>
                                    {p.daysDiff < 0 && <AlertCircle size={10} />}
                                    {daysLabel}
                                  </span>
                                </div>
                              </div>
                              <div className={`font-bold text-sm flex-shrink-0 ${p.isOverdue ? 'text-red-600' : 'text-gray-800'}`}>{symFor(p.ap)} {p.amount.toFixed(2)}</div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => setViewingId(p.apId)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded hover:bg-blue-100 transition-colors"><Eye size={12} /> Ver detalle</button>
                              {p.ap.status !== 'PAID' && (
                                <button onClick={() => openAPPayment(p.ap)} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 px-2 py-1 bg-primary-50 rounded hover:bg-primary-100 transition-colors"><DollarSign size={12} /> Registrar pago</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* ── TAB: ACUERDOS ── */}
      {activeTab === 'agreements' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Facturas consolidadas de un mismo proveedor bajo un plan de pago único.</p>
            <button onClick={() => { resetCreateForm(); setShowCreateModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus size={16} /> Nuevo Acuerdo
            </button>
          </div>

          {agLoading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Cargando acuerdos...</div>
          ) : agreements.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
              <ClipboardList size={40} className="mx-auto mb-2 text-gray-300" />
              <div className="text-sm text-gray-400">No hay acuerdos de pago registrados</div>
              <button onClick={() => { resetCreateForm(); setShowCreateModal(true); }} className="mt-3 text-sm text-primary-600 hover:underline">Crear el primero</button>
            </div>
          ) : filteredAgreements.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
              <Search size={32} className="mx-auto mb-2 text-gray-300" />
              <div className="text-sm text-gray-400">Sin acuerdos para "{supplierSearch}"</div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAgreements.map((ag: PaymentAgreement) => {
                const st = agStatusLabels[ag.status] || { label: ag.status, cls: '' };
                const isCancelled = ag.status === 'CANCELLED';
                const isPaid = ag.status === 'PAID';
                const todayMs = new Date().setHours(0, 0, 0, 0);
                const progress = ag.totalAmount > 0 ? (ag.paidAmount / ag.totalAmount) * 100 : 0;
                const agSym = ag.currency === 'USD' ? '$' : 'S/';

                const instColor = (inst: AgreementInstallment): 'green' | 'red' | 'yellow' | 'blue' => {
                  if (inst.status === 'PAID') return 'green';
                  const dueMs = new Date(inst.dueDate.slice(0, 10) + 'T00:00:00').getTime();
                  if (dueMs < todayMs) return 'red';
                  return Math.ceil((dueMs - todayMs) / 86400000) <= 3 ? 'yellow' : 'blue';
                };
                const instColorMap = {
                  green:  { row: 'bg-green-50',  circle: 'bg-green-500 text-white',   date: 'text-green-700',  badge: 'bg-green-100 text-green-700' },
                  red:    { row: 'bg-red-50',    circle: 'bg-red-100 text-red-700',   date: 'text-red-700 font-semibold', badge: 'bg-red-100 text-red-700' },
                  yellow: { row: 'bg-yellow-50', circle: 'bg-yellow-100 text-yellow-700', date: 'text-yellow-700 font-medium', badge: 'bg-yellow-100 text-yellow-700' },
                  blue:   { row: '',             circle: 'bg-gray-100 text-gray-600', date: 'text-gray-500',   badge: 'bg-blue-50 text-blue-600' },
                };

                return (
                  <div key={ag.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isCancelled ? 'opacity-60' : ''} border-gray-200`}>

                    {/* ── Card header ── */}
                    <div className="px-5 py-4 border-b border-gray-100">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">{ag.supplier}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                            <span className="text-xs text-gray-400">
                              {ag.paymentScheduleType === 'INSTALLMENTS'
                                ? `${ag.installments.length} cuota${ag.installments.length > 1 ? 's' : ''}`
                                : 'Pago único'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {ag.invoices.map((inv, i) => (
                              <span key={i} className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{inv.purchaseRef || inv.apId.slice(-6)}</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xl font-bold text-gray-800">{agSym} {ag.pendingAmount.toFixed(2)}</div>
                          <div className="text-xs text-gray-400">pendiente de {agSym} {ag.totalAmount.toFixed(2)}</div>
                        </div>
                      </div>
                      {!isCancelled && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                            <span>Pagado: <span className="font-medium text-green-600">{agSym} {ag.paidAmount.toFixed(2)}</span></span>
                            <span>{progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Payment schedule ── */}
                    {!isCancelled && (
                      <div className="px-5 py-3">
                        {ag.paymentScheduleType === 'INSTALLMENTS' ? (
                          <div>
                            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Cuotas</div>
                            <div className="space-y-1.5">
                              {ag.installments.map((inst, i) => {
                                const c = instColor(inst);
                                const cm = instColorMap[c];
                                const dueMs = new Date(inst.dueDate.slice(0, 10) + 'T00:00:00').getTime();
                                const daysLeft = inst.status === 'PENDING' ? Math.ceil((dueMs - todayMs) / 86400000) : null;
                                const daysLabel = daysLeft === null ? '' : daysLeft < 0
                                  ? `Vencida hace ${Math.abs(daysLeft)} día${Math.abs(daysLeft) > 1 ? 's' : ''}`
                                  : daysLeft === 0 ? 'Vence hoy'
                                  : `Faltan ${daysLeft} día${daysLeft > 1 ? 's' : ''}`;
                                return (
                                  <div key={inst.id || i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${cm.row}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${cm.circle}`}>
                                      {inst.status === 'PAID' ? <CheckCircle size={14} /> : i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={`text-xs font-medium ${cm.date}`}>
                                        {inst.status === 'PAID'
                                          ? `Pagada el ${inst.paidDate ? new Date(inst.paidDate).toLocaleDateString('es-PE') : '-'}`
                                          : `Vence: ${new Date(inst.dueDate.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                                      </div>
                                      {daysLabel && <div className="text-[10px] text-gray-400 mt-0.5">{daysLabel}</div>}
                                    </div>
                                    <div className="font-semibold text-sm text-gray-800 flex-shrink-0">{agSym} {inst.amount.toFixed(2)}</div>
                                    {inst.status === 'PENDING' && (
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${cm.badge}`}>
                                        {c === 'red' ? 'Vencida' : c === 'yellow' ? 'Próxima' : 'Pendiente'}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          /* SINGLE_DATE */
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Vencimiento</span>
                            {isPaid ? (
                              <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle size={12} /> Pagado</span>
                            ) : ag.dueDate ? (() => {
                              const dueMs2 = new Date(ag.dueDate.slice(0, 10) + 'T00:00:00').getTime();
                              const diff = Math.ceil((dueMs2 - todayMs) / 86400000);
                              const cls = diff < 0 ? 'text-red-600 font-bold' : diff <= 3 ? 'text-yellow-600 font-medium' : 'text-gray-700';
                              const label = diff < 0 ? `Vencido hace ${Math.abs(diff)} día${Math.abs(diff) > 1 ? 's' : ''}` : diff === 0 ? 'Vence hoy' : `Faltan ${diff} día${diff > 1 ? 's' : ''}`;
                              return (
                                <>
                                  <span className={`text-sm ${cls}`}>{new Date(ag.dueDate.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${diff < 0 ? 'bg-red-100 text-red-700' : diff <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{label}</span>
                                </>
                              );
                            })() : <span className="text-xs text-gray-400">-</span>}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Footer actions ── */}
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
                      {isCancelled ? (
                        <span className="text-xs text-gray-400 italic">{ag.cancellationReason}</span>
                      ) : isPaid ? (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle size={12} /> Acuerdo completamente pagado</span>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => openAgPayment(ag)} className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 px-3 py-1.5 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors font-medium whitespace-nowrap">
                            <DollarSign size={13} /> Registrar Pago
                          </button>
                          {ag.paidAmount === 0 && (
                            <button onClick={() => { setSelectedAgreement(ag); setShowCancelModal(true); }}
                              className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 px-3 py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors font-medium whitespace-nowrap">
                              <Ban size={13} /> Anular
                            </button>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 flex-shrink-0">
                        Creado: {new Date(ag.createdAt).toLocaleDateString('es-PE')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ MODAL: Pago AP individual ══ */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Registrar Pago">
        <form onSubmit={handleAPPayment} className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wider mb-0.5">Proveedor</div>
              <div className="font-semibold text-gray-900 text-base">{selectedAP?.supplier}</div>
            </div>
            {selectedAP && <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${(apStatusLabels[selectedAP.status]||{cls:''}).cls}`}>{(apStatusLabels[selectedAP.status]||{label:selectedAP.status}).label}</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-center border border-gray-100"><div className="text-[10px] text-gray-400 uppercase">Total</div><div className="font-bold text-gray-700 text-xs mt-0.5">{symFor(selectedAP)} {selectedAP?.totalAmount.toFixed(2)}</div></div>
            <div className="bg-green-50 rounded-lg px-3 py-2 text-center border border-green-100"><div className="text-[10px] text-green-500 uppercase">Pagado</div><div className="font-bold text-green-700 text-xs mt-0.5">{symFor(selectedAP)} {selectedAP?.paidAmount.toFixed(2)}</div></div>
            <div className="bg-red-50 rounded-lg px-3 py-2 text-center border border-red-100"><div className="text-[10px] text-red-400 uppercase">Pendiente</div><div className="font-bold text-red-600 text-xs mt-0.5">{symFor(selectedAP)} {selectedAP?.pendingAmount.toFixed(2)}</div></div>
          </div>
          {nextInstallment && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
              <div><div className="text-[11px] text-blue-500 uppercase font-semibold">Próxima cuota</div><div className="text-xs text-blue-500 mt-0.5">Vence: {new Date(nextInstallment.dueDate).toLocaleDateString('es-PE')}</div></div>
              <div className="font-bold text-blue-700 text-sm">{symFor(selectedAP)} {nextInstallment.amount.toFixed(2)}</div>
            </div>
          )}
          <div className="border-t border-gray-100" />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Monto a pagar</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm select-none">{symFor(selectedAP)}</span>
              <input type="number" min="0.01" step="0.01" max={selectedAP?.pendingAmount} value={payForm.amount||''} onChange={e=>setPayForm({...payForm,amount:parseFloat(e.target.value)||0})}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm font-medium outline-none transition-colors ${exceedsPending?'border-red-400 bg-red-50':'border-gray-200 focus:border-primary-400'}`} required />
            </div>
            {exceedsPending && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> Excede el pendiente ({symFor(selectedAP)} {selectedAP?.pendingAmount.toFixed(2)})</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Código Único / Código Transferencia <span className="text-red-500">*</span></label>
            <div className="relative">
              <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={payForm.codigoTransferencia} onChange={e=>setPayForm({...payForm,codigoTransferencia:e.target.value})} placeholder="Ej: 00123456789"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-primary-400 transition-colors" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Notas <span className="text-gray-400 font-normal">(opcional)</span></label>
            <textarea value={payForm.notes} onChange={e=>setPayForm({...payForm,notes:e.target.value})} placeholder="Observaciones..." className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 transition-colors resize-none" rows={1} />
          </div>
          <button type="submit" disabled={exceedsPending||registerAPPayment.isPending||!payForm.codigoTransferencia.trim()}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
            <DollarSign size={16} />{registerAPPayment.isPending ? 'Registrando...' : 'Confirmar Pago'}
          </button>
        </form>
      </Modal>

      {/* ══ MODAL: Detalle AP ══ */}
      <Modal isOpen={!!viewingId} onClose={() => setViewingId(null)} title="Detalle - Cuenta por Pagar">
        {detailAP && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[['Proveedor', detailAP.supplier], ['Estado', null], ['Total', `${symFor(detailAP)} ${detailAP.totalAmount.toFixed(2)}`], ['Pendiente', null]].map(([label], i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <span className="block text-xs text-gray-500">{label}</span>
                  {i===1 ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(apStatusLabels[detailAP.status]||{cls:''}).cls}`}>{(apStatusLabels[detailAP.status]||{label:detailAP.status}).label}</span>
                  : i===3 ? <span className="text-sm font-bold text-red-600">{symFor(detailAP)} {detailAP.pendingAmount.toFixed(2)}</span>
                  : i===0 ? <span className="text-sm font-medium">{detailAP.supplier}</span>
                  : <span className="text-sm font-bold">{symFor(detailAP)} {detailAP.totalAmount.toFixed(2)}</span>}
                </div>
              ))}
            </div>
            {detailAP.paymentScheduleType === 'INSTALLMENTS' && detailAP.installments.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Cuotas (letras)</h3>
                <div className="space-y-2">
                  {detailAP.installments.map((inst: AccountPayableInstallment, idx: number) => (
                    <div key={inst.id||idx} className={`p-3 rounded-lg border ${inst.status==='PAID'?'bg-primary-50 border-primary-200':'bg-white border-gray-200'}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {inst.status==='PAID' ? <CheckCircle size={14} className="text-primary-500" /> : <Clock size={14} className="text-gray-400" />}
                          <span className="text-sm font-medium">Cuota {idx+1}</span>
                          {!inst.numeroUnico && inst.status==='PENDING' && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-medium">Sin N° único</span>}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{symFor(detailAP)} {inst.amount.toFixed(2)}</div>
                          <div className={`text-xs ${inst.status==='PAID'?'text-primary-600':'text-gray-500'}`}>
                            {inst.status==='PAID' ? `Pagada ${inst.paidDate?new Date(inst.paidDate).toLocaleDateString('es-PE'):''}` : `Vence: ${new Date(inst.dueDate).toLocaleDateString('es-PE')}`}
                          </div>
                        </div>
                      </div>
                      {inst.id && <NumeroUnicoEditor apId={detailAP.id} installmentId={inst.id} value={inst.numeroUnico} isPending={updateNumero.isPending} onSave={v=>updateNumero.mutate({apId:detailAP.id,data:{numeroUnico:v,installmentId:inst.id}})} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detailAP.paymentScheduleType==='SINGLE_DATE' && detailAP.dueDate && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div><span className="block text-xs text-gray-500">Fecha de vencimiento</span><span className={`text-sm font-medium ${getDueDateColor(detailAP)}`}>{new Date(detailAP.dueDate).toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'})}</span></div>
                <div>
                  <div className="flex items-center justify-between mb-1"><span className="text-xs text-gray-500">N° único de la letra</span>{!detailAP.numeroUnico && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-medium">Pendiente</span>}</div>
                  <NumeroUnicoEditor apId={detailAP.id} value={detailAP.numeroUnico} isPending={updateNumero.isPending} onSave={v=>updateNumero.mutate({apId:detailAP.id,data:{numeroUnico:v}})} />
                </div>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Historial de Pagos ({detailAP.payments.length})</h3>
              {detailAP.payments.length===0 ? <p className="text-sm text-gray-400">Sin pagos registrados</p> : (
                <div className="space-y-2">
                  {detailAP.payments.map((p: AccountPayablePayment, idx: number) => (
                    <div key={p.id||idx} className="p-2 bg-primary-50 rounded-lg border border-primary-200">
                      <div className="flex items-center justify-between"><div className="text-sm font-medium text-primary-700">{symFor(detailAP)} {p.amount.toFixed(2)}</div><div className="text-xs text-gray-500">{new Date(p.paymentDate).toLocaleDateString('es-PE')}{p.registeredByName?` - ${p.registeredByName}`:''}</div></div>
                      <div className="text-xs text-gray-600 mt-0.5 font-mono">Cód: {p.codigoTransferencia}</div>
                      {p.notes && <div className="text-xs text-gray-400 mt-0.5">{p.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ══ MODAL: Pago Acuerdo ══ */}
      <Modal isOpen={showAgPayModal} onClose={() => setShowAgPayModal(false)} title="Registrar Pago — Acuerdo">
        <form onSubmit={handleAgPayment} className="space-y-3">
          <div className="flex items-center justify-between">
            <div><div className="text-[11px] text-gray-400 uppercase tracking-wider mb-0.5">Proveedor</div><div className="font-semibold text-gray-900 text-base">{selectedAgreement?.supplier}</div></div>
            {selectedAgreement && <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${(agStatusLabels[selectedAgreement.status]||{cls:''}).cls}`}>{(agStatusLabels[selectedAgreement.status]||{label:selectedAgreement.status}).label}</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-center border border-gray-100"><div className="text-[10px] text-gray-400 uppercase">Total</div><div className="font-bold text-gray-700 text-xs mt-0.5">{symFor(selectedAgreement)} {selectedAgreement?.totalAmount.toFixed(2)}</div></div>
            <div className="bg-green-50 rounded-lg px-3 py-2 text-center border border-green-100"><div className="text-[10px] text-green-500 uppercase">Pagado</div><div className="font-bold text-green-700 text-xs mt-0.5">{symFor(selectedAgreement)} {selectedAgreement?.paidAmount.toFixed(2)}</div></div>
            <div className="bg-red-50 rounded-lg px-3 py-2 text-center border border-red-100"><div className="text-[10px] text-red-400 uppercase">Pendiente</div><div className="font-bold text-red-600 text-xs mt-0.5">{symFor(selectedAgreement)} {selectedAgreement?.pendingAmount.toFixed(2)}</div></div>
          </div>
          {selectedAgreement?.paymentScheduleType === 'INSTALLMENTS' && (() => { const ni = selectedAgreement.installments.find(i=>i.status==='PENDING'); return ni ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
              <div><div className="text-[11px] text-blue-500 uppercase font-semibold">Próxima cuota</div><div className="text-xs text-blue-500 mt-0.5">Vence: {new Date(ni.dueDate).toLocaleDateString('es-PE')}</div></div>
              <div className="font-bold text-blue-700 text-sm">{symFor(selectedAgreement)} {ni.amount.toFixed(2)}</div>
            </div>
          ) : null; })()}
          <div className="border-t border-gray-100" />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Monto a pagar</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm select-none">{symFor(selectedAgreement)}</span>
              <input type="number" min="0.01" step="0.01" max={selectedAgreement?.pendingAmount} value={agPayForm.amount||''} onChange={e=>setAgPayForm({...agPayForm,amount:parseFloat(e.target.value)||0})}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm font-medium outline-none transition-colors ${agExceedsPending?'border-red-400 bg-red-50':'border-gray-200 focus:border-primary-400'}`} required />
            </div>
            {agExceedsPending && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> Excede el pendiente ({symFor(selectedAgreement)} {selectedAgreement?.pendingAmount.toFixed(2)})</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Código Único / Código Transferencia <span className="text-red-500">*</span></label>
            <div className="relative"><Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={agPayForm.codigoTransferencia} onChange={e=>setAgPayForm({...agPayForm,codigoTransferencia:e.target.value})} placeholder="Ej: 00123456789" className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-primary-400 transition-colors" required /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Notas <span className="text-gray-400 font-normal">(opcional)</span></label>
            <textarea value={agPayForm.notes} onChange={e=>setAgPayForm({...agPayForm,notes:e.target.value})} placeholder="Observaciones..." className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 transition-colors resize-none" rows={1} />
          </div>
          <button type="submit" disabled={agExceedsPending||registerAgPayment.isPending||!agPayForm.codigoTransferencia.trim()}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
            <DollarSign size={16} />{registerAgPayment.isPending ? 'Registrando...' : 'Confirmar Pago'}
          </button>
        </form>
      </Modal>

      {/* ══ MODAL: Anular Acuerdo ══ */}
      <Modal isOpen={showCancelModal} onClose={() => { setShowCancelModal(false); setCancelReason(''); }} title="Anular Acuerdo de Pago">
        <form onSubmit={handleCancelAgreement} className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Ban size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-800 text-sm">¿Anular acuerdo de {selectedAgreement?.supplier}?</div>
                <div className="text-xs text-red-600 mt-1">Las {selectedAgreement?.invoices.length} facturas volverán a estado <strong>Pendiente</strong> y podrán pagarse individualmente. Esta acción no se puede deshacer.</div>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo de anulación <span className="text-red-500">*</span></label>
            <textarea value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="Describe el motivo de la anulación..." className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-red-400 transition-colors resize-none" rows={3} required minLength={5} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowCancelModal(false); setCancelReason(''); }} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={cancelReason.trim().length < 5 || cancelAgreement.isPending}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
              {cancelAgreement.isPending ? 'Anulando...' : 'Confirmar Anulación'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ MODAL: Crear Acuerdo ══ */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetCreateForm(); }} title="Nuevo Acuerdo de Pago" size="lg">
        <form onSubmit={handleCreateAgreement} className="space-y-5">
          {/* Supplier select */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Proveedor <span className="text-red-500">*</span></label>
            <select value={createSupplier} onChange={e => { setCreateSupplier(e.target.value); setCreateSelectedIds(new Set()); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 transition-colors" required>
              <option value="">Selecciona un proveedor...</option>
              {Object.entries(supplierOptions).map(([supplier, aps]) => (
                <option key={supplier} value={supplier}>{supplier} ({aps.length} factura{aps.length>1?'s':''})</option>
              ))}
            </select>
          </div>

          {/* AP list */}
          {createSupplier && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Facturas a consolidar <span className="text-red-500">*</span></label>
                <button type="button" onClick={() => setCreateSelectedIds(new Set(supplierAPs.map(ap=>ap.id)))} className="text-xs text-primary-600 hover:underline">Seleccionar todas</button>
              </div>
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {supplierAPs.map(ap => (
                  <label key={ap.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={createSelectedIds.has(ap.id)}
                      onChange={e => { const s = new Set(createSelectedIds); e.target.checked ? s.add(ap.id) : s.delete(ap.id); setCreateSelectedIds(s); }}
                      className="rounded text-primary-600" />
                    <div className="flex-1">
                      {ap.purchaseRef && <span className="text-xs font-mono font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded mr-2">{ap.purchaseRef}</span>}
                      <span className="text-xs text-gray-500">{ap.paymentScheduleType === 'INSTALLMENTS' ? `${ap.installments.filter(i=>i.status==='PENDING').length} cuotas pendientes` : 'Pago único'}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{symFor(ap)} {ap.pendingAmount.toFixed(2)}</span>
                  </label>
                ))}
              </div>
              {createSelectedIds.size > 0 && (
                <div className="mt-2 flex items-center justify-between px-2">
                  <span className="text-xs text-gray-500">{createSelectedIds.size} factura{createSelectedIds.size>1?'s':''} seleccionada{createSelectedIds.size>1?'s':''}</span>
                  <span className="text-sm font-bold text-gray-800">Total: {fmtBuckets(createTotalBuckets)}</span>
                </div>
              )}
            </div>
          )}

          {/* Schedule + currency */}
          {createSelectedIds.size >= 2 && (
            <>
              {/* Moneda */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Moneda del acuerdo</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCreateCurrency('PEN')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${createCurrency === 'PEN' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    S/ Soles
                  </button>
                  <button type="button" onClick={() => setCreateCurrency('USD')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${createCurrency === 'USD' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    $ Dólares
                  </button>
                </div>
              </div>

              {/* Tipo de pago */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de pago</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['SINGLE_DATE', 'INSTALLMENTS'] as const).map(type => (
                    <button key={type} type="button" onClick={() => setCreateSchedule(type)}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${createSchedule === type ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                      {type === 'SINGLE_DATE' ? 'Fecha única' : 'Por cuotas'}
                    </button>
                  ))}
                </div>
              </div>

              {createSchedule === 'SINGLE_DATE' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha de vencimiento <span className="text-red-500">*</span></label>
                  <input type="date" value={createDueDate} onChange={e => setCreateDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 transition-colors" required />
                </div>
              )}

              {createSchedule === 'INSTALLMENTS' && (
                <div className="space-y-3">
                  {/* Generador */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-xs font-semibold text-orange-700 mb-2">
                      <Wand2 size={13} /> Generar cuotas automáticamente
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-gray-500 shrink-0"># cuotas</label>
                        <input type="number" min="1" max="36" step="1" value={createInstallmentCount || ''}
                          onChange={e => setCreateInstallmentCount(parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1.5 border border-gray-200 rounded text-sm text-center" />
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px] flex-1">
                        {[3, 4, 5, 6, 8, 12].map(n => (
                          <button key={n} type="button" onClick={() => setCreateInstallmentCount(n)}
                            className={`px-2 py-0.5 rounded font-medium ${createInstallmentCount === n ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={generateAgreementInstallments}
                        className="px-3 py-1.5 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 inline-flex items-center gap-1 shrink-0">
                        <Wand2 size={12} /> Generar
                      </button>
                    </div>
                  </div>

                  {/* Tabla de cuotas */}
                  {createInstallments.length > 0 && (
                    <>
                      <div className="grid grid-cols-[22px_1fr_72px_1fr_24px] gap-2 px-1">
                        <div />
                        <div className="text-[10px] font-medium text-gray-500">Monto ({createCurrency === 'USD' ? '$' : 'S/'})</div>
                        <div className="text-[10px] font-medium text-gray-500">Días</div>
                        <div className="text-[10px] font-medium text-gray-500">Fecha vencimiento</div>
                        <div />
                      </div>
                      {createInstallments.map((inst, i) => {
                        const dias = getCreateDiasPlazo(inst.dueDate, i);
                        return (
                          <div key={i} className="grid grid-cols-[22px_1fr_72px_1fr_24px] gap-2 items-center">
                            <span className="text-xs text-gray-400 font-medium text-right">#{i + 1}</span>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold select-none">
                                {createCurrency === 'USD' ? '$' : 'S/'}
                              </span>
                              <input type="number" min="0.01" step="0.01" value={inst.amount || ''}
                                onChange={e => { const arr = [...createInstallments]; arr[i] = { ...arr[i], amount: parseFloat(e.target.value) || 0 }; setCreateInstallments(arr); }}
                                className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-primary-400" required />
                            </div>
                            <input type="number" min="1" step="1" value={dias || ''}
                              onChange={e => updateCreateDiasPlazo(i, parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-primary-400 text-center" />
                            <input type="date" value={inst.dueDate}
                              onChange={e => { const arr = [...createInstallments]; arr[i] = { ...arr[i], dueDate: e.target.value }; setCreateInstallments(arr); }}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-primary-400" required />
                            {createInstallments.length > 1 && (
                              <button type="button" onClick={() => setCreateInstallments(createInstallments.filter((_, j) => j !== i))}
                                className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between pt-1 border-t border-orange-100">
                        <span className="text-xs text-gray-500">
                          Total: <span className="font-semibold">
                            {createCurrency === 'USD' ? '$' : 'S/'} {createInstallments.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)}
                          </span>
                          {createTotal > 0 && Math.abs(createInstallments.reduce((s, i) => s + (i.amount || 0), 0) - createTotal) > 0.01 && (
                            <span className="text-red-600 ml-1">· no coincide con {createTotal.toFixed(2)}</span>
                          )}
                        </span>
                        <button type="button"
                          onClick={() => setCreateInstallments([...createInstallments, { amount: 0, dueDate: '' }])}
                          className="text-xs text-primary-600 hover:text-primary-800 font-medium">
                          + Agregar cuota
                        </button>
                      </div>
                    </>
                  )}
                  {createInstallments.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Usa el generador o agrega cuotas manualmente</p>
                  )}
                </div>
              )}

              <button type="submit"
                disabled={createAgreement.isPending || createSelectedIds.size < 2 || (createSchedule === 'SINGLE_DATE' && !createDueDate) || (createSchedule === 'INSTALLMENTS' && (createInstallments.length === 0 || createInstallments.some(i => !i.dueDate || !i.amount)))}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                <ClipboardList size={16} />
                {createAgreement.isPending ? 'Creando...' : `Crear Acuerdo · ${createCurrency === 'USD' ? '$' : 'S/'} ${createTotal.toFixed(2)}`}
              </button>
            </>
          )}

          {createSelectedIds.size === 1 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center gap-2"><AlertCircle size={14} /> Selecciona al menos 2 facturas para crear un acuerdo.</p>
          )}
        </form>
      </Modal>
    </div>
  );
}

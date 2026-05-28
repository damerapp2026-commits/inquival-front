import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useCashRegisterToday, useOpenCashRegister, useAddCashEntry, useEditCashEntry, useDeleteCashEntry, useCloseCashRegister } from '../hooks/useCashRegister';
import { useSaleById, useUpdateSaleItems } from '../../sales/hooks/useSales';
import { saleService } from '../../sales/services/saleService';
import { creditService } from '../../credits/services/creditService';
import { useClients } from '../../clients/hooks/useClients';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { useUsers } from '../../users/hooks/useUsers';
import { useAuth } from '../../../app/providers/AuthProvider';
import { Modal } from '../../../shared/components/Modal';
import {
  Wallet, TrendingUp, TrendingDown, Edit2, Trash2, Lock, History, ChevronDown, ChevronRight,
  Layers, Clock, Eye, ArrowDownCircle, ArrowUpCircle, Scale, CheckCircle2, AlertCircle,
  ReceiptText, FileText, CircleDashed, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { CashRegisterEntry, Sale, Client, CreditAccount } from '../../../shared/types';
import { groupEntries } from '../utils/groupEntries';
import { EXPENSE_CATEGORIES } from '../utils/expenseCategories';

// --- Helpers --------------------------------------------------------------

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

const categoryStyles: Record<string, string> = {
  SALE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  CREDIT_PAYMENT: 'bg-amber-50 text-amber-700 border-amber-100',
  PURCHASE: 'bg-rose-50 text-rose-700 border-rose-100',
  ADJUSTMENT: 'bg-blue-50 text-blue-700 border-blue-100',
  SERVICES: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  SALARY: 'bg-violet-50 text-violet-700 border-violet-100',
  SUPPLIES: 'bg-amber-50 text-amber-700 border-amber-100',
  RENT: 'bg-orange-50 text-orange-700 border-orange-100',
  TRANSPORT: 'bg-teal-50 text-teal-700 border-teal-100',
  OTHER: 'bg-gray-100 text-gray-600 border-gray-200',
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
  try {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return '—'; }
}

function formatLongDate(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
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

function clientFromSaleDescription(desc: string): string {
  const stripped = stripMethod(desc);
  if (/^venta\s+sin\s+cliente/i.test(stripped)) return 'Sin cliente';
  const m = stripped.match(/^Venta\s+a\s+(.+)$/i);
  if (!m) return stripped;
  const name = m[1].trim();
  if (!name || /^sin\s*cliente$/i.test(name)) return 'Sin cliente';
  return name;
}

// --- Component ------------------------------------------------------------

export function CashRegisterPage() {
  const navigate = useNavigate();
  const { data: register, isLoading } = useCashRegisterToday();
  const openCashRegister = useOpenCashRegister();
  const addEntry = useAddCashEntry();
  const editEntry = useEditCashEntry();
  const deleteEntryMutation = useDeleteCashEntry();
  const updateSaleItems = useUpdateSaleItems();
  const closeRegister = useCloseCashRegister();
  const { data: usersData } = useUsers({ limit: 200 });
  const { user: currentUser } = useAuth();

  const userById = useMemo(() => {
    const list: any[] = Array.isArray(usersData) ? usersData : (usersData as any)?.data || [];
    const map: Record<string, string> = {};
    list.forEach((u) => { map[u.id] = u.fullName || u.username || ''; });
    // Garantiza que el usuario actual aparezca con nombre en los chips, incluso
    // si /users no lo devuelve (rol no-ADMIN no puede listar, paginación, caché stale).
    if (currentUser?.id && !map[currentUser.id]) {
      map[currentUser.id] = currentUser.fullName || currentUser.username || '';
    }
    return map;
  }, [usersData, currentUser]);

  const sellers = useMemo(() => {
    const list: any[] = Array.isArray(usersData) ? usersData : (usersData as any)?.data || [];
    return list.filter((u: any) => u.role === 'VENDEDOR' || u.role === 'VENDEDOR_CAMPO' || u.role === 'ADMIN');
  }, [usersData]);

  const [openingAmount, setOpeningAmount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CashRegisterEntry | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('');
  const [currencyFilter, setCurrencyFilter] = useState<'PEN' | 'USD' | null>(null);

  const editingIsSale = !!(selectedEntry?.referenceType === 'Sale' && selectedEntry?.referenceId);
  const { data: editingSale } = useSaleById(showEditModal && editingIsSale ? selectedEntry!.referenceId! : null);

  // Fetch individual de cada venta referenciada por las entries (incluso ventas
  // antiguas), igual que el detalle. Evita depender de un bulk filtrado por la
  // fecha de caja, que se queda corto cuando la entry apunta a una venta vieja.
  const referencedSaleIds = useMemo(() => {
    const ids = new Set<string>();
    (register?.entries || []).forEach((e: CashRegisterEntry) => {
      if (e.referenceType === 'Sale' && e.referenceId) ids.add(e.referenceId);
    });
    return Array.from(ids);
  }, [register]);
  const saleQueries = useQueries({
    queries: referencedSaleIds.map((id) => ({
      queryKey: ['sale', id],
      queryFn: () => saleService.getById(id),
      staleTime: 60_000,
    })),
  });
  const salesByRefId = useMemo(() => {
    const map = new Map<string, Sale>();
    saleQueries.forEach((q, idx) => {
      const data = q.data as Sale | undefined;
      if (data) map.set(referencedSaleIds[idx], data);
    });
    return map;
  }, [saleQueries, referencedSaleIds]);

  // Mismo patrón para los CreditAccount referenciados por entries CREDIT_PAYMENT.
  // Lo usamos en la columna MONTO para mostrar el desglose C: total / P: abono.
  const referencedCreditIds = useMemo(() => {
    const ids = new Set<string>();
    (register?.entries || []).forEach((e: CashRegisterEntry) => {
      if (e.referenceType === 'CreditAccount' && e.referenceId) ids.add(e.referenceId);
    });
    return Array.from(ids);
  }, [register]);
  const creditQueries = useQueries({
    queries: referencedCreditIds.map((id) => ({
      queryKey: ['credit', id],
      queryFn: () => creditService.getById(id),
      staleTime: 60_000,
    })),
  });
  const creditsByRefId = useMemo(() => {
    const map = new Map<string, CreditAccount>();
    creditQueries.forEach((q, idx) => {
      const data = q.data as CreditAccount | undefined;
      if (data) map.set(referencedCreditIds[idx], data);
    });
    return map;
  }, [creditQueries, referencedCreditIds]);

  // Mismo patrón que /sales: clientMap.get(id)?.name → 'N/A', sin id → 'Sin cliente'.
  const { data: clientsData } = useClients({ limit: 200 });
  const clients: Client[] = useMemo(() => {
    const raw: any = clientsData;
    return Array.isArray(raw) ? raw : raw?.data || [];
  }, [clientsData]);
  const clientMap = useMemo(() => new Map<string, Client>(clients.map((c) => [c.id, c])), [clients]);
  const getClientName = (id?: string) => id ? clientMap.get(id)?.name || 'N/A' : 'Sin cliente';

  const { data: paymentMethods = [] } = usePaymentMethods();

  const [addForm, setAddForm] = useState({ type: 'INCOME' as string, category: 'OTHER' as string, description: '', amount: 0, voucherType: 'NONE' as string, voucherSeries: '', voucherNumber: '', paymentMethodName: '', expenseCurrency: 'PEN' as 'PEN' | 'USD' });
  const [editForm, setEditForm] = useState({ amount: 0, reason: '', voucherType: 'NONE' as string, voucherSeries: '', voucherNumber: '', paymentMethodName: '' });
  const [deleteReason, setDeleteReason] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const isClosed = register?.status === 'CLOSED';
  const entries: CashRegisterEntry[] = (register?.entries || []).filter((e: CashRegisterEntry) => !e.isDeleted);
  const activeEntries = entries;
  const totalIncome = activeEntries.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
  const totalExpense = activeEntries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
  const usdEntries = activeEntries.filter(
    (e) => e.type === 'INCOME' && e.referenceType === 'Sale' && salesByRefId.get(e.referenceId || '')?.currency === 'USD',
  );
  const totalIncomeUsdPen = usdEntries.reduce((s, e) => s + e.amount, 0);
  const totalIncomeUsd = (() => {
    const seenSaleIds = new Set<string>();
    return usdEntries.reduce((s, e) => {
      if (e.amountUsd != null) return s + e.amountUsd;
      if (e.referenceId && !seenSaleIds.has(e.referenceId)) {
        seenSaleIds.add(e.referenceId);
        return s + (salesByRefId.get(e.referenceId)?.totalUsd ?? 0);
      }
      return s;
    }, 0);
  })();
  const totalIncomePen = totalIncome - totalIncomeUsdPen;
  const netBalance = (register?.openingBalance || 0) + totalIncome - totalExpense;

  const openAddIncome = () => { setAddForm({ type: 'INCOME', category: 'OTHER', description: '', amount: 0, voucherType: 'NONE', voucherSeries: '', voucherNumber: '', paymentMethodName: '', expenseCurrency: 'PEN' }); setShowAddModal(true); };
  const openAddExpense = () => { setAddForm({ type: 'EXPENSE', category: 'OTHER', description: '', amount: 0, voucherType: 'NONE', voucherSeries: '', voucherNumber: '', paymentMethodName: 'Efectivo', expenseCurrency: 'PEN' }); setShowAddModal(true); };
  const openEdit = (entry: CashRegisterEntry) => { setSelectedEntry(entry); setEditForm({ amount: entry.amount, reason: '', voucherType: entry.voucherType || 'NONE', voucherSeries: entry.voucherSeries || '', voucherNumber: entry.voucherNumber || '', paymentMethodName: methodFromDescription(entry.description) || '' }); setShowEditModal(true); };

  const openDelete = (entry: CashRegisterEntry) => { setSelectedEntry(entry); setDeleteReason(''); setShowDeleteModal(true); };

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    await openCashRegister.mutateAsync({ openingBalance: openingAmount });
  };
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const desc = addForm.paymentMethodName ? `${addForm.description} [${addForm.paymentMethodName}]` : addForm.description;
    const { paymentMethodName, expenseCurrency, ...rest } = addForm;
    const isUsdExpense = addForm.type === 'EXPENSE' && expenseCurrency === 'USD';
    await addEntry.mutateAsync({
      registerId: register.id,
      data: {
        ...rest,
        description: desc,
        ...(isUsdExpense ? { currency: 'USD', amountUsd: addForm.amount } : {}),
      },
    });
    setShowAddModal(false);
  };
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry || !register) return;
    const { paymentMethodName, ...rest } = editForm;
    const originalMethod = methodFromDescription(selectedEntry.description) || '';
    const methodChanged = paymentMethodName !== originalMethod;
    const isSaleEntry = selectedEntry.referenceType === 'Sale' && !!selectedEntry.referenceId;

    // Para entradas de venta, el método de pago vive en sale.payments. Si cambió,
    // ruteamos por el endpoint de la venta (que reconstruye la entrada de caja).
    if (isSaleEntry && methodChanged) {
      if (!editingSale) {
        toast.error('Cargando datos de la venta, intenta de nuevo');
        return;
      }
      if (editingSale.isCredit) {
        toast.error('No se puede cambiar el método en ventas a crédito');
        return;
      }
      if ((editingSale.payments?.length ?? 0) > 1) {
        toast.error('Esta venta tiene varios pagos. Edítala desde /sales');
        return;
      }
      const method = paymentMethods.find((m: any) => m.name === paymentMethodName);
      if (!method) {
        toast.error('Método de pago no encontrado');
        return;
      }
      await updateSaleItems.mutateAsync({
        id: editingSale.id,
        reason: editForm.reason,
        items: editingSale.items.map((i: any) => ({
          productId: i.productId,
          companyId: i.companyId,
          priceTier: i.priceTier,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        payments: [{ paymentMethodId: method.id, amount: editingSale.total }],
      });
      setShowEditModal(false);
      return;
    }

    // Resto: caja maneja directamente (gastos/ingresos manuales, o ventas sin cambio de método)
    const data: any = { ...rest };
    if (methodChanged) {
      const baseDesc = stripMethod(selectedEntry.description);
      data.description = paymentMethodName ? `${baseDesc} [${paymentMethodName}]` : baseDesc;
    }
    await editEntry.mutateAsync({ registerId: register.id, entryId: selectedEntry.id, data });
    setShowEditModal(false);
  };
  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    await deleteEntryMutation.mutateAsync({ registerId: register.id, entryId: selectedEntry!.id, data: { reason: deleteReason } });
    setShowDeleteModal(false);
  };
  const handleClose = async () => {
    await closeRegister.mutateAsync({ registerId: register.id, data: { notes: closeNotes } });
    setShowCloseModal(false);
  };
  const [viewingSaleId, setViewingSaleId] = useState<string | null>(null);
  const viewSale = (saleId: string) => setViewingSaleId(saleId);
  const goToSale = (saleId: string) => navigate(`/sales?openSaleId=${saleId}`);
  const { data: viewingSale } = useSaleById(viewingSaleId);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (vendorFilter) result = result.filter((e) => e.createdBy === vendorFilter);
    if (paymentMethodFilter) {
      result = result.filter((e) => methodFromDescription(e.description) === paymentMethodFilter);
    }
    if (currencyFilter) {
      result = result.filter((e) => {
        const isUsd = e.referenceType === 'Sale' && !!e.referenceId && salesByRefId.get(e.referenceId)?.currency === 'USD';
        return currencyFilter === 'USD' ? isUsd : !isUsd;
      });
    }
    return result;
  }, [entries, vendorFilter, paymentMethodFilter, currencyFilter, salesByRefId]);

  const uniqueSellersInEntries = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const e of entries) {
      if (e.createdBy && !seen.has(e.createdBy)) {
        seen.add(e.createdBy);
        result.push({ id: e.createdBy, name: userById[e.createdBy] || 'Usuario' });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, userById]);

  const uniqueMethodsInEntries = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const e of entries) {
      const m = methodFromDescription(e.description);
      if (m && !seen.has(m)) { seen.add(m); result.push(m); }
    }
    return result.sort();
  }, [entries]);

  const filteredIncome = filteredEntries.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
  const filteredExpense = filteredEntries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);

  const groupedRows = useMemo(() => groupEntries([...filteredEntries].reverse()), [filteredEntries]);

  // --- Loading ------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // --- No register: opening screen ---------------------------------------
  if (!register) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="grid lg:grid-cols-2">
            <div className="p-8 sm:p-10 flex flex-col justify-center">
              <div className="w-14 h-14 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center mb-5">
                <Wallet size={28} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Comienza el día</h2>
              <p className="text-sm text-gray-500 mb-6 max-w-md">
                Aún no tienes una caja abierta. Ingresa el saldo inicial en efectivo y empieza a registrar movimientos.
              </p>
              <form onSubmit={handleOpen} className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Saldo inicial</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">S/</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingAmount || ''}
                      onChange={(e) => setOpeningAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-2xl font-bold text-gray-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={openCashRegister.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold shadow-sm disabled:opacity-50"
                >
                  <Wallet size={18} />
                  {openCashRegister.isPending ? 'Abriendo caja...' : 'Abrir caja'}
                </button>
              </form>
              <div className="mt-6 pt-5 border-t border-gray-100 max-w-sm">
                <Link
                  to="/cash-register/history"
                  className="group flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 hover:bg-primary-50 border border-gray-200 hover:border-primary-300 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-white border border-gray-200 group-hover:border-primary-200 group-hover:bg-primary-100 group-hover:text-primary-700 text-gray-500 flex items-center justify-center flex-shrink-0 transition-colors">
                      <History size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-800 group-hover:text-primary-800 transition-colors">Historial de cajas</div>
                      <div className="text-xs text-gray-500 group-hover:text-primary-700/80 transition-colors">Revisa cierres y movimientos anteriores</div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-400 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </Link>
              </div>
            </div>
            <div className="hidden lg:block relative bg-gradient-to-br from-primary-600 via-primary-700 to-emerald-800 p-10 text-white">
              <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full" />
              <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-white/5 rounded-full" />
              <div className="relative">
                <div className="text-xs uppercase tracking-[0.2em] text-primary-100 mb-3">Resumen del día</div>
                <div className="text-3xl font-bold mb-6">{formatLongDate(new Date().toISOString())}</div>
                <div className="space-y-3 text-sm">
                  <Bullet text="Registra ingresos y egresos en efectivo" />
                  <Bullet text="Reconcilia métodos de pago al cierre" />
                  <Bullet text="Cada movimiento queda firmado por su autor" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Register open or closed -------------------------------------------
  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Hero card */}
      <div className={`relative overflow-hidden rounded-xl shadow-card text-white px-5 py-4 ${
        isClosed
          ? 'bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900'
          : 'bg-gradient-to-br from-primary-600 via-primary-700 to-emerald-800'
      }`}>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur ${isClosed ? 'bg-white/15 text-white' : 'bg-white/20 text-white'}`}>
                  {isClosed ? <CircleDashed size={10} /> : <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" /></span>}
                  {isClosed ? 'Cerrada' : 'Abierta'}
                </span>
                <span className={`text-[10px] uppercase tracking-[0.15em] ${isClosed ? 'text-gray-300' : 'text-primary-100'}`}>
                  Balance del día
                </span>
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight">
                  S/ {netBalance.toFixed(2)}
                </div>
                <div className={`text-xs ${isClosed ? 'text-gray-300' : 'text-primary-100'}`}>
                  {activeEntries.length} movimiento{activeEntries.length === 1 ? '' : 's'} · {register?.date}
                </div>
              </div>
            </div>
          </div>

          {!isClosed && (
            <div className="flex flex-wrap gap-2">
              <button onClick={openAddIncome} className="flex items-center gap-1.5 px-3 py-2 bg-white text-primary-700 rounded-lg hover:bg-primary-50 text-sm font-semibold shadow-sm transition-colors">
                <ArrowUpCircle size={15} /> Ingreso
              </button>
              <button onClick={openAddExpense} className="flex items-center gap-1.5 px-3 py-2 bg-white/20 text-white backdrop-blur rounded-lg hover:bg-white/25 text-sm font-semibold transition-colors">
                <ArrowDownCircle size={15} /> Egreso
              </button>
              <button onClick={() => { setCloseNotes(''); setShowCloseModal(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-black/20 text-white rounded-lg hover:bg-black/30 text-sm font-semibold transition-colors">
                <Lock size={15} /> Cerrar caja
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Scale} label="Apertura" value={`S/ ${(register?.openingBalance || 0).toFixed(2)}`} accent="bg-gray-100 text-gray-700" />
        <KpiTile icon={TrendingUp} label={totalIncomeUsd > 0 ? 'Ingresos S/' : 'Ingresos'} value={`+ S/ ${totalIncomePen.toFixed(2)}`} accent="bg-primary-100 text-primary-700" valueAccent="text-primary-700" subValue={totalIncomeUsd > 0 ? `+ $ ${totalIncomeUsd.toFixed(2)} USD` : undefined} subValueAccent="text-emerald-600" />
        <KpiTile icon={TrendingDown} label="Egresos" value={`− S/ ${totalExpense.toFixed(2)}`} accent="bg-rose-100 text-rose-600" valueAccent="text-rose-600" />
        <KpiTile icon={Wallet} label="Balance Neto (S/)" value={`S/ ${netBalance.toFixed(2)}`} accent="bg-blue-100 text-blue-700" valueAccent="text-blue-700" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <span className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold shadow-sm">
          <Wallet size={15} /> Hoy
        </span>
        <Link to="/cash-register/history" className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-xl text-sm font-medium hover:border-primary-300 hover:text-primary-700 transition-colors">
          <History size={15} /> Historial
        </Link>
      </div>

      {/* Movements feed */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-gray-400" />
            <h2 className="text-base font-semibold text-gray-800">Movimientos del día</h2>
            <span className="text-xs text-gray-400">
              · {filteredEntries.length}{(vendorFilter || paymentMethodFilter || currencyFilter) ? ` de ${entries.length}` : ''} entrada{filteredEntries.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {totalIncomeUsd > 0 && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setCurrencyFilter(currencyFilter === 'PEN' ? null : 'PEN')}
                  className={`px-3 py-2 transition-colors ${currencyFilter === 'PEN' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  S/
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setCurrencyFilter(currencyFilter === 'USD' ? null : 'USD')}
                  className={`px-3 py-2 border-l border-gray-200 transition-colors ${currencyFilter === 'USD' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  $
                </button>
              </div>
            )}
            {uniqueSellersInEntries.length > 0 && (
              <select
                value={vendorFilter || ''}
                onChange={(e) => setVendorFilter(e.target.value || null)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">Todos los vendedores</option>
                {uniqueSellersInEntries.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            {uniqueMethodsInEntries.length > 0 && (
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">Todos los métodos</option>
                {uniqueMethodsInEntries.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            {(vendorFilter || paymentMethodFilter || currencyFilter) && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setVendorFilter(null); setPaymentMethodFilter(''); setCurrencyFilter(null); }}
                className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {(vendorFilter || paymentMethodFilter || currencyFilter) && filteredEntries.length > 0 && (
          <div className="px-5 sm:px-6 py-2.5 bg-primary-50/50 border-b border-primary-100 flex items-center justify-between text-xs gap-3 flex-wrap">
            <span className="text-gray-500 flex items-center gap-1.5 flex-wrap">
              Filtrado por
              {currencyFilter && <strong className={currencyFilter === 'USD' ? 'text-emerald-700' : 'text-primary-700'}>{currencyFilter === 'USD' ? '$ USD' : 'S/ Soles'}</strong>}
              {currencyFilter && (vendorFilter || paymentMethodFilter) && <span className="text-gray-400">·</span>}
              {vendorFilter && <strong className="text-gray-700">{userById[vendorFilter] || 'vendedor'}</strong>}
              {vendorFilter && paymentMethodFilter && <span className="text-gray-400">·</span>}
              {paymentMethodFilter && <strong className="text-gray-700">{paymentMethodFilter}</strong>}
            </span>
            <span className="flex items-center gap-3 tabular-nums">
              <span className="text-primary-700 font-semibold">+ S/ {filteredIncome.toFixed(2)}</span>
              <span className="text-rose-600 font-semibold">− S/ {filteredExpense.toFixed(2)}</span>
              <span className="text-gray-700 font-semibold">Neto S/ {(filteredIncome - filteredExpense).toFixed(2)}</span>
            </span>
          </div>
        )}

        {filteredEntries.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <AlertCircle size={22} className="text-gray-400" />
            </div>
            {(vendorFilter || paymentMethodFilter || currencyFilter) ? (
              <>
                <p className="text-sm text-gray-500 font-medium">Sin movimientos para el filtro seleccionado</p>
                <button
                  type="button"
                  onClick={() => { setVendorFilter(null); setPaymentMethodFilter(''); setCurrencyFilter(null); }}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-2"
                >
                  Ver todos los movimientos
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 font-medium">Aún no hay movimientos</p>
                <p className="text-xs text-gray-400 mt-1">Las ventas, pagos de crédito y compras aparecerán aquí.</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/60">
                  <th className="px-4 sm:px-6 py-3 text-left">Hora</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Vendedor</th>
                  <th className="px-4 py-3 text-left">Método</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-center">Comprobante</th>
                  {!isClosed && <th className="px-4 sm:px-6 py-3 text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupedRows.map((group, gi) => {
                  const isGroup = !!group.groupId && group.entries.length > 1;
                  if (!isGroup) {
                    return renderEntryRow(group.entries[0], false, gi, {
                      isClosed, userById, salesByRefId, creditsByRefId, getClientName, openEdit, openDelete, viewSale,
                    });
                  }
                  const isOpen = expandedGroups.has(group.groupId!);
                  const first = group.entries[0];
                  const total = group.total ?? group.entries.reduce((s, e) => s + e.amount, 0);
                  const isSaleGroup = first.referenceType === 'Sale' && !!first.referenceId;
                  const baseRaw = sanitizeEntryDesc(first.description).replace(/\s*\(\d+ de \d+\)\s*$/, '');
                  const baseDesc = isSaleGroup ? clientFromSaleDescription(baseRaw) : stripMethod(baseRaw);
                  const method = methodFromDescription(first.description);
                  const vendor = first.createdBy ? (userById[first.createdBy] || 'Usuario') : '';
                  return (
                    <React.Fragment key={group.groupId}>
                      <tr
                        onClick={() => setExpandedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.groupId!)) next.delete(group.groupId!); else next.add(group.groupId!);
                          return next;
                        })}
                        className={`cursor-pointer transition-colors ${first.type === 'INCOME' ? 'bg-emerald-50/40 hover:bg-emerald-50' : 'bg-rose-50/40 hover:bg-rose-50'}`}
                      >
                        <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-gray-700 tabular-nums font-medium">
                            <Clock size={13} className="text-gray-400" />
                            {formatTime(first.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-2">
                            {isOpen ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
                            <TypePill type={first.type} />
                          </span>
                        </td>
                        <td className="px-4 py-3.5"><CategoryBadge category={first.category} /></td>
                        <td className="px-4 py-3.5 text-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-semibold">
                              <Layers size={10} /> Grupo · {group.entries.length}
                            </span>
                            <span className="font-medium">{baseDesc}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><VendorChip name={vendor} /></td>
                        <td className="px-4 py-3.5">{method ? <MethodPill name={method} /> : <span className="text-gray-300">—</span>}</td>
                        <td className={`px-4 py-3.5 text-right font-bold tabular-nums ${first.type === 'INCOME' ? 'text-primary-700' : 'text-rose-600'}`}>
                          {(() => {
                            const groupSale = isSaleGroup ? salesByRefId.get(first.referenceId!) : undefined;
                            const isCreditPaymentGroup = first.referenceType === 'CreditAccount' && !!first.referenceId;
                            const groupCredit = isCreditPaymentGroup ? creditsByRefId.get(first.referenceId!) : undefined;
                            const isGroupUsd = groupSale?.currency === 'USD';
                            const groupSym = isGroupUsd ? '$' : 'S/';
                            if (groupSale?.isCredit) {
                              return (
                                <div className="flex flex-col items-end leading-tight">
                                  <span className="text-xs uppercase tracking-wider text-orange-600 font-semibold">
                                    C: {groupSym} {(isGroupUsd && groupSale.totalUsd != null ? groupSale.totalUsd : groupSale.total).toFixed(2)}
                                  </span>
                                  <span className="text-primary-700">
                                    P: + {groupSym} {total.toFixed(2)}
                                  </span>
                                  {isGroupUsd && <span className="text-[10px] text-emerald-600 font-semibold">USD</span>}
                                </div>
                              );
                            }
                            if (groupCredit) {
                              const cleared = isPaymentThatClears(groupCredit, group.entries.map((e) => e.id!));
                              return (
                                <div className="flex flex-col items-end leading-tight">
                                  <span className="text-xs uppercase tracking-wider text-orange-600 font-semibold">
                                    C: S/ {groupCredit.totalAmount.toFixed(2)}
                                  </span>
                                  <span className="text-primary-700">
                                    P: + S/ {total.toFixed(2)}
                                  </span>
                                  {cleared && (
                                    <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                      <CheckCircle2 size={10} /> Cancelado
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            const groupDispAmt = isGroupUsd && groupSale?.totalUsd != null ? groupSale.totalUsd : total;
                            return (
                              <span className={isGroupUsd ? 'text-emerald-600' : ''}>
                                {first.type === 'INCOME' ? '+' : '−'} {groupSym} {groupDispAmt.toFixed(2)}
                                {isGroupUsd && <span className="ml-1 text-[10px] font-bold">USD</span>}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3.5 text-center"><span className="text-gray-300">—</span></td>
                        {!isClosed && <td className="px-4 sm:px-6 py-3.5" />}
                      </tr>
                      {isOpen && group.entries.map((e) => renderEntryRow(e, true, `${group.groupId}-${e.id}`, {
                        isClosed, userById, salesByRefId, creditsByRefId, getClientName, openEdit, openDelete, viewSale,
                      }))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- Add modal --- */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={addForm.type === 'INCOME' ? 'Nuevo ingreso' : 'Nuevo egreso'}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold ${addForm.type === 'INCOME' ? 'bg-primary-50 text-primary-700' : 'bg-rose-50 text-rose-700'}`}>
            {addForm.type === 'INCOME' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
            {addForm.type === 'INCOME' ? 'Registrando un ingreso' : 'Registrando un egreso'}
          </div>
          {addForm.type === 'INCOME' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Método de pago</label>
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-gray-400">Cargando métodos de pago...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((pm: { id: string; name: string }) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setAddForm({ ...addForm, paymentMethodName: pm.name })}
                      className={`px-3.5 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                        addForm.paymentMethodName === pm.name
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      {pm.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {addForm.type === 'EXPENSE' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tipo de gasto <span className="text-red-500 normal-case">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EXPENSE_CATEGORIES.filter((c) => c.pickable).map((cat) => {
                  const Icon = cat.icon;
                  const active = addForm.category === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setAddForm({ ...addForm, category: cat.key })}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                        active ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300'
                      }`}
                    >
                      <Icon size={15} />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {addForm.type === 'EXPENSE' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Moneda</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium w-fit">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAddForm({ ...addForm, expenseCurrency: 'PEN' })}
                  className={`px-4 py-2 transition-colors ${addForm.expenseCurrency === 'PEN' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >S/</button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAddForm({ ...addForm, expenseCurrency: 'USD' })}
                  className={`px-4 py-2 border-l border-gray-200 transition-colors ${addForm.expenseCurrency === 'USD' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >$</button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Descripción <span className="text-red-500 normal-case">*</span></label>
            <input value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required autoFocus />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Monto <span className="text-red-500 normal-case">*</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">
                  {addForm.type === 'EXPENSE' && addForm.expenseCurrency === 'USD' ? '$' : 'S/'}
                </span>
                <input type="number" min="0.01" step="0.01" value={addForm.amount || ''} onChange={(e) => setAddForm({ ...addForm, amount: parseFloat(e.target.value) || 0 })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Comprobante</label>
              <VoucherSelector value={addForm.voucherType} onChange={(v) => setAddForm({ ...addForm, voucherType: v === 'NONE' ? v : v, voucherSeries: v === 'NONE' ? '' : addForm.voucherSeries, voucherNumber: v === 'NONE' ? '' : addForm.voucherNumber })} />
            </div>
          </div>
          {addForm.voucherType !== 'NONE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Serie</label>
                <input
                  value={addForm.voucherSeries}
                  onChange={(e) => setAddForm({ ...addForm, voucherSeries: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={addForm.voucherType === 'BOLETA' ? 'B001' : 'F001'}
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Número</label>
                <input
                  value={addForm.voucherNumber}
                  onChange={(e) => setAddForm({ ...addForm, voucherNumber: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0001234"
                  maxLength={12}
                />
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button type="submit" disabled={addEntry.isPending} className={`flex-1 py-2.5 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50 ${addForm.type === 'INCOME' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
              {addEntry.isPending ? 'Registrando...' : addForm.type === 'INCOME' ? 'Registrar ingreso' : 'Registrar egreso'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- Edit modal --- */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar entrada">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-sm text-blue-700">
            Monto anterior: <strong className="tabular-nums">S/ {selectedEntry?.amount.toFixed(2)}</strong>
            {selectedEntry?.createdAt && <span className="text-blue-500 ml-2">· registrado {formatTime(selectedEntry.createdAt)}</span>}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nuevo monto <span className="text-red-500 normal-case">*</span></label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">S/</span>
              <input type="number" min="0.01" step="0.01" value={editForm.amount || ''} onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500" required />
            </div>
          </div>
          {editingIsSale && editingSale && (editingSale.isCredit || (editingSale.payments?.length ?? 0) > 1) ? (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
              Esta venta es a crédito o tiene varios pagos. Para cambiar el método edítala desde <strong>/sales</strong>.
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Método de pago
                {editingIsSale && <span className="ml-2 text-[10px] font-normal text-blue-600 normal-case">(actualiza la venta)</span>}
              </label>
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-gray-400">Cargando métodos de pago...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((pm: { id: string; name: string }) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, paymentMethodName: pm.name })}
                      className={`px-3.5 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                        editForm.paymentMethodName === pm.name
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      {pm.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Comprobante</label>
            <VoucherSelector value={editForm.voucherType} onChange={(v) => setEditForm({ ...editForm, voucherType: v, voucherSeries: v === 'NONE' ? '' : editForm.voucherSeries, voucherNumber: v === 'NONE' ? '' : editForm.voucherNumber })} />
          </div>
          {editForm.voucherType !== 'NONE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Serie</label>
                <input
                  value={editForm.voucherSeries}
                  onChange={(e) => setEditForm({ ...editForm, voucherSeries: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={editForm.voucherType === 'BOLETA' ? 'B001' : 'F001'}
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Número</label>
                <input
                  value={editForm.voucherNumber}
                  onChange={(e) => setEditForm({ ...editForm, voucherNumber: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0001234"
                  maxLength={12}
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Razón del cambio <span className="text-red-500 normal-case">*</span></label>
            <textarea value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" rows={2} required />
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button type="submit" disabled={editEntry.isPending} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm">
              {editEntry.isPending ? 'Guardando...' : 'Guardar cambio'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- Delete modal --- */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar entrada">
        <form onSubmit={handleDelete} className="space-y-4">
          <div className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-red-700">
              Esta acción es <strong>permanente</strong>. {selectedEntry?.referenceType === 'Sale' && (
                <>Si la entrada corresponde a una venta, también <strong>se cancelará la venta</strong> y se devolverá el stock.</>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Razón de eliminación <span className="text-red-500 normal-case">*</span></label>
            <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" rows={2} required />
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button type="submit" disabled={deleteEntryMutation.isPending} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold shadow-sm">
              {deleteEntryMutation.isPending ? 'Eliminando...' : 'Eliminar entrada'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- Close modal --- */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Cerrar caja">
        {(() => {
          const methodBreakdown: Record<string, { income: number; expense: number }> = {};
          activeEntries.forEach((entry) => {
            const m = methodFromDescription(entry.description) || 'Sin método';
            if (!methodBreakdown[m]) methodBreakdown[m] = { income: 0, expense: 0 };
            if (entry.type === 'INCOME') methodBreakdown[m].income += entry.amount;
            else methodBreakdown[m].expense += entry.amount;
          });
          const methods = Object.entries(methodBreakdown).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense));

          return (
            <div className="space-y-4">
              <div className="flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-amber-800">Al cerrar la caja no se podrán agregar, editar ni eliminar entradas.</p>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Saldo apertura</span><span className="font-semibold tabular-nums">S/ {(register?.openingBalance || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-primary-700"><span>+ Ingresos (S/)</span><span className="font-semibold tabular-nums">S/ {totalIncomePen.toFixed(2)}</span></div>
                {totalIncomeUsd > 0 && (
                  <div className="flex justify-between text-emerald-600"><span>+ Ingresos (USD)</span><span className="font-semibold tabular-nums">$ {totalIncomeUsd.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between text-rose-600"><span>− Egresos</span><span className="font-semibold tabular-nums">S/ {totalExpense.toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 mt-2"><span>Balance cierre (S/)</span><span className="tabular-nums">S/ {netBalance.toFixed(2)}</span></div>
              </div>

              {methods.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Desglose por método de pago</label>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Método</th>
                          <th className="px-3 py-2 text-right text-[11px] font-semibold text-primary-600 uppercase tracking-wider">Ingresos</th>
                          <th className="px-3 py-2 text-right text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Egresos</th>
                          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Neto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {methods.map(([method, totals]) => (
                          <tr key={method}>
                            <td className="px-3 py-2 font-medium">{method}</td>
                            <td className="px-3 py-2 text-right text-primary-700 tabular-nums">{totals.income > 0 ? `+ S/ ${totals.income.toFixed(2)}` : '—'}</td>
                            <td className="px-3 py-2 text-right text-rose-600 tabular-nums">{totals.expense > 0 ? `− S/ ${totals.expense.toFixed(2)}` : '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">S/ {(totals.income - totals.expense).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
          );
        })()}
      </Modal>

      {/* --- View Sale modal --- */}
      <Modal isOpen={!!viewingSaleId} onClose={() => setViewingSaleId(null)} title="Detalle de venta" size="lg">
        {!viewingSale ? (
          <div className="py-12 flex items-center justify-center text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Cargando venta...
          </div>
        ) : (() => {
          const sale = viewingSale;
          const paymentLabel = sale.isCredit
            ? 'Crédito'
            : sale.payments && sale.payments.length > 0
              ? sale.payments.map((p: any) => p.paymentMethodName).join(' + ')
              : 'Efectivo';
          const voucherLabel = sale.voucherType === 'BOLETA' ? 'Boleta' : sale.voucherType === 'FACTURA' ? 'Factura' : 'Nota de venta';
          const sellerName = sale.sellerName || (sale.sellerId ? userById[sale.sellerId] : '') || 'Sin asignar';
          // En venta a crédito, "sale.total" es el total de la venta pero la caja
          // solo recibió la suma de sale.payments (anticipo). El saldo queda como deuda.
          const isUsdSaleDetail = sale.currency === 'USD';
          const detailSym = isUsdSaleDetail ? '$' : 'S/';
          const anticipo = sale.isCredit
            ? (sale.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
            : sale.total;
          const pendienteCredito = sale.isCredit ? Math.max(0, sale.total - anticipo) : 0;
          return (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 border ${sale.isCancelled ? 'bg-red-50 border-red-100' : sale.isCredit ? 'bg-orange-50/60 border-orange-100' : 'bg-primary-50/60 border-primary-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${sale.isCancelled ? 'text-red-600' : sale.isCredit ? 'text-orange-700' : 'text-primary-700'}`}>
                      {sale.isCredit ? 'Total de la venta' : 'Total cobrado'}{isUsdSaleDetail ? ' (USD)' : ''}
                    </span>
                    <div className={`text-3xl font-bold mt-1 ${sale.isCancelled ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{detailSym} {sale.total.toFixed(2)}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${sale.isCancelled ? 'bg-red-100 text-red-700' : sale.isCredit ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {sale.isCancelled ? 'Anulada' : sale.isCredit ? 'A crédito' : 'Completada'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2 font-mono">
                  {sale.saleNumber || `NV-${sale.id.slice(-8).toUpperCase()}`}
                  {' · '}
                  {new Date(sale.date).toLocaleDateString('es-PE')}
                  {' '}
                  {new Date(sale.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                </div>
                {sale.isCancelled && sale.cancelReason && (
                  <p className="text-xs text-red-600 mt-2">Razón: {sale.cancelReason}</p>
                )}
                {sale.isCredit && !sale.isCancelled && (
                  <div className="mt-3 pt-3 border-t border-orange-200/70 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-orange-700/80 font-semibold">Cobrado en caja</span>
                      <div className="font-bold text-primary-700 tabular-nums">{detailSym} {anticipo.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-orange-700/80 font-semibold">Saldo a crédito</span>
                      <div className="font-bold text-red-600 tabular-nums">{detailSym} {pendienteCredito.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded-xl p-3">
                  <span className="block text-xs text-gray-500 mb-1.5">Comprobante</span>
                  <div className="text-sm font-medium text-gray-900">{voucherLabel}</div>
                </div>
                <div className="border border-gray-200 rounded-xl p-3">
                  <span className="block text-xs text-gray-500 mb-1.5">Método de pago</span>
                  <div className={`text-sm font-medium ${sale.isCredit ? 'text-orange-600' : 'text-gray-900'}`}>{paymentLabel}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded-xl p-3">
                  <span className="block text-xs text-gray-500 mb-0.5">Cliente</span>
                  <div className={`text-sm font-medium truncate ${sale.clientId ? 'text-gray-900' : 'text-gray-400 italic'}`}>{sale.clientName || 'Sin cliente'}</div>
                </div>
                <div className="border border-gray-200 rounded-xl p-3">
                  <span className="block text-xs text-gray-500 mb-0.5">Vendedor</span>
                  <div className="text-sm font-medium text-gray-900 truncate">{sellerName}</div>
                </div>
              </div>

              {!sale.isCredit && sale.payments && sale.payments.length > 1 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Desglose de pagos</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {sale.payments.map((p: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 font-medium text-gray-700">{p.paymentMethodName}</td>
                          <td className="px-4 py-2 text-right text-primary-600 font-medium">S/ {p.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Productos ({sale.items.length})</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50 text-[11px] text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Producto</th>
                      <th className="px-3 py-2 text-right font-medium">Cant.</th>
                      <th className="px-3 py-2 text-right font-medium">Precio</th>
                      <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sale.items.map((it: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-gray-800 truncate max-w-[220px]" title={it.productName}>{it.productName || it.productId}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">{it.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">S/ {it.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-800">S/ {it.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setViewingSaleId(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cerrar</button>
                <button type="button" onClick={() => { goToSale(sale.id); setViewingSaleId(null); }} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold shadow-sm">Ir a la venta</button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// --- Sub-components ------------------------------------------------------

function PageHeader() {
  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
        <Wallet size={24} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Caja</h1>
        <p className="text-sm text-gray-500 mt-0.5">Pulsa del día — ingresos, egresos y reconciliación</p>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, accent, valueAccent, subValue, subValueAccent }: { icon: any; label: string; value: string; accent: string; valueAccent?: string; subValue?: string; subValueAccent?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}><Icon size={14} /></div>
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueAccent || 'text-gray-800'}`}>{value}</div>
      {subValue && (
        <div className={`text-sm font-semibold tabular-nums mt-1 ${subValueAccent || 'text-emerald-600'}`}>{subValue}</div>
      )}
    </div>
  );
}

function TypePill({ type }: { type: 'INCOME' | 'EXPENSE' }) {
  return type === 'INCOME' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700">
      <ArrowUpCircle size={11} /> Ingreso
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-700">
      <ArrowDownCircle size={11} /> Egreso
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${categoryStyles[category] || categoryStyles.OTHER}`}>
      {categoryLabels[category] || category}
    </span>
  );
}

function MethodPill({ name }: { name: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{name}</span>;
}

function VendorChip({ name }: { name: string }) {
  if (!name) return <span className="text-gray-300">—</span>;
  const color = vendorColor(name);
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${color}`}>{initialsFor(name)}</span>
      <span className="text-sm text-gray-700 font-medium truncate max-w-[140px]">{name}</span>
    </div>
  );
}

function VoucherPill({ type, series, number }: { type: string; series?: string; number?: string }) {
  const ref = series && number ? `${series}-${number}` : '';
  if (type === 'BOLETA') return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100"><ReceiptText size={11} /> Boleta</span>
      {ref && <span className="text-[10px] font-mono text-gray-500 tabular-nums">{ref}</span>}
    </span>
  );
  if (type === 'FACTURA') return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100"><FileText size={11} /> Factura</span>
      {ref && <span className="text-[10px] font-mono text-gray-500 tabular-nums">{ref}</span>}
    </span>
  );
  return <span className="text-gray-300">—</span>;
}

function VoucherSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [
    { value: 'NONE', label: 'Ninguno', activeClass: 'bg-gray-700 text-white border-gray-700' },
    { value: 'BOLETA', label: 'Boleta', activeClass: 'bg-primary-600 text-white border-primary-600' },
    { value: 'FACTURA', label: 'Factura', activeClass: 'bg-blue-600 text-white border-blue-600' },
  ];
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${value === opt.value ? opt.activeClass : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-primary-50">
      <CheckCircle2 size={16} className="text-white/80 mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

// --- Row renderer (extracted to keep main component readable) -----------

interface RowCtx {
  isClosed: boolean;
  userById: Record<string, string>;
  salesByRefId: Map<string, Sale>;
  creditsByRefId: Map<string, CreditAccount>;
  getClientName: (id?: string) => string;
  openEdit: (e: CashRegisterEntry) => void;
  openDelete: (e: CashRegisterEntry) => void;
  viewSale: (saleId: string) => void;
}

/**
 * ¿Este pago (representado por una o más cash-register-entries) llevó la cuenta a 0?
 * Buscamos los CreditPayment que apuntan a esas entries y sumamos lo pagado HASTA
 * incluir esos. Si el acumulado >= totalAmount → este pago cerró la deuda.
 */
function isPaymentThatClears(credit: CreditAccount, entryIds: string[]): boolean {
  if (!credit.payments?.length || !entryIds.length) return false;
  const targetSet = new Set(entryIds);
  const ordered = [...credit.payments].sort(
    (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime(),
  );
  let cumulative = 0;
  for (const p of ordered) {
    cumulative += p.amount;
    if (p.cashRegisterEntryId && targetSet.has(p.cashRegisterEntryId)) {
      return Math.round(cumulative * 100) / 100 >= Math.round(credit.totalAmount * 100) / 100;
    }
  }
  return false;
}

function renderEntryRow(entry: CashRegisterEntry, nested: boolean, key: React.Key, ctx: RowCtx) {
  const { isClosed, userById, salesByRefId, creditsByRefId, getClientName, openEdit, openDelete, viewSale } = ctx;
  const isSale = entry.referenceType === 'Sale' && !!entry.referenceId;
  const sale = isSale ? salesByRefId.get(entry.referenceId!) : undefined;
  const isCreditPayment = entry.referenceType === 'CreditAccount' && !!entry.referenceId;
  const credit = isCreditPayment ? creditsByRefId.get(entry.referenceId!) : undefined;
  const clientId = sale?.clientId || entry.clientId;
  const hasClient = !!clientId;
  const description = isSale ? getClientName(clientId) : stripMethod(entry.description);
  const method = methodFromDescription(entry.description);
  const vendor = entry.createdBy ? (userById[entry.createdBy] || 'Usuario') : '';

  return (
    <tr
      key={key}
      className={`transition-colors ${entry.isDeleted ? 'bg-red-50/50 opacity-60' : entry.type === 'INCOME' ? 'hover:bg-emerald-50/40' : 'hover:bg-rose-50/40'} ${nested ? 'bg-gray-50/40' : ''}`}
    >
      <td className={`px-4 sm:px-6 py-3.5 whitespace-nowrap ${nested ? 'pl-12' : ''}`}>
        <div className="flex items-center gap-2 text-gray-700 tabular-nums font-medium">
          <Clock size={13} className={nested ? 'text-gray-300' : 'text-gray-400'} />
          {formatTime(entry.createdAt)}
        </div>
      </td>
      <td className="px-4 py-3.5"><TypePill type={entry.type} /></td>
      <td className="px-4 py-3.5"><CategoryBadge category={entry.category} /></td>
      <td className="px-4 py-3.5 text-gray-800">
        <div className="flex flex-col">
          <span className={entry.isDeleted ? 'line-through text-gray-400' : isSale && !hasClient ? 'text-gray-400 italic' : ''}>{description}</span>
          {entry.isDeleted && entry.deleteReason && (
            <span className="text-[11px] text-red-500 mt-0.5">Eliminado · {entry.deleteReason}</span>
          )}
          {entry.editHistory?.length > 0 && (
            <span className="text-[11px] text-blue-500 mt-0.5">Editado {entry.editHistory.length}×</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5"><VendorChip name={vendor} /></td>
      <td className="px-4 py-3.5">{method ? <MethodPill name={method} /> : <span className="text-gray-300">—</span>}</td>
      <td className={`px-4 py-3.5 text-right font-semibold tabular-nums ${entry.type === 'INCOME' ? 'text-primary-700' : 'text-rose-600'}`}>
        {(() => {
          const isUsdSale = isSale && sale?.currency === 'USD';
          const isUsdExpense = entry.type === 'EXPENSE' && entry.currency === 'USD';
          const saleSym = (isUsdSale || isUsdExpense) ? '$' : 'S/';
          const isCreditSale = isSale && !!sale?.isCredit;
          if (isCreditSale) {
            return (
              <div className="flex flex-col items-end leading-tight">
                <span className="text-xs uppercase tracking-wider text-orange-600 font-semibold">
                  C: {saleSym} {(isUsdSale && sale!.totalUsd != null ? sale!.totalUsd : sale!.total).toFixed(2)}
                </span>
                <span className="text-primary-700">
                  P: + {saleSym} {entry.amount.toFixed(2)}
                </span>
                {isUsdSale && <span className="text-[10px] text-emerald-600 font-semibold">USD</span>}
              </div>
            );
          }
          if (credit) {
            const cleared = isPaymentThatClears(credit, [entry.id!]);
            return (
              <div className="flex flex-col items-end leading-tight">
                <span className="text-xs uppercase tracking-wider text-orange-600 font-semibold">
                  C: S/ {credit.totalAmount.toFixed(2)}
                </span>
                <span className="text-primary-700">
                  P: + S/ {entry.amount.toFixed(2)}
                </span>
                {cleared && (
                  <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={10} /> Cancelado
                  </span>
                )}
              </div>
            );
          }
          const dispAmt = isUsdSale && sale?.totalUsd != null ? sale.totalUsd : entry.amount;
          const isUsdEntry = isUsdSale || isUsdExpense;
          return (
            <span className={isUsdEntry ? 'text-emerald-600' : ''}>
              {entry.type === 'INCOME' ? '+' : '−'} {saleSym} {dispAmt.toFixed(2)}
              {isUsdEntry && <span className="ml-1 text-[10px] font-bold">USD</span>}
            </span>
          );
        })()}
      </td>
      <td className="px-4 py-3.5 text-center"><VoucherPill type={entry.voucherType} series={entry.voucherSeries} number={entry.voucherNumber} /></td>
      {!isClosed && (
        <td className="px-4 sm:px-6 py-3.5">
          {!entry.isDeleted && !nested && (
            <div className="flex items-center justify-center gap-1">
              {isSale && (
                <button
                  onClick={() => viewSale(entry.referenceId!)}
                  className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg hover:bg-primary-50"
                  title="Ver venta"
                ><Eye size={15} /> Ver</button>
              )}
              <button onClick={() => openEdit(entry)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="Editar"><Edit2 size={15} /></button>
              <button onClick={() => openDelete(entry)} className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Eliminar"><Trash2 size={15} /></button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

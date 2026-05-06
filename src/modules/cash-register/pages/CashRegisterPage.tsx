import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCashRegisterToday, useOpenCashRegister, useAddCashEntry, useEditCashEntry, useDeleteCashEntry, useCloseCashRegister } from '../hooks/useCashRegister';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { useUsers } from '../../users/hooks/useUsers';
import { useRucLookup } from '../../../shared/hooks/useLookup';
import { useSupplierByRuc, useCreateSupplier } from '../../suppliers/hooks/useSuppliers';
import { Modal } from '../../../shared/components/Modal';
import {
  Wallet, TrendingUp, TrendingDown, Edit2, Trash2, Lock, History, ChevronDown, ChevronRight,
  Layers, Clock, ExternalLink, ArrowDownCircle, ArrowUpCircle, Scale, CheckCircle2, AlertCircle,
  ReceiptText, FileText, CircleDashed, Search, Loader2,
} from 'lucide-react';
import type { CashRegisterEntry } from '../../../shared/types';
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

function methodFromDescription(desc: string) {
  const m = desc.match(/\[(.+?)\]$/);
  return m ? m[1] : null;
}

function stripMethod(desc: string) {
  return desc.replace(/\s*\[.*?\]\s*$/, '');
}

// --- Component ------------------------------------------------------------

export function CashRegisterPage() {
  const navigate = useNavigate();
  const { data: register, isLoading } = useCashRegisterToday();
  const openCashRegister = useOpenCashRegister();
  const addEntry = useAddCashEntry();
  const editEntry = useEditCashEntry();
  const deleteEntryMutation = useDeleteCashEntry();
  const closeRegister = useCloseCashRegister();
  const { data: usersData } = useUsers({ limit: 200 });

  const userById = useMemo(() => {
    const list: any[] = Array.isArray(usersData) ? usersData : (usersData as any)?.data || [];
    const map: Record<string, string> = {};
    list.forEach((u) => { map[u.id] = u.fullName || u.username || ''; });
    return map;
  }, [usersData]);

  const [openingAmount, setOpeningAmount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CashRegisterEntry | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: paymentMethods = [] } = usePaymentMethods();
  const rucLookup = useRucLookup();
  const supplierByRuc = useSupplierByRuc();
  const createSupplier = useCreateSupplier();

  const [addForm, setAddForm] = useState({ type: 'INCOME' as string, category: 'OTHER' as string, description: '', amount: 0, voucherType: 'NONE' as string, voucherSeries: '', voucherNumber: '', paymentMethodName: '' });
  const [editForm, setEditForm] = useState({ amount: 0, reason: '', voucherType: 'NONE' as string, voucherSeries: '', voucherNumber: '' });
  const [deleteReason, setDeleteReason] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [rucInput, setRucInput] = useState('');
  const [rucFound, setRucFound] = useState('');
  const [rucLoading, setRucLoading] = useState(false);

  const isClosed = register?.status === 'CLOSED';
  const entries: CashRegisterEntry[] = register?.entries || [];
  const activeEntries = entries.filter((e) => !e.isDeleted);
  const totalIncome = activeEntries.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
  const totalExpense = activeEntries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
  const netBalance = (register?.openingBalance || 0) + totalIncome - totalExpense;

  const openAddIncome = () => { setAddForm({ type: 'INCOME', category: 'OTHER', description: '', amount: 0, voucherType: 'NONE', voucherSeries: '', voucherNumber: '', paymentMethodName: '' }); setShowAddModal(true); };
  const openAddExpense = () => { setAddForm({ type: 'EXPENSE', category: 'OTHER', description: '', amount: 0, voucherType: 'NONE', voucherSeries: '', voucherNumber: '', paymentMethodName: 'Efectivo' }); setRucInput(''); setRucFound(''); setShowAddModal(true); };
  const openEdit = (entry: CashRegisterEntry) => { setSelectedEntry(entry); setEditForm({ amount: entry.amount, reason: '', voucherType: entry.voucherType || 'NONE', voucherSeries: entry.voucherSeries || '', voucherNumber: entry.voucherNumber || '' }); setShowEditModal(true); };

  const handleRucLookup = async () => {
    const ruc = rucInput.trim();
    if (ruc.length !== 11) return;
    setRucLoading(true);
    try {
      const local = await supplierByRuc.mutateAsync(ruc);
      if (local) {
        setRucFound(local.businessName);
        setAddForm((prev) => ({ ...prev, description: local.businessName }));
        setRucLoading(false);
        return;
      }
    } catch { /* not found locally, try SUNAT */ }
    try {
      const result = await rucLookup.mutateAsync(ruc);
      if (result?.razonSocial) {
        await createSupplier.mutateAsync({ ruc, businessName: result.razonSocial, address: result.direccion || '' });
        setRucFound(result.razonSocial);
        setAddForm((prev) => ({ ...prev, description: result.razonSocial }));
      }
    } catch { /* error toasts handled by hooks */ } finally {
      setRucLoading(false);
    }
  };
  const openDelete = (entry: CashRegisterEntry) => { setSelectedEntry(entry); setDeleteReason(''); setShowDeleteModal(true); };

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    await openCashRegister.mutateAsync({ openingBalance: openingAmount });
  };
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const desc = addForm.paymentMethodName ? `${addForm.description} [${addForm.paymentMethodName}]` : addForm.description;
    const { paymentMethodName, ...rest } = addForm;
    await addEntry.mutateAsync({ registerId: register.id, data: { ...rest, description: desc } });
    setShowAddModal(false);
  };
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editEntry.mutateAsync({ registerId: register.id, entryId: selectedEntry!.id, data: editForm });
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
  const goToSale = (saleId: string) => navigate(`/sales?openSaleId=${saleId}`);

  const groupedRows = useMemo(() => groupEntries([...entries].reverse()), [entries]);

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
        <KpiTile icon={TrendingUp} label="Ingresos" value={`+ S/ ${totalIncome.toFixed(2)}`} accent="bg-primary-100 text-primary-700" valueAccent="text-primary-700" />
        <KpiTile icon={TrendingDown} label="Egresos" value={`− S/ ${totalExpense.toFixed(2)}`} accent="bg-rose-100 text-rose-600" valueAccent="text-rose-600" />
        <KpiTile icon={Wallet} label="Balance Neto" value={`S/ ${netBalance.toFixed(2)}`} accent="bg-blue-100 text-blue-700" valueAccent="text-blue-700" />
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
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-gray-400" />
            <h2 className="text-base font-semibold text-gray-800">Movimientos del día</h2>
            <span className="text-xs text-gray-400">· {entries.length} entrada{entries.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <AlertCircle size={22} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Aún no hay movimientos</p>
            <p className="text-xs text-gray-400 mt-1">Las ventas, pagos de crédito y compras aparecerán aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/60">
                  <th className="px-4 sm:px-6 py-3 text-left">Hora</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-left">Descripción</th>
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
                      isClosed, userById, openEdit, openDelete, goToSale,
                    });
                  }
                  const isOpen = expandedGroups.has(group.groupId!);
                  const first = group.entries[0];
                  const total = group.total ?? group.entries.reduce((s, e) => s + e.amount, 0);
                  const baseDesc = stripMethod(first.description.replace(/\s*\(\d+ de \d+\)\s*$/, ''));
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
                          {first.type === 'INCOME' ? '+' : '−'} S/ {total.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-center"><span className="text-gray-300">—</span></td>
                        {!isClosed && <td className="px-4 sm:px-6 py-3.5" />}
                      </tr>
                      {isOpen && group.entries.map((e) => renderEntryRow(e, true, `${group.groupId}-${e.id}`, {
                        isClosed, userById, openEdit, openDelete, goToSale,
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Empresa por RUC <span className="text-gray-400 font-normal normal-case">(opcional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  value={rucInput}
                  onChange={(e) => { setRucInput(e.target.value.replace(/\D/g, '').slice(0, 11)); setRucFound(''); }}
                  className="w-40 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="RUC (11 dígitos)"
                  maxLength={11}
                />
                <button
                  type="button"
                  onClick={handleRucLookup}
                  disabled={rucInput.length !== 11 || rucLoading}
                  className="px-3.5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium"
                >
                  {rucLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Buscar
                </button>
                {rucFound && (
                  <div className="flex-1 min-w-0 px-3.5 py-2.5 bg-primary-50 border border-primary-200 rounded-xl text-sm text-primary-800 font-medium truncate">
                    {rucFound}
                  </div>
                )}
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
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">S/</span>
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
              Esta acción es <strong>permanente</strong>. {selectedEntry?.referenceType === 'SALE' && (
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
                <div className="flex justify-between text-primary-700"><span>+ Ingresos</span><span className="font-semibold tabular-nums">S/ {totalIncome.toFixed(2)}</span></div>
                <div className="flex justify-between text-rose-600"><span>− Egresos</span><span className="font-semibold tabular-nums">S/ {totalExpense.toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 mt-2"><span>Balance cierre</span><span className="tabular-nums">S/ {netBalance.toFixed(2)}</span></div>
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
  openEdit: (e: CashRegisterEntry) => void;
  openDelete: (e: CashRegisterEntry) => void;
  goToSale: (saleId: string) => void;
}

function renderEntryRow(entry: CashRegisterEntry, nested: boolean, key: React.Key, ctx: RowCtx) {
  const { isClosed, userById, openEdit, openDelete, goToSale } = ctx;
  const description = stripMethod(entry.description);
  const method = methodFromDescription(entry.description);
  const vendor = entry.createdBy ? (userById[entry.createdBy] || 'Usuario') : '';
  const isSale = entry.referenceType === 'SALE' && !!entry.referenceId;

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
          <span className={entry.isDeleted ? 'line-through text-gray-400' : ''}>{description}</span>
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
        {entry.type === 'INCOME' ? '+' : '−'} S/ {entry.amount.toFixed(2)}
      </td>
      <td className="px-4 py-3.5 text-center"><VoucherPill type={entry.voucherType} series={entry.voucherSeries} number={entry.voucherNumber} /></td>
      {!isClosed && (
        <td className="px-4 sm:px-6 py-3.5">
          {!entry.isDeleted && !nested && (
            <div className="flex items-center justify-center gap-1">
              {isSale && (
                <button
                  onClick={() => goToSale(entry.referenceId!)}
                  className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
                  title="Ver venta"
                ><ExternalLink size={15} /></button>
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

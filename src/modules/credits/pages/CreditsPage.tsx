import React, { useMemo, useState } from 'react';
import { useCredits, useDeleteCredit, useCreditById, useEditCredit } from '../hooks/useCredits';
import { useClients } from '../../clients/hooks/useClients';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { BatchPaymentModal } from '../components/BatchPaymentModal';
import { EditCreditItemsModal } from '../components/EditCreditItemsModal';
import { EditCreditPaymentModal } from '../components/EditCreditPaymentModal';
import { ExportClientStatementButton } from '../components/ExportClientStatementButton';
import { downloadCreditsSummaryPdf, downloadCreditsDetailedPdf } from '../utils/creditsPdf';
import { CreditCard, DollarSign, Edit2, Trash2, ChevronDown, ChevronRight, Search, User, Eye, ShoppingBag, FileDown, CalendarClock, History, Wrench } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { RegisterHistoricalCreditModal } from '../components/RegisterHistoricalCreditModal';
import type { CreditAccount, Client, CreditPayment } from '../../../shared/types';

type Status = 'PENDING' | 'PARTIAL' | 'PAID';
const STATUS_RANK: Record<Status, number> = { PENDING: 3, PARTIAL: 2, PAID: 1 };

interface ClientGroup {
  clientId: string;
  clientName: string;
  credits: CreditAccount[];
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  worstStatus: Status;
}

const statusLabels: Record<Status, { label: string; class: string }> = {
  PENDING: { label: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' },
  PARTIAL: { label: 'Parcial', class: 'bg-blue-100 text-blue-800' },
  PAID: { label: 'Pagado', class: 'bg-primary-100 text-primary-800' },
};

function getDueState(dueDate?: string, status?: Status): { label: string; class: string; days: number | null } {
  if (!dueDate) return { label: '—', class: 'text-gray-400', days: null };
  if (status === 'PAID') return { label: new Date(dueDate).toLocaleDateString('es-PE'), class: 'text-gray-400', days: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate.slice(0, 10) + 'T00:00:00');
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  const label = due.toLocaleDateString('es-PE');
  if (days < 0) return { label: `${label} · vencido ${-days}d`, class: 'text-red-600 font-medium', days };
  if (days === 0) return { label: `${label} · hoy`, class: 'text-red-500 font-medium', days };
  if (days <= 7) return { label: `${label} · ${days}d`, class: 'text-orange-600', days };
  return { label, class: 'text-gray-600', days };
}

const PAGE_SIZE = 10;

export function CreditsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [batchClient, setBatchClient] = useState<{ id: string; name: string; credits: CreditAccount[] } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editDueCredit, setEditDueCredit] = useState<CreditAccount | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<CreditAccount | null>(null);
  const [editPayment, setEditPayment] = useState<CreditPayment | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);
  const { data: detailCredit } = useCreditById(showDetailModal && selectedCredit ? selectedCredit.id : '');
  const fullCredit: CreditAccount | null = detailCredit || selectedCredit;

  const { data, isLoading } = useCredits({ limit: 1000, status: statusFilter || undefined });
  const { data: clientsData } = useClients({ limit: 500 });
  const deleteCreditMutation = useDeleteCredit();
  const editCreditMutation = useEditCredit();

  const credits: CreditAccount[] = data?.data || [];
  const clients: Client[] = clientsData?.data || [];

  const clientMap = useMemo(() => new Map<string, Client>(clients.map((c: Client) => [c.id, c])), [clients]);
  const getClientName = (id: string) => clientMap.get(id)?.name || 'N/A';

  const groups: ClientGroup[] = useMemo(() => {
    const byClient = new Map<string, CreditAccount[]>();
    for (const credit of credits) {
      const arr = byClient.get(credit.clientId) || [];
      arr.push(credit);
      byClient.set(credit.clientId, arr);
    }

    const result: ClientGroup[] = [];
    for (const [clientId, clientCredits] of byClient.entries()) {
      const totalAmount = clientCredits.reduce((s, c) => s + c.totalAmount, 0);
      const paidAmount = clientCredits.reduce((s, c) => s + c.paidAmount, 0);
      const pendingAmount = clientCredits.reduce((s, c) => s + c.pendingAmount, 0);
      const worstStatus = clientCredits.reduce<Status>(
        (worst, c) => (STATUS_RANK[c.status as Status] > STATUS_RANK[worst] ? (c.status as Status) : worst),
        'PAID',
      );
      // Ocultamos grupos huérfanos sin valor: cliente eliminado + total en cero.
      // No se pierde nada útil — son créditos basura (probablemente pruebas o datos legacy).
      const isOrphanGarbage = !clientMap.has(clientId) && totalAmount === 0;
      if (isOrphanGarbage) continue;
      result.push({
        clientId,
        clientName: clientMap.get(clientId)?.name || 'N/A',
        credits: clientCredits.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        totalAmount,
        paidAmount,
        pendingAmount,
        worstStatus,
      });
    }

    const searchLower = search.trim().toLowerCase();
    const filtered = searchLower
      ? result.filter((g) => g.clientName.toLowerCase().includes(searchLower))
      : result;

    return filtered.sort((a, b) => b.pendingAmount - a.pendingAmount);
  }, [credits, clientMap, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedGroups = groups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleExpanded = (clientId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const openBatchForGroup = (group: ClientGroup) => {
    const openCredits = group.credits.filter((c) => c.status !== 'PAID');
    if (openCredits.length === 0) return;
    setBatchClient({ id: group.clientId, name: group.clientName, credits: openCredits });
  };
  const openDetail = (credit: CreditAccount) => {
    setSelectedCredit(credit);
    setShowDetailModal(true);
  };
  const openEdit = (credit: CreditAccount) => {
    setSelectedCredit(credit);
    setShowEditModal(true);
  };
  const openDelete = (credit: CreditAccount) => {
    setSelectedCredit(credit);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    await deleteCreditMutation.mutateAsync(selectedCredit!.id);
    setShowDeleteModal(false);
  };

  const openEditDue = (credit: CreditAccount) => {
    setEditDueCredit(credit);
    setEditDueDate(credit.dueDate ? credit.dueDate.slice(0, 10) : '');
  };

  const handleSaveDueDate = async () => {
    if (!editDueCredit || !editDueDate) return;
    await editCreditMutation.mutateAsync({ creditId: editDueCredit.id, data: { dueDate: editDueDate } });
    setEditDueCredit(null);
    setEditDueDate('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CreditCard size={24} /> Créditos
        </h1>
        <div className="flex items-center gap-2">
        <Link
          to="/credits/migrate"
          className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100"
          title="Reasignar fecha de créditos mal-fechados"
        >
          <Wrench size={14} />
          Migrar fechas
        </Link>
        <button
          type="button"
          onClick={() => setShowHistoricalModal(true)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm"
        >
          <History size={16} />
          Deuda histórica
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportMenu((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300"
          >
            <FileDown size={16} />
            Exportar PDF
            <ChevronDown size={14} />
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                <button
                  type="button"
                  onClick={() => {
                    downloadCreditsSummaryPdf({
                      credits: groups.flatMap((g) => g.credits),
                      clients,
                      filters: { search: search || undefined, status: statusFilter || undefined },
                    });
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                >
                  <div className="font-medium text-gray-800">Resumen por fecha</div>
                  <div className="text-xs text-gray-500">Agrupa créditos por día, con totales</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadCreditsDetailedPdf({
                      credits: groups.flatMap((g) => g.credits),
                      clients,
                      filters: { search: search || undefined, status: statusFilter || undefined },
                    });
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-t border-gray-100"
                >
                  <div className="font-medium text-gray-800">Detallado</div>
                  <div className="text-xs text-gray-500">Por cliente, con productos y pagos</div>
                </button>
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      <RegisterHistoricalCreditModal
        isOpen={showHistoricalModal}
        onClose={() => setShowHistoricalModal(false)}
      />

      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar cliente..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="PARTIAL">Parcial</option>
          <option value="PAID">Pagado</option>
        </select>
        <div className="text-sm text-gray-500 ml-auto">
          {groups.length} {groups.length === 1 ? 'cliente' : 'clientes'}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : pagedGroups.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <User size={40} className="mx-auto mb-2 opacity-50" />
            <div>No hay créditos que coincidan</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pagedGroups.map((group) => {
              const isOpen = expanded.has(group.clientId);
              const st = statusLabels[group.worstStatus];
              return (
                <div key={group.clientId}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpanded(group.clientId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpanded(group.clientId);
                      }
                    }}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                  >
                    <div className="text-gray-400">
                      {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-semibold text-sm shrink-0">
                      {group.clientName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{group.clientName}</div>
                      <div className="text-xs text-gray-500">
                        {group.credits.length} {group.credits.length === 1 ? 'cuenta' : 'cuentas'}
                      </div>
                    </div>
                    <div className="hidden md:block text-right">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="text-sm font-medium text-gray-700">S/ {group.totalAmount.toFixed(2)}</div>
                    </div>
                    <div className="hidden md:block text-right">
                      <div className="text-xs text-gray-500">Pagado</div>
                      <div className="text-sm font-medium text-primary-600">S/ {group.paidAmount.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Pendiente</div>
                      <div className="text-base font-bold text-red-600">S/ {group.pendingAmount.toFixed(2)}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.class}`}>{st.label}</span>
                    {group.pendingAmount > 0 && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          openBatchForGroup(group);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            openBatchForGroup(group);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors cursor-pointer"
                      >
                        <DollarSign size={13} /> Pagar
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/credits/client/${group.clientId}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/credits/client/${group.clientId}`);
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 hidden lg:inline cursor-pointer"
                      title="Ver histórico del cliente"
                    >
                      Ver histórico
                    </span>
                    {(() => {
                      const c = clientMap.get(group.clientId);
                      return c ? (
                        <ExportClientStatementButton
                          client={c}
                          credits={group.credits}
                          variant="icon"
                        />
                      ) : null;
                    })()}
                  </div>

                  {isOpen && (
                    <div className="bg-gray-50/60 px-5 pb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 text-left">
                              <th className="py-2 pr-3 font-medium">Cuenta</th>
                              <th className="py-2 pr-3 font-medium">Fecha</th>
                              <th className="py-2 pr-3 font-medium">Vencimiento</th>
                              <th className="py-2 pr-3 font-medium">Total</th>
                              <th className="py-2 pr-3 font-medium">Pagado</th>
                              <th className="py-2 pr-3 font-medium">Pendiente</th>
                              <th className="py-2 pr-3 font-medium">Estado</th>
                              <th className="py-2 pr-3 font-medium">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {group.credits.map((c) => {
                              const cst = statusLabels[c.status as Status];
                              const dueState = getDueState(c.dueDate, c.status as Status);
                              return (
                                <tr key={c.id} className="hover:bg-white">
                                  <td className="py-2 pr-3">
                                    {c.name ? (
                                      <span className="font-medium text-gray-800">{c.name}</span>
                                    ) : (
                                      <span className="text-gray-400 italic">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-3 text-gray-600">
                                    {new Date(c.createdAt).toLocaleDateString('es-PE')}
                                  </td>
                                  <td className={`py-2 pr-3 text-xs ${dueState.class}`}>
                                    <button
                                      onClick={() => openEditDue(c)}
                                      className="inline-flex items-center gap-1 hover:underline"
                                      title={c.dueDate ? 'Editar fecha límite' : 'Establecer fecha límite'}
                                    >
                                      <CalendarClock size={12} />
                                      {dueState.label}
                                    </button>
                                  </td>
                                  <td className="py-2 pr-3 text-gray-700">S/ {c.totalAmount.toFixed(2)}</td>
                                  <td className="py-2 pr-3 text-primary-600">S/ {c.paidAmount.toFixed(2)}</td>
                                  <td className="py-2 pr-3 text-red-600 font-medium">S/ {c.pendingAmount.toFixed(2)}</td>
                                  <td className="py-2 pr-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cst.class}`}>{cst.label}</span>
                                  </td>
                                  <td className="py-2 pr-3">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => openDetail(c)}
                                        className="text-gray-500 hover:text-primary-600"
                                        title="Ver detalle (productos, historial)"
                                      >
                                        <Eye size={14} />
                                      </button>
                                      <button
                                        onClick={() => openEdit(c)}
                                        className="text-blue-600 hover:text-blue-800"
                                        title="Editar productos"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        onClick={() => openDelete(c)}
                                        className="text-red-600 hover:text-red-800"
                                        title="Eliminar"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />

      {batchClient && (
        <BatchPaymentModal
          isOpen={!!batchClient}
          onClose={() => setBatchClient(null)}
          clientId={batchClient.id}
          clientName={batchClient.name}
          openCredits={batchClient.credits}
        />
      )}

      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Detalle de la cuenta" size="xl">
        {fullCredit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Cuenta</div>
                <div className="text-sm font-medium text-gray-800">
                  {fullCredit.name || <span className="italic text-gray-400">Sin nombre</span>}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Fecha</div>
                <div className="text-sm font-medium text-gray-800">
                  {new Date(fullCredit.createdAt).toLocaleDateString('es-PE')}
                </div>
              </div>
              <div className="bg-primary-50 rounded-lg p-3">
                <div className="text-xs text-primary-700">Pagado</div>
                <div className="text-sm font-bold text-primary-700">S/ {fullCredit.paidAmount.toFixed(2)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-600">Pendiente</div>
                <div className="text-sm font-bold text-red-600">S/ {fullCredit.pendingAmount.toFixed(2)}</div>
              </div>
            </div>

            {fullCredit.saleDetails && fullCredit.saleDetails.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin pr-1">
                {fullCredit.saleDetails.map((sale, sIdx) => (
                  <div key={sIdx} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                      <ShoppingBag size={12} /> Venta {sIdx + 1} — {new Date(sale.date).toLocaleDateString('es-PE')} · S/ {sale.total.toFixed(2)}
                    </div>
                    <div className="border border-gray-200 rounded overflow-hidden bg-white">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">Producto</th>
                            <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">Almacén</th>
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">Cant.</th>
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">P. Unit.</th>
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sale.items.map((item: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-3 py-1.5 font-medium">{item.productName}</td>
                              <td className="px-3 py-1.5 text-gray-600">{item.companyName}</td>
                              <td className="px-3 py-1.5 text-right">{item.quantity}</td>
                              <td className="px-3 py-1.5 text-right">S/ {item.unitPrice.toFixed(2)}</td>
                              <td className="px-3 py-1.5 text-right font-medium">S/ {item.subtotal.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-gray-400">
                {fullCredit.saleIds && fullCredit.saleIds.length > 0
                  ? `Esta cuenta tiene ${fullCredit.saleIds.length} venta(s) asociadas, pero no se pudieron cargar los productos. Refresca la página o contacta a soporte.`
                  : 'No hay ventas vinculadas a esta cuenta.'}
              </div>
            )}

            {fullCredit.payments && fullCredit.payments.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-xs font-semibold text-gray-500 mb-2">Historial de abonos</div>
                <div className="space-y-1.5">
                  {fullCredit.payments.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-primary-50/60 rounded px-3 py-1.5 text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-gray-500">{new Date(p.paymentDate).toLocaleDateString('es-PE')}</span>
                        <span className="font-medium text-primary-700">S/ {p.amount.toFixed(2)}</span>
                        {p.paymentMethodName && (
                          <span className="text-xs bg-white border rounded px-1.5 py-0.5 text-gray-600">{p.paymentMethodName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {p.receivedByName && <span className="text-xs text-gray-400">por {p.receivedByName}</span>}
                        <button
                          type="button"
                          onClick={() => setEditPayment(p)}
                          title="Editar abono"
                          className="p-1 rounded hover:bg-white text-gray-500 hover:text-primary-600"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <EditCreditItemsModal
        credit={showEditModal ? selectedCredit : null}
        onClose={() => setShowEditModal(false)}
      />

      <EditCreditPaymentModal
        isOpen={!!editPayment}
        onClose={() => setEditPayment(null)}
        credit={fullCredit}
        payment={editPayment}
      />


      <Modal isOpen={!!editDueCredit} onClose={() => setEditDueCredit(null)} title="Fecha límite de pago">
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <div>Cuenta: <span className="font-medium">{editDueCredit?.name || '—'}</span></div>
            <div>Pendiente: <span className="text-red-600 font-medium">S/ {editDueCredit?.pendingAmount.toFixed(2)}</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha límite</label>
            <input
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-400">El cliente recibirá alertas cuando se aproxime el vencimiento.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEditDueCredit(null)}
              className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveDueDate}
              disabled={!editDueDate || editCreditMutation.isPending}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editCreditMutation.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar Crédito">
        <div className="space-y-4">
          <div className="bg-red-50 p-3 rounded-lg text-sm text-red-800">
            <p className="font-medium">¿Estás seguro de eliminar este crédito?</p>
            <p className="mt-1">Esta acción no se puede deshacer.</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <div>Cliente: <span className="font-medium">{selectedCredit ? getClientName(selectedCredit.clientId) : ''}</span></div>
            <div>Total: <span className="font-medium">S/ {selectedCredit?.totalAmount.toFixed(2)}</span></div>
            <div>Pagado: <span className="text-primary-600">S/ {selectedCredit?.paidAmount.toFixed(2)}</span></div>
            <div>Pendiente: <span className="text-red-600 font-medium">S/ {selectedCredit?.pendingAmount.toFixed(2)}</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button onClick={handleDelete} disabled={deleteCreditMutation.isPending} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">{deleteCreditMutation.isPending ? 'Eliminando...' : 'Eliminar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

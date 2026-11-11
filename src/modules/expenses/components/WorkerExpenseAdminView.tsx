import { useEffect, useMemo, useState } from 'react';
import { Settings, ClipboardCheck, Save, Check, X } from 'lucide-react';
import { useUsers } from '../../users/hooks/useUsers';
import {
  useWorkerExpenseBudgets,
  useSetWorkerExpenseBudget,
  useWorkerExpenseReports,
  useReviewWorkerExpenseReport,
  useSetWorkerExpenseAdvance,
} from '../hooks/useWorkerExpenses';
import { formatDateEs, formatInstantEs } from '../../../shared/utils/date.util';
import {
  confirmDiscardExpenseChanges,
  useUnsavedExpenseChanges,
} from '../hooks/useUnsavedExpenseChanges';
import type {
  User,
  WorkerExpenseBudget,
  WorkerExpenseReport,
  WorkerExpenseReportStatus,
} from '../../../shared/types';

const CATEGORIES: {
  key: keyof Omit<WorkerExpenseBudget, 'id' | 'workerId' | 'updatedAt'>;
  label: string;
}[] = [
  { key: 'alojamiento', label: 'Alojamiento' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'combustible', label: 'Combustible' },
  { key: 'alimentacion', label: 'Alimentación' },
  { key: 'otros', label: 'Otros' },
];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Borrador', className: 'bg-gray-100 text-gray-600' },
  SUBMITTED: { label: 'En revisión', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Aprobado', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rechazado', className: 'bg-rose-100 text-rose-700' },
};

const STATUS_FILTERS: { value: WorkerExpenseReportStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'SUBMITTED', label: 'En revisión' },
  { value: 'APPROVED', label: 'Aprobados' },
  { value: 'REJECTED', label: 'Rechazados' },
  { value: 'DRAFT', label: 'Borradores' },
];

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function BudgetSection() {
  const { data: usersData } = useUsers({ role: 'VENDEDOR', limit: 200 });
  const { data: usersFieldData } = useUsers({ role: 'VENDEDOR_CAMPO', limit: 200 });
  const { data: budgets } = useWorkerExpenseBudgets();
  const setBudget = useSetWorkerExpenseBudget();

  const workers: User[] = useMemo(() => {
    const a: User[] = usersData?.data || [];
    const b: User[] = usersFieldData?.data || [];
    return [...a, ...b];
  }, [usersData, usersFieldData]);

  const budgetByWorker = useMemo(() => {
    const map = new Map<string, WorkerExpenseBudget>();
    (budgets || []).forEach((b: WorkerExpenseBudget) => map.set(b.workerId, b));
    return map;
  }, [budgets]);

  const [drafts, setDrafts] = useState<Record<string, Partial<WorkerExpenseBudget>>>({});

  useUnsavedExpenseChanges(Object.keys(drafts).length > 0);

  function getValue(workerId: string, key: keyof WorkerExpenseBudget): number {
    if (drafts[workerId]?.[key] !== undefined) return Number(drafts[workerId][key]);
    const b = budgetByWorker.get(workerId);
    return b ? Number(b[key] || 0) : 0;
  }

  function setValue(workerId: string, key: keyof WorkerExpenseBudget, value: number) {
    setDrafts((prev) => ({ ...prev, [workerId]: { ...prev[workerId], [key]: value } }));
  }

  function save(workerId: string) {
    const draft = drafts[workerId];
    if (!draft) return;
    setBudget.mutate(
      { workerId, data: draft },
      {
        onSuccess: () =>
          setDrafts((prev) => {
            const next = { ...prev };
            delete next[workerId];
            return next;
          }),
      },
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <Settings size={16} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-700">
          Topes mensuales de viáticos por trabajador (S/)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2 font-medium">Trabajador</th>
              {CATEGORIES.map((c) => (
                <th key={c.key} className="px-4 py-2 font-medium text-right">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {workers.length === 0 ? (
              <tr>
                <td colSpan={CATEGORIES.length + 2} className="px-4 py-8 text-center text-gray-400">
                  No hay vendedores registrados
                </td>
              </tr>
            ) : (
              workers.map((w) => {
                const hasDraft = !!drafts[w.id];
                return (
                  <tr key={w.id}>
                    <td className="px-4 py-2 font-medium text-gray-700">{w.fullName}</td>
                    {CATEGORIES.map((c) => (
                      <td key={c.key} className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={setBudget.isPending}
                          aria-label={`${w.fullName}: ${c.label}`}
                          value={getValue(w.id, c.key)}
                          onChange={(e) => setValue(w.id, c.key, Number(e.target.value))}
                          className="w-24 px-2 py-1 border rounded-lg text-right"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => save(w.id)}
                        disabled={!hasDraft || setBudget.isPending}
                        className="p-1.5 text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 disabled:opacity-40"
                        title="Guardar"
                      >
                        <Save size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdvanceForm({
  report,
  onDirtyChange,
}: {
  report: WorkerExpenseReport;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const advance = useSetWorkerExpenseAdvance();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(report.depositedAmount ?? 0));
  const [note, setNote] = useState('');
  const [version, setVersion] = useState(report.version ?? 0);
  const stale = editing && version !== (report.version ?? 0);
  const dirty = editing && (!!note || amount !== String(report.depositedAmount ?? 0));
  useUnsavedExpenseChanges(dirty);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  return (
    <div className="mb-3 p-3 rounded-lg border bg-white text-sm">
      <p>
        Adelanto: <strong>S/ {Number(report.depositedAmount ?? 0).toFixed(2)}</strong> ·{' '}
        {report.advanceConfirmedAt
          ? 'Confirmado por administración'
          : 'Sin confirmación administrativa'}
      </p>
      {report.status !== 'APPROVED' && !editing && (
        <button
          className="text-primary-700 underline mt-1"
          onClick={() => {
            setAmount(String(report.depositedAmount ?? 0));
            setVersion(report.version ?? 0);
            setEditing(true);
          }}
        >
          Registrar o confirmar adelanto
        </button>
      )}
      {editing && (
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="text-xs">
            Total adelantado (S/)
            <input
              aria-label="Total adelantado"
              type="number"
              min="0"
              step="0.01"
              disabled={advance.isPending}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="block w-32 px-3 py-2 border rounded-lg text-sm"
            />
          </label>
          <label className="text-xs flex-1 min-w-[180px]">
            Referencia o motivo
            <input
              aria-label="Referencia del adelanto"
              maxLength={500}
              disabled={advance.isPending}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="block w-full px-3 py-2 border rounded-lg text-sm"
            />
          </label>
          <button
            disabled={
              advance.isPending || stale || !note.trim() || amount === '' || Number(amount) < 0
            }
            className="px-3 py-2 border rounded-lg text-primary-700 disabled:opacity-50"
            onClick={() =>
              advance.mutate(
                { id: report.id, version, depositedAmount: Number(amount), note },
                {
                  onSuccess: () => {
                    setEditing(false);
                    setNote('');
                  },
                },
              )
            }
          >
            Confirmar adelanto
          </button>
          <button
            disabled={advance.isPending}
            className="px-3 py-2 text-gray-600"
            onClick={() => {
              if (confirmDiscardExpenseChanges(dirty)) {
                setEditing(false);
                setNote('');
              }
            }}
          >
            Cancelar
          </button>
          {stale && (
            <p role="alert" className="w-full text-xs text-amber-700">
              El reporte cambió en otra sesión.{' '}
              <button
                className="underline"
                onClick={() => {
                  if (confirmDiscardExpenseChanges(dirty)) {
                    setAmount(String(report.depositedAmount ?? 0));
                    setVersion(report.version ?? 0);
                    setNote('');
                  }
                }}
              >
                Recargar adelanto
              </button>
            </p>
          )}
          <p className="w-full text-xs text-gray-500">
            Registra el total entregado de este mes. Este registro no genera movimientos de caja.
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewSection() {
  const [advanceDirty, setAdvanceDirty] = useState(false);
  const [status, setStatus] = useState<WorkerExpenseReportStatus | ''>('SUBMITTED');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const notesDraft = expandedId ? notesDrafts[expandedId] || '' : '';
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [workerId, setWorkerId] = useState('');
  const { data: usersData } = useUsers({ limit: 200 });
  useUnsavedExpenseChanges(Object.values(notesDrafts).some(Boolean));

  const {
    data: reports,
    isLoading,
    isError,
    refetch,
  } = useWorkerExpenseReports({
    status: status || undefined,
    workerId: workerId || undefined,
    month: month ? Number(month) : undefined,
    year: /^20\d{2}$/.test(year) || year === '2100' ? Number(year) : undefined,
  });
  const review = useReviewWorkerExpenseReport();

  function changeFilter(action: () => void) {
    if (!confirmDiscardExpenseChanges(advanceDirty)) return;
    setExpandedId(null);
    action();
  }

  function toggle(report: WorkerExpenseReport) {
    if (!confirmDiscardExpenseChanges(advanceDirty)) return;
    if (expandedId === report.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(report.id);
  }

  function handleReview(report: WorkerExpenseReport, decision: 'APPROVED' | 'REJECTED') {
    if (advanceDirty) return;
    review.mutate(
      {
        id: report.id,
        version: report.version ?? 0,
        status: decision,
        reviewNotes: notesDraft.trim() || undefined,
      },
      {
        onSuccess: () => {
          setExpandedId(null);
          setNotesDrafts((prev) => {
            const next = { ...prev };
            delete next[report.id];
            return next;
          });
        },
      },
    );
  }

  const list: WorkerExpenseReport[] = reports || [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Reportes de viáticos</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              disabled={review.isPending}
              onClick={() => changeFilter(() => setStatus(f.value))}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                status === f.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 flex flex-wrap gap-2 border-b">
        <select
          aria-label="Filtrar trabajador"
          value={workerId}
          onChange={(e) => changeFilter(() => setWorkerId(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm max-w-full"
        >
          <option value="">Todos los trabajadores</option>
          {(usersData?.data || [])
            .filter((u: User) => u.role !== 'ADMIN')
            .map((u: User) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
        </select>
        <select
          aria-label="Filtrar mes"
          value={month}
          onChange={(e) => changeFilter(() => setMonth(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todos los meses</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <input
          aria-label="Filtrar año"
          type="number"
          min={2000}
          max={2100}
          placeholder="Año"
          value={year}
          onChange={(e) => {
            const value = e.target.value;
            changeFilter(() => setYear(value));
          }}
          className="border rounded-lg px-3 py-2 text-sm w-24"
        />
      </div>
      {isError ? (
        <div role="alert" className="p-4 text-rose-700">
          No se pudieron cargar los reportes.{' '}
          <button className="underline" onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      ) : isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : list.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          No hay reportes para este filtro
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {list.map((report) => {
            const badge = STATUS_BADGES[report.status];
            const total =
              (report.entries || []).reduce(
                (s, e) => s + Math.round((Number(e.amount) || 0) * 100),
                0,
              ) / 100;
            const isOpen = expandedId === report.id;
            return (
              <div key={report.id}>
                <button
                  disabled={review.isPending}
                  onClick={() => toggle(report)}
                  className="w-full px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">
                      {report.workerName || 'Trabajador'} · {MONTH_NAMES[report.month - 1]}{' '}
                      {report.year}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {report.entries?.length || 0} gasto
                      {(report.entries?.length || 0) !== 1 ? 's' : ''} · S/ {total.toFixed(2)}
                      {report.depositedAmount != null && (
                        <> · depositado S/ {Number(report.depositedAmount).toFixed(2)}</>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 bg-gray-50/50">
                    <AdvanceForm key={report.id} report={report} onDirtyChange={setAdvanceDirty} />
                    <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-500 border-b border-gray-100">
                            <th className="px-3 py-2 font-medium">Fecha</th>
                            <th className="px-3 py-2 font-medium">Categoría</th>
                            <th className="px-3 py-2 font-medium">Descripción</th>
                            <th className="px-3 py-2 font-medium">Comprobante</th>
                            <th className="px-3 py-2 font-medium text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(report.entries || []).map((e, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5">{formatDateEs(e.date)}</td>
                              <td className="px-3 py-1.5">{e.category}</td>
                              <td className="px-3 py-1.5">{e.description || '—'}</td>
                              <td className="px-3 py-1.5">{e.invoiceNumber || '—'}</td>
                              <td className="px-3 py-1.5 text-right">
                                S/ {Number(e.amount).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {report.status === 'SUBMITTED' ? (
                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Observaciones (opcional, requerido para rechazar)"
                          value={notesDraft}
                          disabled={review.isPending}
                          onChange={(e) =>
                            setNotesDrafts((prev) => ({ ...prev, [report.id]: e.target.value }))
                          }
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        />
                        <button
                          onClick={() => handleReview(report, 'APPROVED')}
                          disabled={review.isPending || advanceDirty}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check size={15} /> Aprobar
                        </button>
                        <button
                          onClick={() => handleReview(report, 'REJECTED')}
                          disabled={review.isPending || advanceDirty || !notesDraft.trim()}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
                          title={!notesDraft.trim() ? 'Indica el motivo del rechazo' : ''}
                        >
                          <X size={15} /> Rechazar
                        </button>
                      </div>
                    ) : report.reviewNotes ? (
                      <div className="mt-3 text-xs text-gray-600">
                        <strong>Observaciones:</strong> {report.reviewNotes}
                      </div>
                    ) : null}
                    {!!report.history?.length && (
                      <details className="mt-3 text-xs text-gray-600">
                        <summary className="cursor-pointer">
                          Historial de revisión y adelantos
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {report.history.map((event, index) => (
                            <li key={index}>
                              {formatInstantEs(event.at)} ·{' '}
                              {(
                                {
                                  ADVANCE_CONFIRMED: 'Adelanto confirmado',
                                  SUBMITTED: 'Enviado',
                                  APPROVED: 'Aprobado',
                                  REJECTED: 'Rechazado',
                                } as Record<string, string>
                              )[event.action] || event.action}
                              {event.amount != null ? ` · S/ ${event.amount.toFixed(2)}` : ''}
                              {event.note ? ` · ${event.note}` : ''}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WorkerExpenseAdminView() {
  return (
    <div className="space-y-6">
      <ReviewSection />
      <details className="rounded-xl border bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">Configurar topes mensuales</summary>
        <div className="mt-4">
          <BudgetSection />
        </div>
      </details>
    </div>
  );
}

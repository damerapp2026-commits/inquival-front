import { useMemo, useState } from 'react';
import { Settings, ClipboardCheck, Save, Check, X } from 'lucide-react';
import { useUsers } from '../../users/hooks/useUsers';
import {
  useWorkerExpenseBudgets,
  useSetWorkerExpenseBudget,
  useWorkerExpenseReports,
  useReviewWorkerExpenseReport,
} from '../hooks/useWorkerExpenses';
import type { User, WorkerExpenseBudget, WorkerExpenseReport, WorkerExpenseReportStatus } from '../../../shared/types';

const CATEGORIES: { key: keyof Omit<WorkerExpenseBudget, 'id' | 'workerId' | 'updatedAt'>; label: string }[] = [
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
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
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
    setBudget.mutate({ workerId, data: draft });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[workerId];
      return next;
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <Settings size={16} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-700">Topes mensuales de viáticos por trabajador (S/)</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2 font-medium">Trabajador</th>
              {CATEGORIES.map((c) => (
                <th key={c.key} className="px-4 py-2 font-medium text-right">{c.label}</th>
              ))}
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {workers.length === 0 ? (
              <tr><td colSpan={CATEGORIES.length + 2} className="px-4 py-8 text-center text-gray-400">No hay vendedores registrados</td></tr>
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

function ReviewSection() {
  const [status, setStatus] = useState<WorkerExpenseReportStatus | ''>('SUBMITTED');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const { data: reports, isLoading } = useWorkerExpenseReports(status ? { status } : undefined);
  const review = useReviewWorkerExpenseReport();

  function toggle(report: WorkerExpenseReport) {
    if (expandedId === report.id) { setExpandedId(null); return; }
    setExpandedId(report.id);
    setNotesDraft('');
  }

  function handleReview(report: WorkerExpenseReport, decision: 'APPROVED' | 'REJECTED') {
    review.mutate({ id: report.id, status: decision, reviewNotes: notesDraft || undefined });
    setExpandedId(null);
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
              onClick={() => setStatus(f.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                status === f.value ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : list.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No hay reportes para este filtro</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {list.map((report) => {
            const badge = STATUS_BADGES[report.status];
            const total = (report.entries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
            const isOpen = expandedId === report.id;
            return (
              <div key={report.id}>
                <button onClick={() => toggle(report)} className="w-full px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">
                      {report.workerName || 'Trabajador'} · {MONTH_NAMES[report.month - 1]} {report.year}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {report.entries?.length || 0} gasto{(report.entries?.length || 0) !== 1 ? 's' : ''} · S/ {total.toFixed(2)}
                      {report.depositedAmount != null && <> · depositado S/ {Number(report.depositedAmount).toFixed(2)}</>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badge.className}`}>{badge.label}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 bg-gray-50/50">
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
                              <td className="px-3 py-1.5">{new Date(e.date).toLocaleDateString('es-PE')}</td>
                              <td className="px-3 py-1.5">{e.category}</td>
                              <td className="px-3 py-1.5">{e.description || '—'}</td>
                              <td className="px-3 py-1.5">{e.invoiceNumber || '—'}</td>
                              <td className="px-3 py-1.5 text-right">S/ {Number(e.amount).toFixed(2)}</td>
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
                          onChange={(e) => setNotesDraft(e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        />
                        <button
                          onClick={() => handleReview(report, 'APPROVED')}
                          disabled={review.isPending}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check size={15} /> Aprobar
                        </button>
                        <button
                          onClick={() => handleReview(report, 'REJECTED')}
                          disabled={review.isPending || !notesDraft.trim()}
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
      <BudgetSection />
      <ReviewSection />
    </div>
  );
}

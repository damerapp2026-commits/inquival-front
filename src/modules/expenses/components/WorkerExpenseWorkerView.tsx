import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Save, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../app/providers/AuthProvider';
import {
  useMyWorkerExpenseReport,
  useSaveWorkerExpenseEntries,
  useSubmitWorkerExpenseReport,
  useWorkerExpenseBudget,
} from '../hooks/useWorkerExpenses';
import {
  confirmDiscardExpenseChanges,
  useUnsavedExpenseChanges,
} from '../hooks/useUnsavedExpenseChanges';
import { workerExpenseService } from '../services/workerExpenseService';
import {
  addDaysToDate,
  addMonthsToDate,
  getTodayDateString,
  toLocalDateString,
} from '../../../shared/utils/date.util';
import type { WorkerExpenseCategory, WorkerExpenseEntry } from '../../../shared/types';

const CATEGORIES: { value: WorkerExpenseCategory; label: string }[] = [
  { value: 'ALOJAMIENTO', label: 'Alojamiento' },
  { value: 'TRANSPORTE', label: 'Transporte' },
  { value: 'COMBUSTIBLE', label: 'Combustible' },
  { value: 'ALIMENTACION', label: 'Alimentación' },
  { value: 'OTROS', label: 'Otros' },
];
const STATUS_LABELS = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Enviado · en revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
};
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
const fieldClass =
  'w-full min-w-0 px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600';
const cents = (amount: number) => Math.round((Number(amount) || 0) * 100);

export function WorkerExpenseWorkerView() {
  const { user } = useAuth();
  const today = getTodayDateString();
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const query = useMyWorkerExpenseReport(month, year);
  const report = query.data;
  const { data: budget } = useWorkerExpenseBudget(user?.id);
  const saveEntries = useSaveWorkerExpenseEntries();
  const submitReport = useSubmitWorkerExpenseReport();
  const [entries, setEntries] = useState<WorkerExpenseEntry[]>([]);
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionInProgress = useRef(false);
  useUnsavedExpenseChanges(dirty);

  useEffect(() => {
    if (dirty) return;
    setEntries((report?.entries || []).map((e) => ({ ...e, date: toLocalDateString(e.date) })));
    setVersion(report?.version ?? 0);
  }, [report, dirty, month, year]);

  const isEditable = !report || report.status === 'DRAFT' || report.status === 'REJECTED';
  const changedElsewhere = dirty && !!report && (report.version ?? 0) !== version;
  const disabled = !isEditable || busy;
  const period = `${year}-${String(month).padStart(2, '0')}`;
  const firstDay = `${period}-01`;
  const lastDay = addDaysToDate(addMonthsToDate(firstDay, 1), -1);
  const totals = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((c) => [
          c.value,
          entries
            .filter((e) => e.category === c.value)
            .reduce((sum, e) => sum + cents(e.amount), 0),
        ]),
      ),
    [entries],
  );
  const totalSpent = Object.values(totals).reduce((sum, amount) => sum + amount, 0) / 100;
  const deposited = report?.depositedAmount ?? 0;
  const balance = (cents(deposited) - cents(totalSpent)) / 100;
  const hasConfirmedAdvance = !!report?.advanceConfirmedAt;

  function shiftMonth(delta: number) {
    if (busy || !confirmDiscardExpenseChanges(dirty)) return;
    const next = addMonthsToDate(firstDay, delta);
    const nextYear = Number(next.slice(0, 4));
    if (nextYear < 2000 || nextYear > 2100) return;
    setDirty(false);
    setEntries([]);
    setMonth(Number(next.slice(5, 7)));
    setYear(nextYear);
  }

  function edit(next: WorkerExpenseEntry[]) {
    setEntries(next);
    setDirty(true);
  }
  function updateEntry(index: number, patch: Partial<WorkerExpenseEntry>) {
    edit(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  async function persist(send: boolean) {
    if (actionInProgress.current || !isEditable || changedElsewhere) return;
    if (send && !entries.length) return;
    const invalid = entries.findIndex(
      (e) =>
        !e.date.startsWith(`${period}-`) ||
        !Number.isFinite(e.amount) ||
        e.amount <= 0 ||
        Math.abs(e.amount * 100 - cents(e.amount)) > 0.000001,
    );
    if (invalid >= 0) {
      toast.error(
        `Revisa el gasto ${invalid + 1}: fecha del mes y monto mayor que cero, con hasta dos decimales.`,
      );
      return;
    }
    actionInProgress.current = true;
    setBusy(true);
    try {
      let target = report;
      if (!target) {
        try {
          target = await workerExpenseService.createMyReport(month, year);
        } catch {
          toast.error('No se pudo iniciar el reporte. Tus cambios siguen en pantalla.');
          return;
        }
        if ((target.version ?? 0) !== 0 || target.entries.length > 0) {
          toast.error('Ya existe un reporte guardado para este mes. Recárgalo antes de continuar.');
          await query.refetch();
          return;
        }
      }
      const payload = { id: target.id, version, entries };
      // Submit saves these exact entries and changes state in one server operation.
      const saved = await (send
        ? submitReport.mutateAsync(payload)
        : saveEntries.mutateAsync(payload));
      setEntries(
        saved.entries.map((e: WorkerExpenseEntry) => ({ ...e, date: toLocalDateString(e.date) })),
      );
      setVersion(saved.version);
      setDirty(false);
    } catch {
      // Mutation hooks show the server's error; retain local edits for retry/reconciliation.
      await query.refetch();
    } finally {
      setBusy(false);
      actionInProgress.current = false;
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            aria-label="Mes anterior"
            disabled={busy}
            onClick={() => shiftMonth(-1)}
            className="p-2 border rounded-lg"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            aria-label="Mes siguiente"
            disabled={busy}
            onClick={() => shiftMonth(1)}
            className="p-2 border rounded-lg"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full bg-gray-100">
          {STATUS_LABELS[report?.status || 'DRAFT']}
        </span>
      </div>
      {query.isLoading ? (
        <p className="py-8 text-center text-gray-500">Cargando reporte…</p>
      ) : query.isError ? (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 text-rose-700">
          No se pudo cargar el reporte.{' '}
          <button className="underline" onClick={() => query.refetch()}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {report?.status === 'REJECTED' && report.reviewNotes && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
              <strong>Motivo del rechazo:</strong> {report.reviewNotes}
            </div>
          )}
          {changedElsewhere && (
            <div
              role="alert"
              className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm"
            >
              Este reporte cambió en otra sesión. Tus cambios siguen aquí.{' '}
              <button
                className="underline font-medium"
                onClick={() => {
                  if (confirmDiscardExpenseChanges(dirty)) setDirty(false);
                }}
              >
                Recargar versión guardada
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-white border rounded-xl p-4">
              <p className="text-gray-500">
                Adelanto {hasConfirmedAdvance ? 'confirmado' : 'registrado'}
              </p>
              <p className="text-xl font-bold mt-1">S/ {Number(deposited).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {hasConfirmedAdvance
                  ? 'Confirmado por administración.'
                  : report?.depositedAmount != null
                    ? 'Pendiente de confirmación por administración.'
                    : 'Administración aún no registra un adelanto.'}
              </p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-gray-500">Total declarado</p>
              <p className="text-xl font-bold mt-1">S/ {totalSpent.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {report?.status === 'APPROVED' ? 'Gastos aprobados.' : 'Sujeto a revisión.'}
              </p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-gray-500">Diferencia referencial</p>
              <p className="text-xl font-bold mt-1">
                {hasConfirmedAdvance ? `S/ ${balance.toFixed(2)}` : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {hasConfirmedAdvance
                  ? 'Adelanto menos gastos declarados; no confirma una devolución o reembolso.'
                  : 'Disponible cuando administración confirme el adelanto.'}
              </p>
            </div>
          </div>
          <details className="bg-white border rounded-xl p-4">
            <summary className="text-sm font-medium cursor-pointer">
              Ver topes mensuales por categoría
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
              {CATEGORIES.map((c) => {
                const cap = Number(budget?.[c.value.toLowerCase() as 'otros'] ?? 0),
                  spent = totals[c.value] / 100;
                return (
                  <div
                    key={c.value}
                    className={`p-3 rounded-lg border text-sm ${cap > 0 && spent > cap ? 'border-rose-300 text-rose-700' : 'border-gray-100'}`}
                  >
                    <p>{c.label}</p>
                    <p className="font-semibold">S/ {spent.toFixed(2)}</p>
                    <p className="text-xs">
                      {cap > 0 ? `Tope vigente: S/ ${cap.toFixed(2)}` : 'Sin tope configurado'}
                    </p>
                    {cap > 0 && spent > cap && (
                      <p className="text-xs mt-1">Supera el tope; requiere revisión.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Detalle de gastos</h2>
            {isEditable && (
              <button
                disabled={busy}
                onClick={() =>
                  edit([
                    ...entries,
                    {
                      date: today.startsWith(period) ? today : firstDay,
                      description: '',
                      invoiceNumber: '',
                      category: 'OTROS',
                      amount: 0,
                    },
                  ])
                }
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-700 bg-primary-50 border border-primary-200 rounded-lg"
              >
                <Plus size={14} /> Agregar gasto
              </button>
            )}
          </div>
          {!entries.length && (
            <p className="bg-white rounded-xl border p-8 text-center text-sm text-gray-500">
              Sin gastos registrados. Usa “Agregar gasto” para comenzar.
            </p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {entries.map((entry, index) => (
              <fieldset
                key={index}
                disabled={disabled}
                className="bg-white border rounded-xl p-4 min-w-0 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Gasto {index + 1}</span>
                  {isEditable && (
                    <button
                      aria-label={`Eliminar gasto ${index + 1}`}
                      onClick={() => edit(entries.filter((_, i) => i !== index))}
                      className="p-2 text-gray-500 hover:text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-gray-600 min-w-0">
                    Fecha
                    <input
                      aria-label={`Fecha del gasto ${index + 1}`}
                      type="date"
                      min={firstDay}
                      max={lastDay}
                      value={entry.date}
                      onChange={(e) => updateEntry(index, { date: e.target.value })}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs text-gray-600 min-w-0">
                    Monto (S/)
                    <input
                      aria-label={`Monto del gasto ${index + 1}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={entry.amount || ''}
                      onChange={(e) => updateEntry(index, { amount: Number(e.target.value) })}
                      className={fieldClass}
                    />
                  </label>
                </div>
                <label className="block text-xs text-gray-600">
                  Categoría
                  <select
                    aria-label={`Categoría del gasto ${index + 1}`}
                    value={entry.category}
                    onChange={(e) =>
                      updateEntry(index, { category: e.target.value as WorkerExpenseCategory })
                    }
                    className={fieldClass}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-gray-600">
                  Descripción
                  <input
                    maxLength={500}
                    value={entry.description || ''}
                    placeholder="Detalle del gasto"
                    onChange={(e) => updateEntry(index, { description: e.target.value })}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  N.º de comprobante (si corresponde)
                  <input
                    maxLength={100}
                    value={entry.invoiceNumber || ''}
                    onChange={(e) => updateEntry(index, { invoiceNumber: e.target.value })}
                    className={fieldClass}
                  />
                </label>
              </fieldset>
            ))}
          </div>
          {isEditable && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500" aria-live="polite">
                {busy
                  ? 'Guardando…'
                  : dirty
                    ? 'Tienes cambios sin guardar.'
                    : 'Sin cambios pendientes.'}{' '}
                Al enviar se guardarán todos los gastos mostrados y el mes quedará en revisión.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={() => persist(false)}
                  disabled={
                    busy || changedElsewhere || (!dirty && !report) || (!entries.length && !report)
                  }
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-white border rounded-xl disabled:opacity-50"
                >
                  <Save size={16} /> Guardar borrador
                </button>
                <button
                  onClick={() => persist(true)}
                  disabled={busy || changedElsewhere || !entries.length}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white bg-primary-600 rounded-xl disabled:opacity-50"
                >
                  <Send size={16} /> Enviar para revisión
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

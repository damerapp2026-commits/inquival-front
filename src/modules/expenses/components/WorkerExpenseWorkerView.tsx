import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, Send, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider';
import {
  useMyWorkerExpenseReport,
  useSaveWorkerExpenseEntries,
  useSubmitWorkerExpenseReport,
  useWorkerExpenseBudget,
} from '../hooks/useWorkerExpenses';
import type { WorkerExpenseCategory, WorkerExpenseEntry } from '../../../shared/types';

const CATEGORIES: { value: WorkerExpenseCategory; label: string }[] = [
  { value: 'ALOJAMIENTO', label: 'Alojamiento' },
  { value: 'TRANSPORTE', label: 'Transporte' },
  { value: 'COMBUSTIBLE', label: 'Combustible' },
  { value: 'ALIMENTACION', label: 'Alimentación' },
  { value: 'OTROS', label: 'Otros' },
];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Borrador', className: 'bg-gray-100 text-gray-600' },
  SUBMITTED: { label: 'Enviado · en revisión', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Aprobado', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rechazado', className: 'bg-rose-100 text-rose-700' },
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function emptyEntry(): WorkerExpenseEntry {
  return { date: todayIso(), description: '', invoiceNumber: '', category: 'OTROS', amount: 0 };
}

export function WorkerExpenseWorkerView() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: report, isLoading } = useMyWorkerExpenseReport(month, year);
  const { data: budget } = useWorkerExpenseBudget(user?.id);
  const saveEntries = useSaveWorkerExpenseEntries();
  const submitReport = useSubmitWorkerExpenseReport();

  const [entries, setEntries] = useState<WorkerExpenseEntry[]>([]);
  const [depositedAmount, setDepositedAmount] = useState<number | ''>('');

  useEffect(() => {
    if (report) {
      setEntries(report.entries?.length ? report.entries.map((e: WorkerExpenseEntry) => ({ ...e, date: e.date.slice(0, 10) })) : []);
      setDepositedAmount(report.depositedAmount ?? '');
    }
  }, [report?.id, report?.status]);

  const isEditable = !report || report.status === 'DRAFT' || report.status === 'REJECTED';

  const totalsByCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const c of CATEGORIES) totals[c.value] = 0;
    for (const e of entries) totals[e.category] = (totals[e.category] || 0) + (Number(e.amount) || 0);
    return totals;
  }, [entries]);

  const totalSpent = useMemo(() => Object.values(totalsByCategory).reduce((s, v) => s + v, 0), [totalsByCategory]);
  const balance = (typeof depositedAmount === 'number' ? depositedAmount : 0) - totalSpent;

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  }

  function updateEntry(index: number, patch: Partial<WorkerExpenseEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!report) return;
    saveEntries.mutate({
      id: report.id,
      depositedAmount: typeof depositedAmount === 'number' ? depositedAmount : undefined,
      entries,
    });
  }

  function handleSubmit() {
    if (!report) return;
    if (entries.length === 0) return;
    submitReport.mutate(report.id);
  }

  const statusBadge = report ? STATUS_BADGES[report.status] : STATUS_BADGES.DRAFT;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft size={16} />
          </button>
          <div className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </div>
          <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRight size={16} />
          </button>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${statusBadge.className}`}>
          {statusBadge.label}
        </span>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {report?.status === 'REJECTED' && report.reviewNotes && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
              <strong>Motivo del rechazo:</strong> {report.reviewNotes}
            </div>
          )}

          {/* Resumen de topes vs gasto */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Wallet size={16} className="text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700">Topes de viáticos vs. gasto del mes</h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {CATEGORIES.map((c) => {
                const cap = (budget as any)?.[c.value.toLowerCase()] ?? 0;
                const spent = totalsByCategory[c.value] || 0;
                const over = cap > 0 && spent > cap;
                const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
                return (
                  <div key={c.value} className="border border-gray-100 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                    <div className={`text-lg font-bold ${over ? 'text-rose-600' : 'text-gray-800'}`}>S/ {spent.toFixed(2)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">tope: S/ {cap.toFixed(2)}</div>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${over ? 'bg-rose-500' : 'bg-primary-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monto depositado y balance */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Monto adelantado/depositado (S/):</label>
              <input
                type="number"
                min={0}
                step="0.01"
                disabled={!isEditable}
                value={depositedAmount}
                onChange={(e) => setDepositedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-32 px-3 py-1.5 border rounded-lg disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="flex items-center gap-6 sm:ml-auto text-sm">
              <div>
                <span className="text-gray-500">Total gastado: </span>
                <span className="font-semibold text-gray-800">S/ {totalSpent.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Saldo: </span>
                <span className={`font-semibold ${balance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>S/ {balance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Tabla de gastos */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Detalle de gastos</h2>
              {isEditable && (
                <button
                  onClick={() => setEntries((prev) => [...prev, emptyEntry()])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100"
                >
                  <Plus size={14} /> Agregar gasto
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Categoría</th>
                    <th className="px-4 py-2 font-medium">Descripción</th>
                    <th className="px-4 py-2 font-medium">N° comprobante</th>
                    <th className="px-4 py-2 font-medium text-right">Monto (S/)</th>
                    {isEditable && <th className="px-4 py-2 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={isEditable ? 6 : 5} className="px-4 py-10 text-center text-gray-400">
                        Sin gastos registrados {isEditable && 'todavía. Usa "Agregar gasto" para comenzar.'}
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            disabled={!isEditable}
                            value={entry.date}
                            onChange={(e) => updateEntry(idx, { date: e.target.value })}
                            className="px-2 py-1 border rounded-lg w-36 disabled:bg-transparent disabled:border-transparent"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            disabled={!isEditable}
                            value={entry.category}
                            onChange={(e) => updateEntry(idx, { category: e.target.value as WorkerExpenseCategory })}
                            className="px-2 py-1 border rounded-lg disabled:bg-transparent disabled:border-transparent"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            disabled={!isEditable}
                            value={entry.description || ''}
                            onChange={(e) => updateEntry(idx, { description: e.target.value })}
                            placeholder="Detalle del gasto"
                            className="px-2 py-1 border rounded-lg w-full min-w-[140px] disabled:bg-transparent disabled:border-transparent"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            disabled={!isEditable}
                            value={entry.invoiceNumber || ''}
                            onChange={(e) => updateEntry(idx, { invoiceNumber: e.target.value })}
                            className="px-2 py-1 border rounded-lg w-32 disabled:bg-transparent disabled:border-transparent"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            disabled={!isEditable}
                            value={entry.amount}
                            onChange={(e) => updateEntry(idx, { amount: Number(e.target.value) })}
                            className="px-2 py-1 border rounded-lg w-28 text-right disabled:bg-transparent disabled:border-transparent"
                          />
                        </td>
                        {isEditable && (
                          <td className="px-4 py-2 text-center">
                            <button onClick={() => removeEntry(idx)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {isEditable && (
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={handleSave}
                disabled={saveEntries.isPending || !report}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50"
              >
                <Save size={16} /> Guardar borrador
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitReport.isPending || !report || entries.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-50"
              >
                <Send size={16} /> Enviar para revisión
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

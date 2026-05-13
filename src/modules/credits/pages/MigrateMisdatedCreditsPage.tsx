import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMigrateMisdatedCredits } from '../hooks/useCredits';
import type { MigrateMisdatedCreditsResult, MisdatedCreditRow } from '../services/creditService';
import { Modal } from '../../../shared/components/Modal';
import {
  Wrench, AlertTriangle, CalendarRange, ChevronLeft, PlayCircle, Search,
  CheckCircle2, TriangleAlert, ArrowRight, CreditCard, Inbox,
} from 'lucide-react';

function formatDate(d: string) {
  if (!d) return '—';
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

export function MigrateMisdatedCreditsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<MigrateMisdatedCreditsResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const migrate = useMigrateMisdatedCredits();

  const handleScan = async () => {
    setReport(null);
    const res = await migrate.mutateAsync({ dryRun: true, from: from || undefined, to: to || undefined });
    setReport(res);
  };

  const handleApply = async () => {
    const res = await migrate.mutateAsync({ dryRun: false, from: from || undefined, to: to || undefined });
    setReport(res);
    setConfirmOpen(false);
  };

  const groupedByPair = useMemo(() => {
    if (!report) return [] as { key: string; from: string; to: string; rows: MisdatedCreditRow[] }[];
    const map = new Map<string, MisdatedCreditRow[]>();
    for (const row of report.misdated) {
      const key = `${row.currentDate}->${row.targetDate}`;
      const arr = map.get(key) || [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([key, rows]) => ({ key, from: rows[0].currentDate, to: rows[0].targetDate, rows }))
      .sort((a, b) => a.from.localeCompare(b.from));
  }, [report]);

  const totalAmount = useMemo(() => report?.misdated.reduce((s, r) => s + r.totalAmount, 0) || 0, [report]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
          <Wrench size={24} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Migración de créditos con fecha incorrecta</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Alinea la fecha de creación de los créditos a la fecha real de la venta que los originó.
          </p>
        </div>
        <Link to="/credits" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-700">
          <ChevronLeft size={15} /> Volver a créditos
        </Link>
      </div>

      {/* Warning */}
      <div className="flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
        <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-amber-900 space-y-1">
          <p>
            <strong>Cómo funciona:</strong> primero ejecuta <em>Analizar</em> (no toca nada) para ver qué créditos tienen
            su fecha de creación distinta a la fecha de la venta que los originó. Luego <em>Aplicar migración</em>.
          </p>
          <p>
            Solo se tocan créditos que vienen de una venta. Las <strong>deudas históricas</strong> registradas con el modal
            (sin venta) no se modifican — su fecha la decidió el usuario y debe respetarse.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider font-semibold text-gray-500">
          <CalendarRange size={13} /> Filtro por fecha actual del crédito
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleScan}
              disabled={migrate.isPending}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              <Search size={15} />
              {migrate.isPending && report === null ? 'Analizando...' : 'Analizar (sin cambios)'}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Filtra por la fecha actual (incorrecta) del crédito para acotar la migración. Vacío analiza todo.
        </p>
      </div>

      {/* Result */}
      {report && (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${report.misdated.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {report.misdated.length === 0 ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  {report.dryRun ? 'Resultado del análisis' : 'Migración aplicada'}
                </h2>
                <p className="text-xs text-gray-500">
                  Escaneados <strong>{report.scanned}</strong> créditos · Mal-fechados:{' '}
                  <strong>{report.misdated.length}</strong>
                  {report.dryRun ? '' : <> · Migrados: <strong>{report.migrated}</strong></>}
                </p>
              </div>
            </div>
            {report.dryRun && report.misdated.length > 0 && (
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={migrate.isPending}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                <PlayCircle size={15} /> Aplicar migración
              </button>
            )}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
            <Kpi label="Escaneados" value={`${report.scanned}`} />
            <Kpi label="Mal-fechados" value={`${report.misdated.length}`} accent={report.misdated.length > 0 ? 'text-amber-700' : 'text-gray-600'} />
            <Kpi label="Monto total" value={`S/ ${totalAmount.toFixed(2)}`} />
            <Kpi label={report.dryRun ? 'Migrados (pendiente)' : 'Migrados'} value={`${report.migrated}`} accent="text-primary-700" />
          </div>

          {/* Empty */}
          {report.misdated.length === 0 && (
            <div className="px-6 py-16 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-base font-semibold text-gray-800">Todo en orden</p>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                No hay créditos con fecha distinta a la de su venta originaria en el rango seleccionado.
              </p>
            </div>
          )}

          {/* Grouped table */}
          {report.misdated.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60">
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left">Fecha actual → Fecha correcta</th>
                    <th className="px-4 py-2.5 text-left">Cliente</th>
                    <th className="px-4 py-2.5 text-left">Venta</th>
                    <th className="px-4 py-2.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedByPair.map((group) => (
                    <React.Fragment key={group.key}>
                      <tr className="bg-amber-50/40">
                        <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-amber-900">
                          <span className="inline-flex items-center gap-1.5">
                            <CreditCard size={12} /> {formatDate(group.from)}
                            <ArrowRight size={11} className="text-amber-500" />
                            <CreditCard size={12} /> {formatDate(group.to)}
                            <span className="ml-2 text-amber-600 font-normal">({group.rows.length} crédito{group.rows.length === 1 ? '' : 's'})</span>
                          </span>
                        </td>
                      </tr>
                      {group.rows.map((r) => (
                        <tr key={r.creditId} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 text-xs text-gray-400">↳</td>
                          <td className="px-4 py-2.5 text-xs text-gray-700">{r.clientName || <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-2.5">
                            <div className="text-xs font-mono text-gray-700">{r.saleNumber || r.saleId.slice(-8)}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums text-gray-800">S/ {r.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Errors */}
          {report.errors.length > 0 && (
            <div className="border-t border-gray-100 px-5 sm:px-6 py-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-rose-700 mb-2">
                <Inbox size={13} /> Errores ({report.errors.length})
              </div>
              <ul className="space-y-1 text-xs text-rose-700">
                {report.errors.map((e, i) => (
                  <li key={i} className="font-mono">
                    <span className="text-gray-400">{e.creditId.slice(-8)}</span> — {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Confirm modal */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmar migración de créditos">
        <div className="space-y-4">
          <div className="flex gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl">
            <AlertTriangle className="text-rose-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-rose-900">
              Esta acción reasigna la fecha de creación de <strong>{report?.misdated.length}</strong> crédito(s).
              Las cuentas históricas registradas manualmente no se tocan.
            </div>
          </div>
          <p className="text-sm text-gray-600">
            La operación es idempotente. ¿Confirmas?
          </p>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              disabled={migrate.isPending}
              className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 font-semibold shadow-sm"
            >
              {migrate.isPending ? 'Migrando...' : 'Sí, aplicar migración'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white p-4">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${accent || 'text-gray-800'}`}>{value}</div>
    </div>
  );
}

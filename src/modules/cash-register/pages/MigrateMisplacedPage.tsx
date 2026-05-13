import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMigrateMisplacedSales, useMigrateMisplacedPurchases } from '../hooks/useCashRegister';
import type {
  MigrateMisplacedSalesResult,
  MisplacedSaleRow,
  MigrateMisplacedPurchasesResult,
  MisplacedPurchaseRow,
} from '../services/cashRegisterService';
import { Modal } from '../../../shared/components/Modal';
import {
  Wrench, AlertTriangle, CalendarRange, History, Wallet, ArrowRight, ChevronLeft,
  PlayCircle, Search, CheckCircle2, Inbox, TriangleAlert, ShoppingCart, Receipt,
} from 'lucide-react';

type Tab = 'sales' | 'purchases';

function formatDate(d: string) {
  if (!d) return '—';
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

export function MigrateMisplacedPage() {
  const [tab, setTab] = useState<Tab>('sales');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
          <Wrench size={24} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Migración de movimientos mal-asignados</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Reasigna ventas y compras cuya fecha no coincide con la caja donde quedaron registradas.
          </p>
        </div>
        <Link to="/cash-register/history" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-700">
          <ChevronLeft size={15} /> Volver al historial
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <TabBtn active={tab === 'sales'} onClick={() => setTab('sales')} icon={<Receipt size={15} />}>
          Ventas
        </TabBtn>
        <TabBtn active={tab === 'purchases'} onClick={() => setTab('purchases')} icon={<ShoppingCart size={15} />}>
          Compras
        </TabBtn>
      </div>

      {tab === 'sales' ? <SalesTab /> : <PurchasesTab />}
    </div>
  );
}

function TabBtn({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 text-sm font-medium transition-colors ${
        active
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon} {children}
    </button>
  );
}

// ============================================================================
// Tab Ventas
// ============================================================================

function SalesTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<MigrateMisplacedSalesResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const migrate = useMigrateMisplacedSales();

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
    if (!report) return [] as { key: string; from: string; to: string; rows: MisplacedSaleRow[] }[];
    const map = new Map<string, MisplacedSaleRow[]>();
    for (const row of report.misplaced) {
      const key = `${row.currentRegisterDate}->${row.targetRegisterDate}`;
      const arr = map.get(key) || [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([key, rows]) => ({ key, from: rows[0].currentRegisterDate, to: rows[0].targetRegisterDate, rows }))
      .sort((a, b) => a.from.localeCompare(b.from));
  }, [report]);

  const totalAmount = useMemo(() => report?.misplaced.reduce((s, r) => s + r.amount, 0) || 0, [report]);

  return (
    <>
      <Intro entityLabel="ventas" />
      <Filters from={from} to={to} setFrom={setFrom} setTo={setTo} onScan={handleScan} isPending={migrate.isPending && report === null} />

      {report && (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <Header
            report={report}
            entitySingular="venta"
            entityPlural="ventas"
            onApplyClick={() => setConfirmOpen(true)}
            isPending={migrate.isPending}
          />
          <Kpis report={report} totalAmount={totalAmount} />

          {report.misplaced.length === 0 && (
            <EmptyState entityLabel="ventas" />
          )}

          {report.misplaced.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60">
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left">Caja actual → Caja correcta</th>
                    <th className="px-4 py-2.5 text-left">Venta</th>
                    <th className="px-4 py-2.5 text-left">Cliente</th>
                    <th className="px-4 py-2.5 text-left">Método</th>
                    <th className="px-4 py-2.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedByPair.map((group) => (
                    <React.Fragment key={group.key}>
                      <GroupHeader from={group.from} to={group.to} count={group.rows.length} entitySingular="venta" entityPlural="ventas" colSpan={5} />
                      {group.rows.map((r) => (
                        <tr key={r.entryId} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 text-xs text-gray-400">↳</td>
                          <td className="px-4 py-2.5">
                            <div className="text-xs font-mono text-gray-700">{r.saleNumber || r.saleId.slice(-8)}</div>
                            <div className="text-[10px] text-gray-400">Emitida: {formatDate(r.saleDate)}</div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-700">{r.clientName || <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-2.5 text-xs">
                            {r.paymentMethodLabel ? (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">{r.paymentMethodLabel}</span>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums text-gray-800">+ S/ {r.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Errors errors={report.errors.map((e) => ({ id: e.saleId, reason: e.reason }))} />
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleApply}
        count={report?.misplaced.length || 0}
        totalAmount={totalAmount}
        isPending={migrate.isPending}
        entitySingular="venta"
        entityPlural="ventas"
      />
    </>
  );
}

// ============================================================================
// Tab Compras
// ============================================================================

function PurchasesTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<MigrateMisplacedPurchasesResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const migrate = useMigrateMisplacedPurchases();

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
    if (!report) return [] as { key: string; from: string; to: string; rows: MisplacedPurchaseRow[] }[];
    const map = new Map<string, MisplacedPurchaseRow[]>();
    for (const row of report.misplaced) {
      const key = `${row.currentRegisterDate}->${row.targetRegisterDate}`;
      const arr = map.get(key) || [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([key, rows]) => ({ key, from: rows[0].currentRegisterDate, to: rows[0].targetRegisterDate, rows }))
      .sort((a, b) => a.from.localeCompare(b.from));
  }, [report]);

  const totalAmount = useMemo(() => report?.misplaced.reduce((s, r) => s + r.amount, 0) || 0, [report]);

  return (
    <>
      <Intro entityLabel="compras" />
      <Filters from={from} to={to} setFrom={setFrom} setTo={setTo} onScan={handleScan} isPending={migrate.isPending && report === null} />

      {report && (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <Header
            report={report}
            entitySingular="compra"
            entityPlural="compras"
            onApplyClick={() => setConfirmOpen(true)}
            isPending={migrate.isPending}
          />
          <Kpis report={report} totalAmount={totalAmount} />

          {report.misplaced.length === 0 && (
            <EmptyState entityLabel="compras" />
          )}

          {report.misplaced.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60">
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left">Caja actual → Caja correcta</th>
                    <th className="px-4 py-2.5 text-left">Compra</th>
                    <th className="px-4 py-2.5 text-left">Proveedor</th>
                    <th className="px-4 py-2.5 text-left">Documento</th>
                    <th className="px-4 py-2.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedByPair.map((group) => (
                    <React.Fragment key={group.key}>
                      <GroupHeader from={group.from} to={group.to} count={group.rows.length} entitySingular="compra" entityPlural="compras" colSpan={5} />
                      {group.rows.map((r) => (
                        <tr key={r.entryId} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 text-xs text-gray-400">↳</td>
                          <td className="px-4 py-2.5">
                            <div className="text-xs font-mono text-gray-700">{r.purchaseId.slice(-8)}</div>
                            <div className="text-[10px] text-gray-400">Emitida: {formatDate(r.purchaseDate)}</div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-700">{r.supplier || <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-2.5 text-xs">
                            {r.documentLabel ? (
                              <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[10px] font-medium font-mono">{r.documentLabel}</span>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums text-rose-600">− S/ {r.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Errors errors={report.errors.map((e) => ({ id: e.purchaseId, reason: e.reason }))} />
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleApply}
        count={report?.misplaced.length || 0}
        totalAmount={totalAmount}
        isPending={migrate.isPending}
        entitySingular="compra"
        entityPlural="compras"
      />
    </>
  );
}

// ============================================================================
// Sub-componentes compartidos
// ============================================================================

function Intro({ entityLabel }: { entityLabel: string }) {
  return (
    <div className="flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
      <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
      <div className="text-sm text-amber-900 space-y-1">
        <p>
          <strong>Cómo funciona:</strong> primero ejecuta <em>Analizar</em> (no toca nada) para ver qué {entityLabel} están
          en la caja incorrecta. Luego, si el resultado es correcto, ejecuta <em>Aplicar migración</em>.
        </p>
        <p>
          Las {entityLabel} se mueven a la caja de su fecha. Si esa caja no existe, se crea como <strong>cerrada</strong>.
          El proceso es <strong>idempotente</strong>: se puede re-correr sin duplicar.
        </p>
      </div>
    </div>
  );
}

function Filters({
  from, to, setFrom, setTo, onScan, isPending,
}: {
  from: string; to: string;
  setFrom: (v: string) => void; setTo: (v: string) => void;
  onScan: () => void; isPending: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider font-semibold text-gray-500">
        <CalendarRange size={13} /> Filtro por fecha de caja origen
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
            onClick={onScan}
            disabled={isPending}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
          >
            <Search size={15} />
            {isPending ? 'Analizando...' : 'Analizar (sin cambios)'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Si dejas las fechas vacías, se analiza el historial completo. Puede tardar más con muchos datos.
      </p>
    </div>
  );
}

interface ReportLike {
  dryRun: boolean;
  scanned: number;
  misplaced: unknown[];
  migrated: number;
}

function Header({
  report, entitySingular, entityPlural, onApplyClick, isPending,
}: {
  report: ReportLike;
  entitySingular: string;
  entityPlural: string;
  onApplyClick: () => void;
  isPending: boolean;
}) {
  return (
    <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${report.misplaced.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {report.misplaced.length === 0 ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            {report.dryRun ? 'Resultado del análisis' : 'Migración aplicada'}
          </h2>
          <p className="text-xs text-gray-500">
            Escaneadas <strong>{report.scanned}</strong> entradas de {entitySingular} · Mal-asignadas:{' '}
            <strong>{report.misplaced.length}</strong>
            {report.dryRun ? '' : <> · Migradas: <strong>{report.migrated}</strong></>}
          </p>
        </div>
      </div>
      {report.dryRun && report.misplaced.length > 0 && (
        <button
          onClick={onApplyClick}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
        >
          <PlayCircle size={15} /> Aplicar migración ({entityPlural})
        </button>
      )}
    </div>
  );
}

function Kpis({ report, totalAmount }: { report: ReportLike; totalAmount: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
      <Kpi label="Escaneadas" value={`${report.scanned}`} />
      <Kpi label="Mal-asignadas" value={`${report.misplaced.length}`} accent={report.misplaced.length > 0 ? 'text-amber-700' : 'text-gray-600'} />
      <Kpi label="Monto total" value={`S/ ${totalAmount.toFixed(2)}`} />
      <Kpi label={report.dryRun ? 'Migradas (pendiente)' : 'Migradas'} value={`${report.migrated}`} accent="text-primary-700" />
    </div>
  );
}

function EmptyState({ entityLabel }: { entityLabel: string }) {
  return (
    <div className="px-6 py-16 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
        <CheckCircle2 size={24} />
      </div>
      <p className="text-base font-semibold text-gray-800">Todo en orden</p>
      <p className="text-sm text-gray-500 mt-1 max-w-md">
        No hay {entityLabel} con fecha que difiera de la caja donde fueron registradas en el rango seleccionado.
      </p>
    </div>
  );
}

function GroupHeader({
  from, to, count, entitySingular, entityPlural, colSpan,
}: { from: string; to: string; count: number; entitySingular: string; entityPlural: string; colSpan: number }) {
  return (
    <tr className="bg-amber-50/40">
      <td colSpan={colSpan} className="px-4 py-2 text-xs font-semibold text-amber-900">
        <span className="inline-flex items-center gap-1.5">
          <Wallet size={12} /> {formatDate(from)}
          <ArrowRight size={11} className="text-amber-500" />
          <History size={12} /> {formatDate(to)}
          <span className="ml-2 text-amber-600 font-normal">({count} {count === 1 ? entitySingular : entityPlural})</span>
        </span>
      </td>
    </tr>
  );
}

function Errors({ errors }: { errors: { id: string; reason: string }[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="border-t border-gray-100 px-5 sm:px-6 py-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-rose-700 mb-2">
        <Inbox size={13} /> Errores ({errors.length})
      </div>
      <ul className="space-y-1 text-xs text-rose-700">
        {errors.map((e, i) => (
          <li key={i} className="font-mono">
            <span className="text-gray-400">{e.id.slice(-8)}</span> — {e.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConfirmModal({
  open, onClose, onConfirm, count, totalAmount, isPending, entitySingular, entityPlural,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
  totalAmount: number;
  isPending: boolean;
  entitySingular: string;
  entityPlural: string;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} title={`Confirmar migración · ${entityPlural}`}>
      <div className="space-y-4">
        <div className="flex gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl">
          <AlertTriangle className="text-rose-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-rose-900">
            Esta acción modifica el historial de cajas. Se moverán <strong>{count}</strong> {count === 1 ? entitySingular : entityPlural}
            {' '}(S/ {totalAmount.toFixed(2)}) a sus cajas correctas. Las cajas afectadas con cuadre previo serán recalculadas.
          </div>
        </div>
        <p className="text-sm text-gray-600">
          La operación es idempotente y trazable. ¿Confirmas?
        </p>
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 font-semibold shadow-sm"
          >
            {isPending ? 'Migrando...' : 'Sí, aplicar migración'}
          </button>
        </div>
      </div>
    </Modal>
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

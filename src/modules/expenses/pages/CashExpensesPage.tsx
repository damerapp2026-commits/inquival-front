import { useMemo, useState } from 'react';
import {
  AlertCircle, Calendar, Clock, FileText, ReceiptText, Search, Filter,
} from 'lucide-react';
import { useCashRegisters } from '../../cash-register/hooks/useCashRegister';
import { useUsers } from '../../users/hooks/useUsers';
import type { CashRegister, CashRegisterEntry } from '../../../shared/types';
import { getMonthRange } from '../../../shared/utils/date.util';
import { EXPENSE_CATEGORIES, getExpenseCategoryDef } from '../../cash-register/utils/expenseCategories';

interface FlatExpense extends CashRegisterEntry {
  registerDate: string;
}

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
  try { return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return '—'; }
}

function formatPrettyDate(date?: string) {
  if (!date) return '';
  try {
    const d = new Date(date.includes('T') ? date : `${date}T00:00:00`);
    return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  } catch { return date; }
}

function methodFromDescription(desc: string) {
  const m = desc.match(/\[(.+?)\]$/);
  return m ? m[1] : null;
}

function stripMethod(desc: string) {
  return desc.replace(/\s*\[.*?\]\s*$/, '');
}

export function CashExpensesPage() {
  const monthRange = getMonthRange();
  const [startDate, setStartDate] = useState(monthRange.start);
  const [endDate, setEndDate] = useState(monthRange.end);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useCashRegisters({
    page: 1,
    limit: 100,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const { data: usersData } = useUsers({ limit: 200 });

  const userById = useMemo(() => {
    const list: any[] = Array.isArray(usersData) ? usersData : (usersData as any)?.data || [];
    const map: Record<string, string> = {};
    list.forEach((u) => { map[u.id] = u.fullName || u.username || ''; });
    return map;
  }, [usersData]);

  const registers: CashRegister[] = data?.data || [];

  const allExpenses: FlatExpense[] = useMemo(() => {
    const list: FlatExpense[] = [];
    registers.forEach((reg) => {
      reg.entries.forEach((e) => {
        if (e.type === 'EXPENSE' && !e.isDeleted) {
          list.push({ ...e, registerDate: reg.date });
        }
      });
    });
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [registers]);

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allExpenses.filter((e) => {
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      if (q) {
        const desc = stripMethod(e.description).toLowerCase();
        if (!desc.includes(q)) return false;
      }
      return true;
    });
  }, [allExpenses, categoryFilter, search]);

  const totals = useMemo(() => {
    const byCategory: Record<string, { amount: number; count: number }> = {};
    let grandTotal = 0;
    allExpenses.forEach((e) => {
      const k = e.category || 'OTHER';
      if (!byCategory[k]) byCategory[k] = { amount: 0, count: 0 };
      byCategory[k].amount += e.amount;
      byCategory[k].count += 1;
      grandTotal += e.amount;
    });
    return { byCategory, grandTotal, total: allExpenses.length };
  }, [allExpenses]);

  const filteredTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-card p-5 flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Buscar</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Descripción, proveedor..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>
        {(startDate !== monthRange.start || endDate !== monthRange.end || categoryFilter !== 'ALL' || search) && (
          <button
            onClick={() => { setStartDate(monthRange.start); setEndDate(monthRange.end); setCategoryFilter('ALL'); setSearch(''); }}
            className="text-sm text-rose-600 hover:underline font-medium whitespace-nowrap"
          >Limpiar filtros</button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Filtrar por categoría</h2>
          </div>
          <div className="text-xs text-gray-500">
            <strong className="text-rose-700 tabular-nums">S/ {totals.grandTotal.toFixed(2)}</strong> en {totals.total} egreso{totals.total === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
              categoryFilter === 'ALL' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
            }`}
          >
            Todas <span className="opacity-70">· {totals.total}</span>
          </button>
          {EXPENSE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const stat = totals.byCategory[cat.key];
            if (!stat || stat.count === 0) return null;
            const active = categoryFilter === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setCategoryFilter(cat.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                  active ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300'
                }`}
              >
                <Icon size={14} />
                {cat.label}
                <span className={`tabular-nums ${active ? 'opacity-90' : 'text-gray-500'}`}>· S/ {stat.amount.toFixed(2)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {Object.keys(totals.byCategory).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {EXPENSE_CATEGORIES.map((cat) => {
            const stat = totals.byCategory[cat.key];
            if (!stat || stat.count === 0) return null;
            const Icon = cat.icon;
            const pct = totals.grandTotal > 0 ? (stat.amount / totals.grandTotal) * 100 : 0;
            return (
              <div key={cat.key} className="bg-white rounded-xl shadow-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat.tile}`}><Icon size={15} /></div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{cat.label}</div>
                </div>
                <div className="text-xl font-bold tabular-nums text-gray-800">S/ {stat.amount.toFixed(2)}</div>
                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                  <span>{stat.count} mov.</span>
                  <span className="tabular-nums">{pct.toFixed(0)}%</span>
                </div>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-400" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">
            {categoryFilter === 'ALL' ? 'Todos los gastos de caja' : `Gastos · ${getExpenseCategoryDef(categoryFilter).label}`}
            <span className="text-xs text-gray-400 ml-2">· {filteredExpenses.length} mov.</span>
          </h2>
          <div className="text-sm font-bold text-rose-700 tabular-nums">− S/ {filteredTotal.toFixed(2)}</div>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <AlertCircle size={22} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">No hay gastos en este rango</p>
            <p className="text-xs text-gray-400 mt-1">Ajusta filtros o registra un egreso desde la pantalla de Caja.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/60">
                  <th className="px-4 sm:px-6 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-left">Descripción</th>
                  <th className="px-4 py-3 text-left">Registrado por</th>
                  <th className="px-4 py-3 text-center">Comprobante</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenses.map((e) => {
                  const def = getExpenseCategoryDef(e.category);
                  const Icon = def.icon;
                  const description = stripMethod(e.description);
                  const method = methodFromDescription(e.description);
                  const vendor = e.createdBy ? (userById[e.createdBy] || 'Usuario') : '';
                  return (
                    <tr key={e.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-100 to-rose-50 text-rose-700 flex items-center justify-center text-[10px] font-bold uppercase">
                            <Calendar size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-800 text-sm capitalize truncate">{formatPrettyDate(e.registerDate)}</div>
                            <div className="flex items-center gap-1 text-[11px] text-gray-400 tabular-nums">
                              <Clock size={10} /> {formatTime(e.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${def.badge}`}>
                          <Icon size={11} />
                          {def.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-800">
                        <div className="flex flex-col">
                          <span className="font-medium">{description}</span>
                          {method && <span className="text-[11px] text-blue-700 font-medium mt-0.5">[{method}]</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {vendor ? (
                          <div className="inline-flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${vendorColor(vendor)}`}>{initialsFor(vendor)}</span>
                            <span className="text-sm text-gray-700 font-medium truncate max-w-[140px]">{vendor}</span>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {e.voucherType === 'BOLETA' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <ReceiptText size={11} /> Boleta
                          </span>
                        ) : e.voucherType === 'FACTURA' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            <FileText size={11} /> Factura
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right font-bold tabular-nums text-rose-600">
                        − S/ {e.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={5} className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total filtrado</td>
                  <td className="px-4 sm:px-6 py-3 text-right font-bold tabular-nums text-rose-700">− S/ {filteredTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useDashboardSummary, useCreditsSummary, useSalesChart, useCategorySales, useTopSuppliers, useCategorySalesChart } from '../hooks/useDashboard';
import { useAPAlerts } from '../../accounts-payable/hooks/useAccountsPayable';
import { useAuth } from '../../../app/providers/AuthProvider';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, FileText, AlertTriangle, Clock, Tag, Truck, ShoppingCart, Package, BarChart3, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import type { AccountPayable } from '../../../shared/types';

const CHART_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
const SUPPLIER_COLORS = ['#15803d', '#0ea5e9', '#f43f5e', '#84cc16', '#fb923c'];

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function last30Days() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return { start: toInputDate(start), end: toInputDate(now) };
}

function thisMonth() {
  const now = new Date();
  return { start: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: toInputDate(now) };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatDateLong(d: Date) {
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function DateRangeFilter({ range, onChange, onReset, resetLabel }: {
  range: { start: string; end: string };
  onChange: (r: { start: string; end: string }) => void;
  onReset: () => void;
  resetLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-xs text-gray-500">Desde</label>
      <input
        type="date"
        value={range.start}
        max={range.end}
        onChange={(e) => onChange({ ...range, start: e.target.value })}
        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <label className="text-xs text-gray-500">Hasta</label>
      <input
        type="date"
        value={range.end}
        min={range.start}
        max={toInputDate(new Date())}
        onChange={(e) => onChange({ ...range, end: e.target.value })}
        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <button onClick={onReset} className="text-xs text-primary-600 hover:underline font-medium">{resetLabel}</button>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sublabel, accent }: {
  icon: any;
  label: string;
  value: string;
  sublabel?: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon size={14} />
        </div>
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      {sublabel && <div className="text-xs text-gray-400 mt-1">{sublabel}</div>}
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, accent }: {
  icon: any;
  label: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl shadow-card p-5 hover:shadow-card-hover transition-all text-left group"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${accent}`}>
        <Icon size={20} />
      </div>
      <div className="text-sm font-medium text-gray-700 group-hover:text-primary-700">{label}</div>
    </button>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState('daily');
  const [salesRange, setSalesRange] = useState(last30Days);
  const [catChartRange, setCatChartRange] = useState(thisMonth);
  const [chartRange, setChartRange] = useState(thisMonth);
  const [disabledCats, setDisabledCats] = useState<Set<string>>(new Set());

  const { data: summary } = useDashboardSummary(period);
  const { data: creditsSummary } = useCreditsSummary();
  const { data: salesChart } = useSalesChart(salesRange.start, salesRange.end);
  const { data: apAlerts } = useAPAlerts(3);
  const { data: categorySales } = useCategorySales(chartRange.start, chartRange.end);
  const { data: topSuppliers } = useTopSuppliers(chartRange.start, chartRange.end);
  const { data: catSalesChart } = useCategorySalesChart(catChartRange.start, catChartRange.end);

  const dailySales = salesChart?.dailySales || [];
  const categorySalesData: { name: string; total: number }[] = Array.isArray(categorySales) ? categorySales : [];
  const topSuppliersData: { name: string; total: number; count: number }[] = Array.isArray(topSuppliers) ? topSuppliers : [];
  const catChartData: Record<string, any>[] = catSalesChart?.dailyData || [];
  const allCategories: string[] = catSalesChart?.categories || [];

  const activeCategories = useMemo(
    () => allCategories.filter((c) => !disabledCats.has(c)),
    [allCategories, disabledCats],
  );

  const toggleCategory = (cat: string) => {
    setDisabledCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const periodLabels: Record<string, string> = { daily: 'Hoy', weekly: 'Esta Semana', monthly: 'Este Mes' };

  const salesTickInterval = dailySales.length > 60 ? 6 : dailySales.length > 30 ? 4 : 1;
  const catTickInterval = catChartData.length > 60 ? 6 : catChartData.length > 30 ? 4 : 1;

  const firstName = (user?.fullName || user?.username || '').split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {greeting()}, {firstName || 'Bienvenido'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{formatDateLong(new Date())}</p>
      </div>

      {/* Hero + period toggle */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 text-white p-7 shadow-card">
        <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/10 rounded-full" />
        <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-white/5 rounded-full" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs font-semibold tracking-wider text-primary-100 mb-2 uppercase">
                Ingresos · {periodLabels[period]}
              </div>
              <div className="text-5xl font-bold">S/ {(summary?.totalIncome || 0).toFixed(2)}</div>
              <div className="text-sm text-primary-100 mt-2">
                Ganancia neta: S/ {(summary?.netProfit || 0).toFixed(2)}
              </div>
            </div>
            <div className="flex gap-1 bg-white/15 backdrop-blur rounded-lg p-1">
              {['daily', 'weekly', 'monthly'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    period === p ? 'bg-white text-primary-700' : 'text-white/90 hover:bg-white/10'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-white/20 max-w-md">
            <div>
              <div className="text-xs text-primary-100">Egresos</div>
              <div className="text-xl font-semibold">S/ {(summary?.totalExpense || 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-primary-100">Créditos pendientes</div>
              <div className="text-xl font-semibold">S/ {(creditsSummary?.totalPending || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={TrendingUp}
          label="Ingresos"
          value={`S/ ${(summary?.totalIncome || 0).toFixed(2)}`}
          accent="bg-primary-100 text-primary-700"
        />
        <KpiCard
          icon={TrendingDown}
          label="Egresos"
          value={`S/ ${(summary?.totalExpense || 0).toFixed(2)}`}
          accent="bg-red-100 text-red-600"
        />
        <KpiCard
          icon={CreditCard}
          label="Créditos pendientes"
          value={`S/ ${(creditsSummary?.totalPending || 0).toFixed(2)}`}
          sublabel={`${creditsSummary?.activeCredits || 0} créditos activos`}
          accent="bg-orange-100 text-orange-600"
        />
        <KpiCard
          icon={FileText}
          label="Deuda proveedores"
          value={`S/ ${(apAlerts?.summary?.totalPending || 0).toFixed(2)}`}
          sublabel={`${apAlerts?.summary?.count || 0} cuentas activas`}
          accent="bg-purple-100 text-purple-600"
        />
      </div>

      {/* Quick actions */}
      <div>
        <div className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">
          Acciones rápidas
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction
            icon={ShoppingCart}
            label="Nueva Venta"
            onClick={() => navigate('/pos')}
            accent="bg-primary-100 text-primary-700"
          />
          <QuickAction
            icon={Package}
            label="Productos"
            onClick={() => navigate('/products')}
            accent="bg-blue-100 text-blue-600"
          />
          <QuickAction
            icon={Wallet}
            label="Caja"
            onClick={() => navigate('/cash-register')}
            accent="bg-orange-100 text-orange-600"
          />
          <QuickAction
            icon={BarChart3}
            label="Kardex"
            onClick={() => navigate('/kardex')}
            accent="bg-purple-100 text-purple-600"
          />
        </div>
      </div>

      {/* Ventas chart */}
      <div className="bg-white rounded-xl shadow-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Ventas</h2>
          <DateRangeFilter range={salesRange} onChange={setSalesRange} onReset={() => setSalesRange(last30Days())} resetLabel="Últimos 30 días" />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={dailySales}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={salesTickInterval} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
            <Tooltip formatter={(value: any) => [`S/ ${Number(value || 0).toFixed(2)}`, 'Ventas']} />
            <Area type="monotone" dataKey="total" stroke="#16a34a" strokeWidth={2} fill="url(#colorSales)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Ventas por categorías */}
      <div className="bg-white rounded-xl shadow-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Ventas por Categorías</h2>
          <DateRangeFilter range={catChartRange} onChange={setCatChartRange} onReset={() => setCatChartRange(thisMonth())} resetLabel="Este mes" />
        </div>

        {allCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {allCategories.map((cat, i) => {
              const color = CHART_COLORS[i % CHART_COLORS.length];
              const enabled = !disabledCats.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all"
                  style={{
                    backgroundColor: enabled ? color : 'white',
                    borderColor: color,
                    color: enabled ? 'white' : color,
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: enabled ? 'white' : color }} />
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {activeCategories.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={catChartData}>
              <defs>
                {activeCategories.map((cat) => {
                  const colorIdx = allCategories.indexOf(cat) % CHART_COLORS.length;
                  return (
                    <linearGradient key={cat} id={`grad-cat-${colorIdx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[colorIdx]} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CHART_COLORS[colorIdx]} stopOpacity={0} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={catTickInterval} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
              <Tooltip formatter={(value: any, name: any) => [`S/ ${Number(value || 0).toFixed(2)}`, name]} />
              <Legend />
              {activeCategories.map((cat) => {
                const colorIdx = allCategories.indexOf(cat) % CHART_COLORS.length;
                return (
                  <Area
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stroke={CHART_COLORS[colorIdx]}
                    strokeWidth={2}
                    fill={`url(#grad-cat-${colorIdx})`}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
            {allCategories.length === 0 ? 'Cargando categorías...' : 'Selecciona al menos una categoría'}
          </div>
        )}
      </div>

      {/* Date range filter for bottom charts */}
      <div className="bg-white rounded-xl shadow-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Filtrar gráficos inferiores:</span>
        <DateRangeFilter range={chartRange} onChange={setChartRange} onReset={() => setChartRange(thisMonth())} resetLabel="Este mes" />
      </div>

      {/* Category Sales bar + Top Suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-card p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Tag size={18} className="text-primary-600" /> Ventas por Categoría
          </h2>
          {categorySalesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categorySalesData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip formatter={(value: any) => [`S/ ${Number(value || 0).toFixed(2)}`, 'Ventas']} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {categorySalesData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">Sin datos para el período</div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-card p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Truck size={18} className="text-primary-700" /> Top Proveedores (por Compras)
          </h2>
          {topSuppliersData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topSuppliersData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    name === 'total' ? `S/ ${Number(value || 0).toFixed(2)}` : value,
                    name === 'total' ? 'Total comprado' : 'Ordenes',
                  ]}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {topSuppliersData.map((_, i) => (
                    <Cell key={i} fill={SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">Sin datos para el período</div>
          )}
          {topSuppliersData.length > 0 && (
            <div className="mt-3 space-y-1">
              {topSuppliersData.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length] }} />
                    <span>{s.name}</span>
                  </div>
                  <span className="text-gray-400">{s.count} compra{s.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Accounts Payable Alerts */}
      {((apAlerts?.overdue?.length || 0) > 0 || (apAlerts?.upcoming?.length || 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(apAlerts?.overdue?.length || 0) > 0 && (
            <div className="bg-white rounded-xl shadow-card border-l-4 border-red-400 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2"><AlertTriangle size={18} /> Pagos Vencidos</h2>
                <button onClick={() => navigate('/accounts-payable')} className="text-sm text-primary-600 hover:underline font-medium">Ver todos</button>
              </div>
              <div className="space-y-2">
                {apAlerts!.overdue.slice(0, 5).map((ap: AccountPayable) => (
                  <div key={ap.id} className="flex items-center justify-between text-sm bg-red-50 p-3 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-700">{ap.supplier}</div>
                      <div className="text-xs text-red-500">
                        Vencido: {ap.dueDate ? new Date(ap.dueDate).toLocaleDateString('es-PE') : ap.installments?.find(i => i.status === 'PENDING')?.dueDate ? new Date(ap.installments.find(i => i.status === 'PENDING')!.dueDate).toLocaleDateString('es-PE') : '-'}
                      </div>
                    </div>
                    <span className="font-bold text-red-600">S/ {ap.pendingAmount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(apAlerts?.upcoming?.length || 0) > 0 && (
            <div className="bg-white rounded-xl shadow-card border-l-4 border-yellow-400 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-yellow-700 flex items-center gap-2"><Clock size={18} /> Próximos a Vencer (3 días)</h2>
                <button onClick={() => navigate('/accounts-payable')} className="text-sm text-primary-600 hover:underline font-medium">Ver todos</button>
              </div>
              <div className="space-y-2">
                {apAlerts!.upcoming.slice(0, 5).map((ap: AccountPayable) => (
                  <div key={ap.id} className="flex items-center justify-between text-sm bg-yellow-50 p-3 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-700">{ap.supplier}</div>
                      <div className="text-xs text-yellow-600">
                        Vence: {ap.dueDate ? new Date(ap.dueDate).toLocaleDateString('es-PE') : ap.installments?.find(i => i.status === 'PENDING')?.dueDate ? new Date(ap.installments.find(i => i.status === 'PENDING')!.dueDate).toLocaleDateString('es-PE') : '-'}
                      </div>
                    </div>
                    <span className="font-bold text-yellow-700">S/ {ap.pendingAmount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

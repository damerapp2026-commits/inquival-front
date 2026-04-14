import React, { useState, useMemo } from 'react';
import { useDashboardSummary, useCreditsSummary, useSalesChart, useCategorySales, useTopSuppliers, useCategorySalesChart } from '../hooks/useDashboard';
import { useAPAlerts } from '../../accounts-payable/hooks/useAccountsPayable';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, CreditCard, FileText, AlertTriangle, Clock, Tag, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import type { AccountPayable } from '../../../shared/types';

const CHART_COLORS = ['#4681b1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
const SUPPLIER_COLORS = ['#346795', '#0ea5e9', '#f43f5e', '#84cc16', '#fb923c'];

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
        className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <label className="text-xs text-gray-500">Hasta</label>
      <input
        type="date"
        value={range.end}
        min={range.start}
        max={toInputDate(new Date())}
        onChange={(e) => onChange({ ...range, end: e.target.value })}
        className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <button onClick={onReset} className="text-xs text-primary-600 hover:underline">{resetLabel}</button>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
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

  // Determine XAxis tick interval based on data points
  const salesTickInterval = dailySales.length > 60 ? 6 : dailySales.length > 30 ? 4 : 1;
  const catTickInterval = catChartData.length > 60 ? 6 : catChartData.length > 30 ? 4 : 1;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><BarChart3 size={24} /> Dashboard</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['daily', 'weekly', 'monthly'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded text-sm font-medium ${period === p ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><TrendingUp size={16} className="text-primary-600" /> Ingresos</div>
          <div className="text-xl sm:text-2xl font-bold text-primary-600">S/ {(summary?.totalIncome || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><TrendingDown size={16} className="text-red-600" /> Egresos</div>
          <div className="text-xl sm:text-2xl font-bold text-red-600">S/ {(summary?.totalExpense || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><DollarSign size={16} className="text-blue-600" /> Ganancia Neta</div>
          <div className="text-xl sm:text-2xl font-bold text-blue-600">S/ {(summary?.netProfit || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><CreditCard size={16} className="text-orange-600" /> Creditos Pendientes</div>
          <div className="text-xl sm:text-2xl font-bold text-orange-600">S/ {(creditsSummary?.totalPending || 0).toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">{creditsSummary?.activeCredits || 0} creditos activos</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><FileText size={16} className="text-purple-600" /> Deuda Proveedores</div>
          <div className="text-xl sm:text-2xl font-bold text-purple-600">S/ {(apAlerts?.summary?.totalPending || 0).toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">{apAlerts?.summary?.count || 0} cuentas activas</div>
        </div>
      </div>

      {/* Ventas chart */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-700">Ventas</h2>
          <DateRangeFilter range={salesRange} onChange={setSalesRange} onReset={() => setSalesRange(last30Days())} resetLabel="Últimos 30 días" />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={dailySales}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4681b1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4681b1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={salesTickInterval} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
            <Tooltip formatter={(value: any) => [`S/ ${Number(value || 0).toFixed(2)}`, 'Ventas']} />
            <Area type="monotone" dataKey="total" stroke="#4681b1" strokeWidth={2} fill="url(#colorSales)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Ventas Por Categorías chart */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-700">Ventas Por Categorías</h2>
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
      <div className="bg-white border rounded-lg p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Filtrar gráficos inferiores:</span>
        <DateRangeFilter range={chartRange} onChange={setChartRange} onReset={() => setChartRange(thisMonth())} resetLabel="Este mes" />
      </div>

      {/* Category Sales bar + Top Suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2"><Tag size={18} className="text-primary-600" /> Ventas por Categoria</h2>
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
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">Sin datos para el periodo</div>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2"><Truck size={18} className="text-primary-700" /> Top Proveedores (por Compras)</h2>
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
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">Sin datos para el periodo</div>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {(apAlerts?.overdue?.length || 0) > 0 && (
            <div className="bg-white border-2 border-red-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2"><AlertTriangle size={18} /> Pagos Vencidos a Proveedores</h2>
                <button onClick={() => navigate('/accounts-payable')} className="text-sm text-primary-600 hover:underline">Ver todos</button>
              </div>
              <div className="space-y-2">
                {apAlerts!.overdue.slice(0, 5).map((ap: AccountPayable) => (
                  <div key={ap.id} className="flex items-center justify-between text-sm bg-red-50 p-2 rounded">
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
            <div className="bg-white border-2 border-yellow-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-yellow-700 flex items-center gap-2"><Clock size={18} /> Pagos Proximos a Vencer (3 dias)</h2>
                <button onClick={() => navigate('/accounts-payable')} className="text-sm text-primary-600 hover:underline">Ver todos</button>
              </div>
              <div className="space-y-2">
                {apAlerts!.upcoming.slice(0, 5).map((ap: AccountPayable) => (
                  <div key={ap.id} className="flex items-center justify-between text-sm bg-yellow-50 p-2 rounded">
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

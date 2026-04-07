import React, { useState } from 'react';
import { useDashboardSummary, useProfitability, useCreditsSummary, useSalesChart } from '../hooks/useDashboard';
import { useClients } from '../../clients/hooks/useClients';
import { useProducts } from '../../products/hooks/useProducts';
import { useAPAlerts } from '../../accounts-payable/hooks/useAccountsPayable';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, CreditCard, Users, FileText, AlertTriangle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import type { Client, Product, AccountPayable } from '../../../shared/types';

const COLORS = ['#10b981', '#f59e0b'];

export function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('daily');
  const { data: summary } = useDashboardSummary(period);
  const { data: profitability } = useProfitability();
  const { data: creditsSummary } = useCreditsSummary();
  const { data: salesChart } = useSalesChart();
  const { data: clientsData } = useClients({ limit: 200 });
  const { data: productsData } = useProducts({ limit: 200 });
  const { data: apAlerts } = useAPAlerts(3);

  const clients = clientsData?.data || [];
  const products = productsData?.data || [];
  const topProducts = Array.isArray(profitability) ? profitability.slice(0, 5) : [];
  const topDebtors = creditsSummary?.topDebtors || [];

  const dailySales = salesChart?.dailySales || [];
  const salesByHour = salesChart?.salesByHour || [];
  const paymentBreakdown = salesChart?.paymentBreakdown;

  const getClientName = (id: string) => clients.find((c: Client) => c.id === id)?.name || 'N/A';
  const getProductName = (id: string) => products.find((p: Product) => p.id === id)?.name || 'N/A';

  const periodLabels: Record<string, string> = { daily: 'Hoy', weekly: 'Esta Semana', monthly: 'Este Mes' };

  const pieData = paymentBreakdown
    ? [
        { name: 'Efectivo', value: paymentBreakdown.cash },
        { name: 'Credito', value: paymentBreakdown.credit },
      ]
    : [];

  const topProductsChart = topProducts.map((p: any) => ({
    name: p.productName || getProductName(p.productId),
    revenue: p.totalRevenue,
    units: p.totalSold,
  }));

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><BarChart3 size={24} /> Dashboard</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['daily', 'weekly', 'monthly'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded text-sm font-medium ${period === p ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><TrendingUp size={16} className="text-green-600" /> Ingresos</div>
          <div className="text-xl sm:text-2xl font-bold text-green-600">S/ {(summary?.totalIncome || 0).toFixed(2)}</div>
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

      {/* Daily Sales Area Chart */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Ventas Ultimos 30 Dias</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={dailySales}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
            <Tooltip formatter={(value: any) => [`S/ ${Number(value || 0).toFixed(2)}`, 'Ventas']} />
            <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#colorSales)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products + Sales by Hour */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Top 5 Productos (Ultimo Mes)</h2>
          {topProductsChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProductsChart} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(value: any) => [`S/ ${Number(value || 0).toFixed(2)}`, 'Ingresos']} />
                <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">Sin datos</div>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Ventas por Hora del Dia</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={salesByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
              <Tooltip
                formatter={(value: any, name: any) => [
                  name === 'total' ? `S/ ${Number(value || 0).toFixed(2)}` : value,
                  name === 'total' ? 'Monto' : 'Ventas',
                ]}
              />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Breakdown + Top Debtors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Efectivo vs Credito (30 dias)</h2>
          {pieTotal > 0 ? (
            <div className="flex items-center">
              <ResponsiveContainer width="60%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `S/ ${Number(value || 0).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {pieData.map((d, i) => (
                  <div key={d.name}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <div className="text-lg font-bold" style={{ color: COLORS[i] }}>
                      S/ {d.value.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {pieTotal > 0 ? ((d.value / pieTotal) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">Sin datos</div>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2"><Users size={18} /> Top Deudores</h2>
            <button onClick={() => navigate('/credits')} className="text-sm text-blue-600 hover:underline">Ver todos</button>
          </div>
          <div className="space-y-2">
            {topDebtors.map((d: any, i: number) => (
              <div key={d.clientId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <button onClick={() => navigate(`/credits/client/${d.clientId}`)} className="text-blue-600 hover:underline">{getClientName(d.clientId)}</button>
                </div>
                <div>
                  <span className="font-medium text-red-600">S/ {d.totalPending.toFixed(2)}</span>
                  <span className="text-gray-400 ml-2 text-xs">({d.count} creditos)</span>
                </div>
              </div>
            ))}
            {topDebtors.length === 0 && <div className="text-center py-4 text-gray-400 text-sm">Sin deudores</div>}
          </div>
        </div>
      </div>
      {/* Accounts Payable Alerts */}
      {((apAlerts?.overdue?.length || 0) > 0 || (apAlerts?.upcoming?.length || 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Overdue */}
          {(apAlerts?.overdue?.length || 0) > 0 && (
            <div className="bg-white border-2 border-red-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2"><AlertTriangle size={18} /> Pagos Vencidos a Proveedores</h2>
                <button onClick={() => navigate('/accounts-payable')} className="text-sm text-blue-600 hover:underline">Ver todos</button>
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

          {/* Upcoming */}
          {(apAlerts?.upcoming?.length || 0) > 0 && (
            <div className="bg-white border-2 border-yellow-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-yellow-700 flex items-center gap-2"><Clock size={18} /> Pagos Proximos a Vencer (3 dias)</h2>
                <button onClick={() => navigate('/accounts-payable')} className="text-sm text-blue-600 hover:underline">Ver todos</button>
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

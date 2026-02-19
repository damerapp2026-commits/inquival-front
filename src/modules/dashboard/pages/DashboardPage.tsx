import React, { useState } from 'react';
import { useDashboardSummary, useProfitability, useCreditsSummary } from '../hooks/useDashboard';
import { useClients } from '../../clients/hooks/useClients';
import { useProducts } from '../../products/hooks/useProducts';
import { useCashRegisters } from '../../cash-register/hooks/useCashRegister';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, CreditCard, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Client, Product, CashRegister } from '../../../shared/types';

export function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('daily');
  const { data: summary } = useDashboardSummary(period);
  const { data: profitability } = useProfitability();
  const { data: creditsSummary } = useCreditsSummary();
  const { data: clientsData } = useClients({ limit: 200 });
  const { data: productsData } = useProducts({ limit: 200 });
  const { data: recentRegisters } = useCashRegisters({ limit: 5 });

  const clients = clientsData?.data || [];
  const products = productsData?.data || [];
  const registers: CashRegister[] = recentRegisters?.data || [];
  const topProducts = Array.isArray(profitability) ? profitability.slice(0, 10) : [];
  const topDebtors = creditsSummary?.topDebtors || [];

  const getClientName = (id: string) => clients.find((c: Client) => c.id === id)?.name || 'N/A';
  const getProductName = (id: string) => products.find((p: Product) => p.id === id)?.name || 'N/A';

  const periodLabels: Record<string, string> = { daily: 'Hoy', weekly: 'Esta Semana', monthly: 'Este Mes' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><BarChart3 size={24} /> Dashboard</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['daily', 'weekly', 'monthly'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded text-sm font-medium ${period === p ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><TrendingUp size={16} className="text-green-600" /> Ingresos</div>
          <div className="text-2xl font-bold text-green-600">S/ {(summary?.totalIncome || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><TrendingDown size={16} className="text-red-600" /> Egresos</div>
          <div className="text-2xl font-bold text-red-600">S/ {(summary?.totalExpense || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><DollarSign size={16} className="text-blue-600" /> Ganancia Neta</div>
          <div className="text-2xl font-bold text-blue-600">S/ {(summary?.netProfit || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><CreditCard size={16} className="text-orange-600" /> Creditos Pendientes</div>
          <div className="text-2xl font-bold text-orange-600">S/ {(creditsSummary?.totalPending || 0).toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">{creditsSummary?.activeCredits || 0} creditos activos</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Top Productos (Ultimo Mes)</h2>
          <div className="space-y-2">
            {topProducts.map((p: any, i: number) => (
              <div key={p.productId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <span>{getProductName(p.productId)}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">S/ {p.totalRevenue.toFixed(2)}</span>
                  <span className="text-gray-400 ml-2 text-xs">({p.totalSold} uds)</span>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && <div className="text-center py-4 text-gray-400 text-sm">Sin datos</div>}
          </div>
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

      <div className="mt-6 bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700">Cajas Recientes</h2>
          <button onClick={() => navigate('/cash-register/history')} className="text-sm text-blue-600 hover:underline">Ver historial</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Fecha</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Apertura</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Ingresos</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Egresos</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cierre</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {registers.map((r) => {
              const active = r.entries.filter(e => !e.isDeleted);
              const income = active.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
              const expense = active.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2 text-right">S/ {r.openingBalance.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-green-600">S/ {income.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-red-600">S/ {expense.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{r.closingBalance != null ? `S/ ${r.closingBalance.toFixed(2)}` : '-'}</td>
                  <td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded-full text-xs ${r.status === 'CLOSED' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{r.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

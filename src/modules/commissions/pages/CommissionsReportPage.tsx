import { useMemo, useState } from 'react';
import { useSales } from '../../sales/hooks/useSales';
import { useProducts } from '../../products/hooks/useProducts';
import { useUsers } from '../../users/hooks/useUsers';
import { commissionForSale } from '../utils/calcCommission';
import { Briefcase, CalendarDays, Users as UsersIcon } from 'lucide-react';
import type { Sale, Product } from '../../../shared/types';

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function CommissionsReportPage() {
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getToday);
  const [sellerFilter, setSellerFilter] = useState('');

  const { data: sellersData } = useUsers({ limit: 100, role: 'VENDEDOR_CAMPO' });
  const sellers: any[] = useMemo(() => {
    const raw: any = sellersData;
    return Array.isArray(raw) ? raw : raw?.data || [];
  }, [sellersData]);

  const { data: salesData, isLoading } = useSales({
    page: 1,
    limit: 500,
    startDate,
    endDate,
    sellerId: sellerFilter || undefined,
  });
  const { data: productsData } = useProducts({ limit: 1000 });

  const sales: Sale[] = useMemo(() => (salesData?.data || []).filter((s: Sale) => !s.isCancelled && s.sellerId), [salesData]);
  const products: Product[] = useMemo(() => productsData?.data || [], [productsData]);

  const grouped = useMemo(() => {
    const map: Record<string, { sellerId: string; name: string; sales: number; total: number; commission: number }> = {};
    sales.forEach((sale) => {
      const sellerId = sale.sellerId!;
      const name = sale.sellerName || sellers.find((s) => s.id === sellerId)?.fullName || sellers.find((s) => s.id === sellerId)?.username || sellerId;
      if (!map[sellerId]) map[sellerId] = { sellerId, name, sales: 0, total: 0, commission: 0 };
      map[sellerId].sales++;
      map[sellerId].total += sale.total;
      map[sellerId].commission += commissionForSale(sale, products);
    });
    return Object.values(map).sort((a, b) => b.commission - a.commission);
  }, [sales, products, sellers]);

  const totalCommission = grouped.reduce((s, g) => s + g.commission, 0);
  const totalSales = grouped.reduce((s, g) => s + g.total, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Briefcase size={24} /> Reporte de Comisiones
        </h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">Todos los vendedores</option>
          {sellers.map((s: any) => <option key={s.id} value={s.id}>{s.fullName || s.username}</option>)}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
        <span className="text-gray-500 text-sm">hasta</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
        {(startDate !== getMonthStart() || endDate !== getToday()) && (
          <button onClick={() => { setStartDate(getMonthStart()); setEndDate(getToday()); }} className="flex items-center gap-1 px-3 py-2 text-sm text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100">
            <CalendarDays size={14} /> Este mes
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs text-emerald-700 mb-1">Comisiones a pagar</div>
          <div className="text-3xl font-bold text-emerald-800">S/ {totalCommission.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total vendido (con vendedor)</div>
          <div className="text-3xl font-bold text-gray-800">S/ {totalSales.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Vendedores activos en período</div>
          <div className="text-3xl font-bold text-gray-800">{grouped.length}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <UsersIcon size={14} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Por vendedor</h2>
        </div>
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Sin ventas atribuidas a vendedores en el período</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Vendedor</th>
                <th className="text-right px-4 py-2"># Ventas</th>
                <th className="text-right px-4 py-2">Total Vendido</th>
                <th className="text-right px-4 py-2">% Efectiva</th>
                <th className="text-right px-4 py-2">Comisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grouped.map((g) => (
                <tr key={g.sellerId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{g.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{g.sales}</td>
                  <td className="px-4 py-3 text-right text-gray-700">S/ {g.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {g.total > 0 ? `${((g.commission / g.total) * 100).toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-emerald-700">S/ {g.commission.toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

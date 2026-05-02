import { useMemo, useState } from 'react';
import { useSales } from '../../sales/hooks/useSales';
import { useProducts } from '../../products/hooks/useProducts';
import { useAuth } from '../../../app/providers/AuthProvider';
import { commissionForSale, commissionLines } from '../utils/calcCommission';
import { Percent, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import type { Sale, Product } from '../../../shared/types';

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function MyCommissionsPage() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getToday);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const { data: salesData, isLoading } = useSales({
    page: 1,
    limit: 200,
    startDate,
    endDate,
    sellerId: user?.id,
  });
  const { data: productsData } = useProducts({ limit: 1000 });

  const sales: Sale[] = useMemo(() => (salesData?.data || []).filter((s: Sale) => !s.isCancelled), [salesData]);
  const products: Product[] = useMemo(() => productsData?.data || [], [productsData]);

  const totals = useMemo(() => {
    let totalSales = 0;
    let totalCommission = 0;
    let countWithCommission = 0;
    sales.forEach((sale) => {
      totalSales += sale.total;
      const c = commissionForSale(sale, products);
      if (c > 0) countWithCommission++;
      totalCommission += c;
    });
    return { totalSales, totalCommission, count: sales.length, countWithCommission };
  }, [sales, products]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Percent size={24} /> Mis Comisiones
        </h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
        <span className="text-gray-500 text-sm">hasta</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
        {(startDate !== getMonthStart() || endDate !== getToday()) && (
          <button onClick={() => { setStartDate(getMonthStart()); setEndDate(getToday()); }} className="flex items-center gap-1 px-3 py-2 text-sm text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100">
            <CalendarDays size={14} /> Este mes
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs text-emerald-700 mb-1">Comisión acumulada</div>
          <div className="text-3xl font-bold text-emerald-800">S/ {totals.totalCommission.toFixed(2)}</div>
          <div className="text-xs text-emerald-600 mt-1">{totals.countWithCommission} venta{totals.countWithCommission !== 1 ? 's' : ''} con comisión</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total vendido</div>
          <div className="text-3xl font-bold text-gray-800">S/ {totals.totalSales.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">{totals.count} venta{totals.count !== 1 ? 's' : ''} en el período</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">% efectiva</div>
          <div className="text-3xl font-bold text-gray-800">
            {totals.totalSales > 0 ? `${((totals.totalCommission / totals.totalSales) * 100).toFixed(2)}%` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">comisión / total vendido</div>
        </div>
      </div>

      {/* Lista de ventas */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Detalle por venta</h2>
        </div>
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : sales.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Sin ventas en el período</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sales.map((sale) => {
              const lines = commissionLines(sale, products);
              const total = lines.reduce((s, l) => s + l.commissionAmount, 0);
              const isOpen = expandedSaleId === sale.id;
              return (
                <div key={sale.id}>
                  <button
                    onClick={() => setExpandedSaleId(isOpen ? null : sale.id)}
                    className="w-full px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-left"
                  >
                    {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">
                        {new Date(sale.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })} · S/ {sale.total.toFixed(2)}
                        {sale.isCredit && <span className="ml-2 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Crédito</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{sale.items.length} producto{sale.items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${total > 0 ? 'text-emerald-700' : 'text-gray-300'}`}>
                        S/ {total.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">comisión</div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 bg-gray-50">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500">
                          <tr>
                            <th className="text-left py-2">Producto</th>
                            <th className="text-right py-2">Cant.</th>
                            <th className="text-right py-2">P. Unit</th>
                            <th className="text-right py-2">Subtotal</th>
                            <th className="text-right py-2">Comisión</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {lines.map((line) => (
                            <tr key={line.productId}>
                              <td className="py-2">{line.productName}</td>
                              <td className="py-2 text-right">{line.quantity}</td>
                              <td className="py-2 text-right">S/ {line.unitPrice.toFixed(2)}</td>
                              <td className="py-2 text-right">S/ {line.subtotal.toFixed(2)}</td>
                              <td className="py-2 text-right">
                                {line.commissionType ? (
                                  <span className="text-emerald-700 font-medium">
                                    S/ {line.commissionAmount.toFixed(2)}
                                    <span className="text-xs text-gray-400 ml-1">
                                      ({line.commissionType === 'PERCENT' ? `${line.commissionValue}%` : `S/ ${line.commissionValue}/u`})
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useSales } from '../../sales/hooks/useSales';
import { useProducts } from '../../products/hooks/useProducts';
import { useUsers } from '../../users/hooks/useUsers';
import { commissionForSale, commissionLines } from '../utils/calcCommission';
import {
  Briefcase, CalendarDays, Users as UsersIcon, TrendingUp,
  DollarSign, ChevronDown, ChevronRight, ShoppingBag,
} from 'lucide-react';
import type { Sale, Product } from '../../../shared/types';

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
];

export function CommissionsReportPage() {
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getToday);
  const [sellerFilter, setSellerFilter] = useState('');
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);

  const { data: sellersData } = useUsers({ limit: 200 });
  const sellers: any[] = useMemo(() => {
    const raw: any = sellersData;
    const list = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((u: any) => u.role === 'VENDEDOR' || u.role === 'VENDEDOR_CAMPO');
  }, [sellersData]);

  const { data: salesData, isLoading } = useSales({
    page: 1,
    limit: 500,
    startDate,
    endDate,
    sellerId: sellerFilter || undefined,
  });
  const { data: productsData } = useProducts({ limit: 1000 });

  const sales: Sale[] = useMemo(
    () => (salesData?.data || []).filter((s: Sale) => !s.isCancelled && s.sellerId),
    [salesData],
  );
  const products: Product[] = useMemo(() => productsData?.data || [], [productsData]);

  const grouped = useMemo(() => {
    const map: Record<string, {
      sellerId: string; name: string; sales: number;
      creditSales: number; total: number; commission: number; creditCommission: number;
      saleList: Sale[];
    }> = {};
    sales.forEach((sale) => {
      const sid = sale.sellerId!;
      const name = sale.sellerName || sellers.find((s) => s.id === sid)?.fullName || sid;
      if (!map[sid]) map[sid] = { sellerId: sid, name, sales: 0, creditSales: 0, total: 0, commission: 0, creditCommission: 0, saleList: [] };
      const c = commissionForSale(sale, products);
      map[sid].sales++;
      map[sid].total += sale.total;
      map[sid].commission += c;
      map[sid].saleList.push(sale);
      if (sale.isCredit) { map[sid].creditSales++; map[sid].creditCommission += c; }
    });
    return Object.values(map).sort((a, b) => b.commission - a.commission);
  }, [sales, products, sellers]);

  const totalCommission = grouped.reduce((s, g) => s + g.commission, 0);
  const totalSales = grouped.reduce((s, g) => s + g.total, 0);
  const maxCommission = grouped.reduce((m, g) => Math.max(m, g.commission), 0);

  const isFiltered = startDate !== getMonthStart() || endDate !== getToday();

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Briefcase size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reporte de Comisiones</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Calculado sobre ventas no anuladas, incluidas las ventas a crédito
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={DollarSign}
          label="Comisiones a pagar"
          value={`S/ ${totalCommission.toFixed(2)}`}
          accent="bg-emerald-100 text-emerald-700"
          highlight
        />
        <KpiCard
          icon={ShoppingBag}
          label="Total vendido (con vendedor)"
          value={`S/ ${totalSales.toFixed(2)}`}
          accent="bg-sky-100 text-sky-700"
        />
        <KpiCard
          icon={UsersIcon}
          label="Vendedores activos en período"
          value={String(grouped.length)}
          accent="bg-violet-100 text-violet-700"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-card p-4 flex flex-wrap items-center gap-3">
        <select
          value={sellerFilter}
          onChange={(e) => setSellerFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        >
          <option value="">Todos los vendedores</option>
          {sellers.map((s: any) => (
            <option key={s.id} value={s.id}>{s.fullName || s.username}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-gray-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {isFiltered && (
          <button
            onClick={() => { setStartDate(getMonthStart()); setEndDate(getToday()); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-700 bg-primary-50 border border-primary-200 rounded-xl hover:bg-primary-100 transition-colors"
          >
            <CalendarDays size={13} /> Este mes
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Detalle por vendedor</h2>
          </div>
          {grouped.length > 0 && (
            <span className="text-xs text-gray-400">{grouped.length} vendedor{grouped.length !== 1 ? 'es' : ''}</span>
          )}
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : grouped.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-gray-100">
            {grouped.map((g, idx) => {
              const pct = totalSales > 0 ? (g.total / totalSales) * 100 : 0;
              const commPct = g.total > 0 ? (g.commission / g.total) * 100 : 0;
              const barWidth = maxCommission > 0 ? (g.commission / maxCommission) * 100 : 0;
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const isOpen = expandedSeller === g.sellerId;

              return (
                <div key={g.sellerId}>
                  {/* Row */}
                  <button
                    onClick={() => setExpandedSeller(isOpen ? null : g.sellerId)}
                    className="w-full px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor}`}>
                        {initials(g.name)}
                      </div>

                      {/* Name + bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800 text-sm">{g.name}</span>
                          {g.creditSales > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">
                              {g.creditSales} crédito
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full transition-all"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
                            {commPct.toFixed(1)}% efectiva
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex items-center gap-6 text-right flex-shrink-0">
                        <div>
                          <div className="text-xs text-gray-400">Ventas</div>
                          <div className="text-sm font-medium text-gray-700">{g.sales}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Total vendido</div>
                          <div className="text-sm font-medium text-gray-700">S/ {g.total.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Participación</div>
                          <div className="text-sm font-medium text-gray-700">{pct.toFixed(1)}%</div>
                        </div>
                      </div>

                      {/* Commission */}
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="text-lg font-bold text-emerald-700">S/ {g.commission.toFixed(2)}</div>
                        <div className="text-xs text-gray-400">comisión</div>
                      </div>

                      {/* Chevron */}
                      <div className="flex-shrink-0 text-gray-400">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded: sale breakdown */}
                  {isOpen && (
                    <div className="bg-gray-50 border-t border-gray-100 px-5 pb-4 pt-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Ventas del período
                      </p>
                      <div className="space-y-1">
                        {g.saleList.map((sale) => {
                          const lines = commissionLines(sale, products);
                          const saleComm = lines.reduce((s, l) => s + l.commissionAmount, 0);
                          return (
                            <div key={sale.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-700">
                                  {new Date(sale.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                                </span>
                                {sale.isCredit && (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">crédito</span>
                                )}
                                <span className="ml-2 text-xs text-gray-400">
                                  {sale.items.length} prod · S/ {sale.total.toFixed(2)}
                                </span>
                              </div>
                              <span className={`text-sm font-semibold ${saleComm > 0 ? 'text-emerald-700' : 'text-gray-300'}`}>
                                S/ {saleComm.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer totals */}
        {!isLoading && grouped.length > 1 && (
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">Total general</span>
            <div className="flex items-center gap-6 text-right">
              <div className="hidden sm:block">
                <div className="text-xs text-gray-400">Total vendido</div>
                <div className="text-sm font-semibold text-gray-700">S/ {totalSales.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Comisiones</div>
                <div className="text-lg font-bold text-emerald-700">S/ {totalCommission.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent, highlight }: {
  icon: any; label: string; value: string; accent: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl shadow-card p-5 flex items-center gap-4 hover:shadow-card-hover transition-shadow ${highlight ? 'bg-emerald-50 border border-emerald-100' : 'bg-white'}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</div>
        <div className={`text-2xl font-bold leading-tight mt-0.5 ${highlight ? 'text-emerald-800' : 'text-gray-800'}`}>{value}</div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-1/3" />
            <div className="h-2 bg-gray-100 rounded w-2/3" />
          </div>
          <div className="w-24 h-6 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-16 flex flex-col items-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
        <Briefcase size={26} className="text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">Sin ventas atribuidas a vendedores</p>
      <p className="text-xs text-gray-400">Ajusta el rango de fechas o selecciona otro vendedor</p>
    </div>
  );
}

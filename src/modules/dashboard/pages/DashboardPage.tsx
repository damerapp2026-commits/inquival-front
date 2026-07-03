import { useState, useMemo } from 'react';
import { useDashboardSummary, useCreditsSummary, useSalesChart, useCategorySales, useTopSuppliers, useCategorySalesChart, useExchangeRate, useProfitability } from '../hooks/useDashboard';
import { useAPAlerts } from '../../accounts-payable/hooks/useAccountsPayable';
import { useSales } from '../../sales/hooks/useSales';
import { usePriceCatalog, usePurchases } from '../../purchases/hooks/usePurchases';
import { useProducts } from '../../products/hooks/useProducts';
import { useUsers } from '../../users/hooks/useUsers';
import { useAuth } from '../../../app/providers/AuthProvider';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, FileText, AlertTriangle, Clock, Tag, Truck, ShoppingCart, Package, BarChart3, Wallet, Users as UsersIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import type { AccountPayable, Product, Purchase, Sale } from '../../../shared/types';

const CHART_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
const SUPPLIER_COLORS = ['#15803d', '#0ea5e9', '#f43f5e', '#84cc16', '#fb923c'];
const SELLER_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

const symFor = (ap?: { currency?: 'PEN' | 'USD' } | null): string => (ap?.currency === 'USD' ? '$' : 'S/');
const formatAmount = (value: unknown): string =>
  Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const formatCount = (value: unknown): string =>
  Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

const numberFrom = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const firstNumber = (row: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = numberFrom(row[key]);
    if (value != null) return value;
  }
  return null;
};

const firstPositive = (...values: Array<unknown>): number | null => {
  for (const value of values) {
    const n = numberFrom(value);
    if (n != null && n > 0) return n;
  }
  return null;
};

const normalizeName = (value: unknown): string =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const pickString = (source: Record<string, any>, keys: string[]): string => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
};

const pickProductId = (source: Record<string, any>): string =>
  pickString(source, ['productId', 'product_id', 'productID']) || pickString(source.product || {}, ['id', '_id']);

const pickProductName = (source: Record<string, any>): string =>
  normalizeName(
    pickString(source, ['productName', 'name', 'product_name', 'product']) ||
    pickString(source.product || {}, ['name', 'productName']),
  );

const pickNumber = (source: Record<string, any>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = numberFrom(source[key]);
    if (value != null) return value;
  }
  return null;
};

function buildProductNameById(products: Product[]) {
  return new Map(products.map((product) => [product.id, normalizeName(product.name)]));
}

function buildProductCostLookup(products: Product[], catalogRows: Record<string, any>[]) {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();

  catalogRows.forEach((row) => {
    const productId = pickProductId(row);
    const productName = pickProductName(row);
    const exchangeRate = numberFrom(row.exchangeRate) || 1;
    const cost = firstPositive(
      row.unitCost,
      row.unit_cost,
      row.unitPriceConIgvPen,
      row.unit_price_con_igv_pen,
      row.unitPriceSinIgvPen,
      row.unit_price_sin_igv_pen,
      row.unitPriceConIgvUsd ? numberFrom(row.unitPriceConIgvUsd)! * exchangeRate : null,
      row.unit_price_con_igv_usd ? numberFrom(row.unit_price_con_igv_usd)! * exchangeRate : null,
    );
    if (!cost) return;
    if (productId) byId.set(productId, cost);
    if (productName) byName.set(productName, cost);
  });

  products.forEach((product) => {
    const cost = firstPositive((product as any).lastCostPrice, (product as any).last_cost_price);
    if (!cost) return;
    byId.set(product.id, cost);
    const name = normalizeName(product.name);
    if (name) byName.set(name, cost);
  });

  return { byId, byName };
}

function buildProductSalePriceLookup(products: Product[], catalogRows: Record<string, any>[]) {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();

  catalogRows.forEach((row) => {
    const productId = pickProductId(row);
    const productName = pickProductName(row);
    const price = firstPositive(row.precioVenta, row.precio_venta, row.precioMinorista, row.precio_minorista, row.precioEspecial, row.precio_especial);
    if (!price) return;
    if (productId) byId.set(productId, price);
    if (productName) byName.set(productName, price);
  });

  products.forEach((product) => {
    const prices = Array.isArray(product.prices) ? product.prices : [];
    const price = firstPositive(
      (product as any).lastSalePrice,
      (product as any).last_sale_price,
      ...prices.map((item: any) => item?.price),
    );
    if (!price) return;
    byId.set(product.id, price);
    const name = normalizeName(product.name);
    if (name) byName.set(name, price);
  });

  return { byId, byName };
}

function buildLatestCostByProduct(purchases: Purchase[], productNameById: Map<string, string>) {
  const latest = new Map<string, { cost: number; at: number }>();
  const byName = new Map<string, { cost: number; at: number }>();

  purchases.forEach((purchase: any) => {
    if (purchase.isCancelled || purchase.cancelledAt) return;
    const at = new Date(purchase.issueDate || purchase.date || purchase.createdAt || 0).getTime() || 0;
    const exchangeRate = numberFrom(purchase.exchangeRate) || 1;
    const isUsd = purchase.totalCostUsd != null;

    (purchase.items || []).forEach((item: any) => {
      const productId = pickProductId(item);
      const productName = pickProductName(item) || (productId ? productNameById.get(productId) || '' : '');
      const unitCost = pickNumber(item, ['unitCost', 'unit_cost', 'cost', 'purchasePrice', 'purchase_price']);
      const unitPriceConIgv = pickNumber(item, ['unitPriceConIgv', 'unit_price_con_igv', 'unitPriceWithTax']);
      const unitPriceSinIgv = pickNumber(item, ['unitPriceSinIgv', 'unit_price_sin_igv', 'unitPriceWithoutTax']);
      const cost = firstPositive(
        unitCost,
        isUsd && unitPriceConIgv ? unitPriceConIgv * exchangeRate : unitPriceConIgv,
        isUsd && unitPriceSinIgv ? unitPriceSinIgv * exchangeRate : unitPriceSinIgv,
      );
      if (!cost) return;
      if (productId) {
        const current = latest.get(productId);
        if (!current || at >= current.at) latest.set(productId, { cost, at });
      }
      if (productName) {
        const current = byName.get(productName);
        if (!current || at >= current.at) byName.set(productName, { cost, at });
      }
    });
  });

  return { byId: latest, byName };
}

function buildSoldQuantityByProduct(sales: Sale[], productNameById: Map<string, string>) {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();

  sales.forEach((sale) => {
    if (sale.isCancelled) return;
    (sale.items || []).forEach((item: any) => {
      const quantity = numberFrom(item.quantity) || 0;
      if (quantity <= 0) return;
      const productId = pickProductId(item);
      if (productId) byId.set(productId, (byId.get(productId) || 0) + quantity);
      const productName = pickProductName(item) || (productId ? productNameById.get(productId) || '' : '');
      if (productName) byName.set(productName, (byName.get(productName) || 0) + quantity);
    });
  });

  return { byId, byName };
}

function enrichProfitabilityRows(rows: unknown, purchases: Purchase[], sales: Sale[], products: Product[], catalogRows: Record<string, any>[]) {
  if (!Array.isArray(rows)) return rows;
  const productNameById = buildProductNameById(products);
  const productCostLookup = buildProductCostLookup(products, catalogRows);
  const productSalePriceLookup = buildProductSalePriceLookup(products, catalogRows);
  const latestCostByProduct = buildLatestCostByProduct(purchases, productNameById);
  const soldQuantityByProduct = buildSoldQuantityByProduct(sales, productNameById);

  return rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    const productId = pickProductId(row as Record<string, any>);
    const productName = pickProductName(row as Record<string, any>) || (productId ? productNameById.get(productId) || '' : '');
    const currentCost = numberFrom(row.totalCost);
    const totalRevenue = numberFrom(row.totalRevenue) ?? 0;
    const salePrice =
      (productId ? productSalePriceLookup.byId.get(productId) : null) ??
      (productName ? productSalePriceLookup.byName.get(productName) : null);
    const quantity =
      firstNumber(row, [
        'totalQuantity',
        'total_quantity',
        'quantity',
        'cantidad',
        'soldQuantity',
        'sold_quantity',
        'quantitySold',
        'quantity_sold',
        'unitsSold',
        'units_sold',
        'totalUnitsSold',
        'total_units_sold',
        'qty',
      ]) ??
      (productId ? soldQuantityByProduct.byId.get(productId) : null) ??
      (productName ? soldQuantityByProduct.byName.get(productName) : null) ??
      (salePrice && totalRevenue > 0 ? totalRevenue / salePrice : null);
    const latestCost =
      (productId ? latestCostByProduct.byId.get(productId)?.cost : null) ??
      (productName ? latestCostByProduct.byName.get(productName)?.cost : null) ??
      (productId ? productCostLookup.byId.get(productId) : null) ??
      (productName ? productCostLookup.byName.get(productName) : null);

    if (currentCost != null || !quantity || !latestCost) return row;

    const totalCost = Math.round(quantity * latestCost * 100) / 100;
    const grossProfit = Math.round((totalRevenue - totalCost) * 100) / 100;

    return {
      ...row,
      totalCost,
      grossProfit,
      marginPercent: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    };
  });
}

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
  const [exchangeDays, setExchangeDays] = useState(7);
  const [profitRange, setProfitRange] = useState(last30Days);

  const { data: summary } = useDashboardSummary(period);
  const { data: creditsSummary } = useCreditsSummary();
  const { data: salesChart } = useSalesChart(salesRange.start, salesRange.end);
  const { data: apAlerts } = useAPAlerts(3);
  const { data: exchangeRateData, isLoading: exchangeLoading } = useExchangeRate(exchangeDays);
  const { data: categorySales } = useCategorySales(chartRange.start, chartRange.end);
  const { data: topSuppliers } = useTopSuppliers(chartRange.start, chartRange.end);
  const { data: catSalesChart } = useCategorySalesChart(catChartRange.start, catChartRange.end);
  const { data: sellerSalesData, isLoading: sellerSalesLoading } = useSales({ page: 1, limit: 1000, startDate: chartRange.start, endDate: chartRange.end });
  const { data: profitabilitySalesData, isLoading: profitabilitySalesLoading } = useSales({
    page: 1,
    limit: 5000,
    startDate: profitRange.start,
    endDate: profitRange.end,
  });
  const { data: usersData } = useUsers({ limit: 200 });
  const { data: profitabilityData, isLoading: profitLoading } = useProfitability(
    user?.role === 'ADMIN' ? profitRange.start : undefined,
    user?.role === 'ADMIN' ? profitRange.end : undefined,
  );
  const { data: purchasesData, isLoading: purchasesLoading } = usePurchases(
    { page: 1, limit: 1000 },
    { enabled: user?.role === 'ADMIN' },
  );
  const { data: priceCatalogData, isLoading: priceCatalogLoading } = usePriceCatalog({ enabled: user?.role === 'ADMIN' });
  const { data: productsData, isLoading: productsLoading } = useProducts({ limit: 10000 });

  const sellersList: any[] = useMemo(() => {
    const raw: any = usersData;
    const list: any[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((u: any) => u.role === 'VENDEDOR' || u.role === 'VENDEDOR_CAMPO' || u.role === 'ADMIN');
  }, [usersData]);

  const sellerComparison = useMemo(() => {
    const sellersById = new Map(sellersList.map((u: any) => [u.id, u]));
    const sales: Sale[] = (sellerSalesData?.data || []).filter((s: Sale) => {
      if (s.isCancelled) return false;
      if (s.sellerId) return true;
      // ventas antiguas de admins: no tienen sellerId pero sí createdBy
      return !!s.createdBy && sellersById.has(s.createdBy);
    });
    const map: Record<string, { name: string; total: number; count: number }> = {};
    sales.forEach((sale) => {
      const id = sale.sellerId || sale.createdBy!;
      const user = sellersById.get(id);
      const name = sale.sellerName || user?.fullName || user?.username || 'Vendedor';
      if (!map[id]) map[id] = { name, total: 0, count: 0 };
      map[id].total += sale.total;
      map[id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [sellerSalesData, sellersList]);

  const dailySales = salesChart?.dailySales || [];
  const categorySalesData: { name: string; total: number }[] = Array.isArray(categorySales) ? categorySales : [];
  const topSuppliersData: { name: string; total: number; count: number }[] = Array.isArray(topSuppliers) ? topSuppliers : [];
  const catChartData: Record<string, any>[] = catSalesChart?.dailyData || [];
  const allCategories: string[] = catSalesChart?.categories || [];
  const purchases: Purchase[] = Array.isArray(purchasesData) ? purchasesData : purchasesData?.data || [];
  const profitabilitySales: Sale[] = Array.isArray(profitabilitySalesData) ? profitabilitySalesData : profitabilitySalesData?.data || [];
  const products: Product[] = Array.isArray(productsData) ? productsData : productsData?.data || [];
  const priceCatalogRows: Record<string, any>[] = Array.isArray(priceCatalogData) ? priceCatalogData : [];
  const enrichedProfitabilityData = useMemo(
    () => enrichProfitabilityRows(profitabilityData, purchases, profitabilitySales, products, priceCatalogRows),
    [profitabilityData, purchases, profitabilitySales, products, priceCatalogRows],
  );

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
              <div className="text-5xl font-bold">S/ {formatAmount(summary?.totalIncome)}</div>
              <div className="text-sm text-primary-100 mt-2">
                Ganancia neta: S/ {formatAmount(summary?.netProfit)}
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
              <div className="text-xl font-semibold">S/ {formatAmount(summary?.totalExpense)}</div>
            </div>
            <div>
              <div className="text-xs text-primary-100">Deudas por cobrar</div>
              <div className="text-xl font-semibold">S/ {formatAmount(creditsSummary?.totalPending)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={TrendingUp}
          label="Ingresos"
          value={`S/ ${formatAmount(summary?.totalIncome)}`}
          accent="bg-primary-100 text-primary-700"
        />
        <KpiCard
          icon={TrendingDown}
          label="Egresos"
          value={`S/ ${formatAmount(summary?.totalExpense)}`}
          accent="bg-red-100 text-red-600"
        />
        <KpiCard
          icon={CreditCard}
          label="Deudas por cobrar"
          value={`S/ ${formatAmount(creditsSummary?.totalPending)}`}
          sublabel={`${formatCount(creditsSummary?.activeCredits)} créditos activos`}
          accent="bg-orange-100 text-orange-600"
        />
        <KpiCard
          icon={FileText}
          label="Deudas por pagar"
          value={`S/ ${formatAmount(apAlerts?.summary?.totalPending)}`}
          sublabel={`${formatCount(apAlerts?.summary?.count)} cuentas activas`}
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

      {/* Tipo de Cambio USD/PEN */}
      <div className="bg-white rounded-xl shadow-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <DollarSign size={20} className="text-green-600" />
              Tipo de Cambio USD / PEN
            </h2>
            {Array.isArray(exchangeRateData) && exchangeRateData.length > 0 && (() => {
              const last = exchangeRateData[exchangeRateData.length - 1];
              return (
                <p className="text-xs text-gray-400 mt-0.5">
                  Último: <span className="font-semibold text-green-700">S/ {last.venta?.toFixed(3)}</span> venta · <span className="font-semibold text-blue-700">S/ {last.compra?.toFixed(3)}</span> compra
                  <span className="ml-2 text-gray-300">({last.date})</span>
                </p>
              );
            })()}
          </div>
          <div className="flex gap-1">
            {[{ label: '7 días', value: 7 }, { label: '15 días', value: 15 }, { label: '30 días', value: 30 }].map(opt => (
              <button
                key={opt.value}
                onClick={() => setExchangeDays(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${exchangeDays === opt.value ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {exchangeLoading ? (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">Cargando tipo de cambio...</div>
        ) : !Array.isArray(exchangeRateData) || exchangeRateData.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">Sin datos disponibles</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={exchangeRateData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => {
                  const [, m, d] = v.split('-');
                  return `${d}/${m}`;
                }}
                interval={exchangeRateData.length > 20 ? 3 : exchangeRateData.length > 10 ? 1 : 0}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
                tickFormatter={(v) => `S/${v.toFixed(2)}`}
                width={62}
              />
              <Tooltip
                formatter={(value: any, name) => [`S/ ${Number(value).toFixed(3)}`, name === 'venta' ? 'Venta' : 'Compra']}
                labelFormatter={(label) => {
                  const [y, m, d] = label.split('-');
                  return `${d}/${m}/${y}`;
                }}
              />
              <Legend formatter={(v) => v === 'venta' ? 'Venta' : 'Compra'} />
              <Line type="monotone" dataKey="venta" stroke="#16a34a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="compra" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
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

      {/* Comparativo de Vendedores */}
      <div className="bg-white rounded-xl shadow-card p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <UsersIcon size={18} className="text-primary-600" /> Comparativo de Vendedores
        </h2>
        {sellerSalesLoading ? (
          <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">Cargando vendedores...</div>
        ) : sellerComparison.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={Math.max(280, sellerComparison.length * 48)}>
              <BarChart data={sellerComparison} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    name === 'total' ? `S/ ${Number(value || 0).toFixed(2)}` : value,
                    name === 'total' ? 'Total vendido' : 'Ventas',
                  ]}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {sellerComparison.map((_, i) => (
                    <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {sellerComparison.map((s, i) => (
                <div key={s.name + i} className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SELLER_COLORS[i % SELLER_COLORS.length] }} />
                    <span className="truncate">{s.name}</span>
                  </div>
                  <span className="text-gray-400 whitespace-nowrap">{s.count} venta{s.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">Sin ventas registradas en el período</div>
        )}
      </div>

      {/* Rentabilidad Bruta — solo ADMIN */}
      {user?.role === 'ADMIN' && (
        <div className="bg-white rounded-xl shadow-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-600" />
                Rentabilidad Bruta por Producto
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Precio Venta − Precio Costo · Top 15 productos</p>
            </div>
            <DateRangeFilter
              range={profitRange}
              onChange={setProfitRange}
              onReset={() => setProfitRange(last30Days())}
              resetLabel="Últimos 30 días"
            />
          </div>

          {profitLoading || purchasesLoading || profitabilitySalesLoading || productsLoading || priceCatalogLoading ? (
            <div className="h-[360px] flex items-center justify-center text-gray-400 text-sm">Calculando rentabilidad...</div>
          ) : !Array.isArray(enrichedProfitabilityData) || enrichedProfitabilityData.length === 0 ? (
            <div className="h-[360px] flex items-center justify-center text-gray-400 text-sm">Sin ventas en el período seleccionado</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(320, enrichedProfitabilityData.length * 48)}>
                <BarChart data={enrichedProfitabilityData} layout="vertical" margin={{ left: 10, right: 60 }} barCategoryGap="25%" barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
                  <YAxis
                    type="category"
                    dataKey="productName"
                    tick={{ fontSize: 11 }}
                    width={160}
                    tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 21) + '…' : v}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[200px]">
                          <p className="font-semibold text-gray-800 mb-2">{label}</p>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Ingresos</span>
                            <span className="font-medium text-blue-600">S/ {Number(row?.totalRevenue || 0).toFixed(2)}</span>
                          </div>
                          {row?.totalCost != null && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Costo total</span>
                              <span className="font-medium text-orange-500">S/ {Number(row.totalCost).toFixed(2)}</span>
                            </div>
                          )}
                          {row?.unitCost != null && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Precio costo</span>
                              <span className="font-medium text-orange-500">S/ {Number(row.unitCost).toFixed(2)}</span>
                            </div>
                          )}
                          {row?.totalSold != null && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Cantidad</span>
                              <span className="font-medium text-gray-700">{Number(row.totalSold).toFixed(2)}</span>
                            </div>
                          )}
                          {row?.grossProfit != null && (
                            <div className="flex justify-between gap-4 border-t border-gray-100 pt-1 mt-1">
                              <span className="text-gray-700 font-medium">Ganancia bruta</span>
                              <span className={`font-bold ${row.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                S/ {Number(row.grossProfit).toFixed(2)}
                              </span>
                            </div>
                          )}
                          {row?.marginPercent != null && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Margen</span>
                              <span className={`font-semibold ${row.marginPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {Number(row.marginPercent).toFixed(1)}%
                              </span>
                            </div>
                          )}
                          {row?.totalCost == null && (
                            <p className="text-gray-400 italic">Sin precio de costo registrado</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="totalRevenue" name="Ingresos" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="totalCost" name="Costo" fill="#f97316" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="grossProfit" name="Ganancia" fill="#10b981" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 flex flex-wrap gap-3">
                {(() => {
                  const rows = enrichedProfitabilityData as any[];
                  const totalRev = rows.reduce((s: number, r: any) => s + (r.totalRevenue || 0), 0);
                  const totalCost = rows.filter((r: any) => r.totalCost != null).reduce((s: number, r: any) => s + r.totalCost, 0);
                  const totalProfit = totalRev - totalCost;
                  const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
                  const hasCost = rows.some((r: any) => r.totalCost != null);
                  return (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        Ingresos totales: S/ {totalRev.toFixed(2)}
                      </span>
                      {hasCost && (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                            Costo total: S/ {totalCost.toFixed(2)}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${totalProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            Ganancia bruta: S/ {totalProfit.toFixed(2)}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${avgMargin >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            Margen promedio: {avgMargin.toFixed(1)}%
                          </span>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}

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
                    <span className="font-bold text-red-600">{symFor(ap)} {ap.pendingAmount.toFixed(2)}</span>
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
                    <span className="font-bold text-yellow-700">{symFor(ap)} {ap.pendingAmount.toFixed(2)}</span>
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

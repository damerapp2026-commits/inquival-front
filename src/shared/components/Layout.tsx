import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { useAPAlerts } from '../../modules/accounts-payable/hooks/useAccountsPayable';
import { useExpiringLots } from '../../modules/stock/hooks/useProductLots';
import {
  Package, ShoppingCart, TrendingUp, Users, Building2, Layers, ArrowLeftRight,
  LogOut, Menu, X, Wallet, CreditCard, BarChart3, FolderTree, Shield,
  ClipboardList, FileText, Bell, AlertTriangle, Clock, ScanLine, Ruler, ScrollText, Receipt,
  ChevronLeft, ChevronRight, Percent, Briefcase, CalendarClock, MoreHorizontal,
} from 'lucide-react';
import type { AccountPayable, ProductLot } from '../types';

type NavItem = { path: string; label: string; icon: any; roles?: string[] };
type NavSection = { label: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    label: 'PRINCIPAL',
    items: [{ path: '/dashboard', label: 'Inicio', icon: BarChart3, roles: ['ADMIN'] }],
  },
  {
    label: 'MIS DATOS',
    items: [
      { path: '/sales', label: 'Mis Ventas', icon: ShoppingCart, roles: ['VENDEDOR_CAMPO', 'VENDEDOR'] },
      { path: '/quotes', label: 'Mis Cotizaciones', icon: ScrollText, roles: ['VENDEDOR_CAMPO', 'VENDEDOR'] },
      { path: '/my-commissions', label: 'Mis Comisiones', icon: Percent, roles: ['VENDEDOR_CAMPO', 'VENDEDOR'] },
    ],
  },
  {
    label: 'OPERACIONES',
    items: [
      { path: '/pos', label: 'POS', icon: ScanLine },
      { path: '/quotes', label: 'Cotizaciones', icon: ScrollText, roles: ['ADMIN'] },
      { path: '/products', label: 'Productos', icon: Package },
      { path: '/purchases', label: 'Compras', icon: TrendingUp, roles: ['ADMIN'] },
      { path: '/sales', label: 'Ventas', icon: ShoppingCart, roles: ['ADMIN'] },
      { path: '/stock', label: 'Stock', icon: ArrowLeftRight, roles: ['ADMIN'] },
      { path: '/kardex', label: 'Kardex', icon: ClipboardList, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      { path: '/cash-register', label: 'Caja', icon: Wallet, roles: ['ADMIN'] },
      { path: '/credits', label: 'Créditos', icon: CreditCard, roles: ['ADMIN'] },
      { path: '/accounts-payable', label: 'Cuentas por Pagar', icon: FileText, roles: ['ADMIN'] },
      { path: '/invoices', label: 'Facturas', icon: Receipt, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'CATÁLOGO',
    items: [
      { path: '/clients', label: 'Clientes', icon: Users },
      { path: '/categories', label: 'Categorías', icon: FolderTree, roles: ['ADMIN'] },
      { path: '/units', label: 'Unidades de Medida', icon: Ruler, roles: ['ADMIN'] },
      { path: '/companies', label: 'Almacenes', icon: Building2, roles: ['ADMIN'] },
      { path: '/price-tiers', label: 'Rangos de Precio', icon: Layers, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'GESTIÓN',
    items: [
      { path: '/commissions-report', label: 'Reporte Comisiones', icon: Briefcase, roles: ['ADMIN'] },
      { path: '/users', label: 'Usuarios', icon: Shield, roles: ['ADMIN'] },
    ],
  },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(collapsed));
  }, [collapsed]);

  const { data: apAlerts } = useAPAlerts(3);
  const { data: expiringLotsData } = useExpiringLots(undefined, 30);
  const expiringLots: ProductLot[] = Array.isArray(expiringLotsData) ? expiringLotsData : [];

  type DayAlertGroup = { dateStr: string; count: number; total: number; isOverdue: boolean };

  const dayAlertGroups = useMemo((): DayAlertGroup[] => {
    if (!apAlerts) return [];
    const byDate: Record<string, DayAlertGroup> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 3);

    const processAP = (ap: AccountPayable, isOverdue: boolean) => {
      if (ap.paymentScheduleType === 'INSTALLMENTS') {
        (ap.installments || []).forEach((inst: any) => {
          if (inst.status !== 'PENDING') return;
          const dateStr = inst.dueDate.slice(0, 10);
          const dueDate = new Date(dateStr + 'T00:00:00');
          if (isOverdue && dueDate >= today) return;
          if (!isOverdue && dueDate > maxDate) return;
          if (!byDate[dateStr]) byDate[dateStr] = { dateStr, count: 0, total: 0, isOverdue };
          byDate[dateStr].count++;
          byDate[dateStr].total += inst.amount;
        });
      } else if (ap.dueDate) {
        const dateStr = ap.dueDate.slice(0, 10);
        const dueDate = new Date(dateStr + 'T00:00:00');
        if (isOverdue && dueDate >= today) return;
        if (!isOverdue && dueDate > maxDate) return;
        if (!byDate[dateStr]) byDate[dateStr] = { dateStr, count: 0, total: 0, isOverdue };
        byDate[dateStr].count++;
        byDate[dateStr].total += ap.pendingAmount;
      }
    };

    (apAlerts.overdue || []).forEach((ap: AccountPayable) => processAP(ap, true));
    (apAlerts.upcoming || []).forEach((ap: AccountPayable) => processAP(ap, false));

    return Object.values(byDate).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [apAlerts]);

  const expiringSummary = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expired: ProductLot[] = [];
    const within7: ProductLot[] = [];
    const within30: ProductLot[] = [];
    for (const l of expiringLots) {
      if (!l.expirationDate || l.currentQuantity <= 0) continue;
      const exp = new Date(l.expirationDate);
      const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (days < 0) expired.push(l);
      else if (days <= 7) within7.push(l);
      else if (days <= 30) within30.push(l);
    }
    return { expired, within7, within30 };
  }, [expiringLots]);

  const expiringGroupCount = (expiringSummary.expired.length > 0 ? 1 : 0)
    + (expiringSummary.within7.length > 0 ? 1 : 0)
    + (expiringSummary.within30.length > 0 ? 1 : 0);
  const alertCount = dayAlertGroups.length + expiringGroupCount;

  const formatAlertDate = (dateStr: string): string => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr + 'T00:00:00');
    const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Vencido · ${date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}`;
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    return `En ${diffDays} días · ${date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}`;
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const userInitials = (user?.fullName || user?.username || 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-surface">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-all duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:inset-auto lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="hidden lg:flex absolute -right-3 top-5 z-10 w-6 h-6 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-gray-500 hover:text-primary-600 hover:border-primary-400 transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`flex items-center h-16 border-b border-gray-100 ${collapsed ? 'lg:justify-center lg:px-0 px-5 justify-between' : 'px-5 justify-between'}`}>
          <h1 className={`text-base font-bold text-gray-800 ${collapsed ? 'lg:hidden' : ''}`}>Agrosystem</h1>
          <div className={`hidden ${collapsed ? 'lg:flex' : ''} w-9 h-9 rounded-lg bg-primary-600 text-white items-center justify-center font-bold`}>A</div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto scrollbar-thin py-4 space-y-5 ${collapsed ? 'lg:px-2 px-3' : 'px-3'}`}>
          {navSections.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.roles || item.roles.includes(user?.role || ''),
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label}>
                <div className={`px-3 mb-2 text-[11px] font-semibold tracking-wider text-gray-400 ${collapsed ? 'lg:hidden' : ''}`}>
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname.startsWith(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={collapsed ? item.label : undefined}
                        onClick={() => { if (window.innerWidth < 1024) setMobileOpen(false); }}
                        className={`flex items-center gap-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          collapsed ? 'lg:justify-center lg:px-0 px-3' : 'px-3'
                        } ${
                          isActive
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className={`flex items-center gap-3 py-2 ${collapsed ? 'lg:justify-center lg:px-0 px-2' : 'px-2'}`}>
            <div
              className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm shrink-0"
              title={collapsed ? `${user?.fullName || user?.username} — ${user?.role}` : undefined}
            >
              {userInitials}
            </div>
            <div className={`flex-1 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <div className="text-sm font-medium text-gray-800 truncate">
                {user?.fullName || user?.username}
              </div>
              <div className="text-xs text-gray-500 truncate">{user?.role}</div>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className={`text-gray-400 hover:text-red-500 transition-colors ${collapsed ? 'lg:hidden' : ''}`}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="h-16 bg-primary-600 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <span className="lg:hidden text-white text-base font-bold tracking-wide">Agrosystem</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen(!bellOpen)}
                className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white transition-colors"
              >
                <Bell size={18} />
                {alertCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-card-hover border border-gray-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Notificaciones</span>
                    {alertCount > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        {alertCount}
                      </span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {alertCount === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        Sin alertas pendientes
                      </div>
                    )}
                    {expiringSummary.expired.length > 0 && (
                      <div
                        className="px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors bg-red-50/60 hover:bg-red-100"
                        onClick={() => { setBellOpen(false); navigate('/stock?tab=lots&filter=expired'); }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-red-700 flex items-center gap-1">
                            <AlertTriangle size={12} /> Productos vencidos
                          </span>
                          <span className="text-sm font-bold text-red-600">
                            {expiringSummary.expired.length}
                          </span>
                        </div>
                        <div className="text-xs mt-0.5 text-red-500 truncate">
                          {expiringSummary.expired.slice(0, 2).map((l) => l.productName || 'Producto').join(', ')}
                          {expiringSummary.expired.length > 2 && ` y ${expiringSummary.expired.length - 2} más`}
                        </div>
                      </div>
                    )}
                    {expiringSummary.within7.length > 0 && (
                      <div
                        className="px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors bg-orange-50/60 hover:bg-orange-100"
                        onClick={() => { setBellOpen(false); navigate('/stock?tab=lots&filter=expiring'); }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-orange-700 flex items-center gap-1">
                            <CalendarClock size={12} /> Vencen en 7 días
                          </span>
                          <span className="text-sm font-bold text-orange-600">
                            {expiringSummary.within7.length}
                          </span>
                        </div>
                        <div className="text-xs mt-0.5 text-orange-500 truncate">
                          {expiringSummary.within7.slice(0, 2).map((l) => l.productName || 'Producto').join(', ')}
                          {expiringSummary.within7.length > 2 && ` y ${expiringSummary.within7.length - 2} más`}
                        </div>
                      </div>
                    )}
                    {expiringSummary.within30.length > 0 && (
                      <div
                        className="px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors bg-yellow-50/60 hover:bg-yellow-100"
                        onClick={() => { setBellOpen(false); navigate('/stock?tab=lots&filter=expiring'); }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-yellow-700 flex items-center gap-1">
                            <CalendarClock size={12} /> Vencen en 30 días
                          </span>
                          <span className="text-sm font-bold text-yellow-600">
                            {expiringSummary.within30.length}
                          </span>
                        </div>
                        <div className="text-xs mt-0.5 text-yellow-600 truncate">
                          {expiringSummary.within30.slice(0, 2).map((l) => l.productName || 'Producto').join(', ')}
                          {expiringSummary.within30.length > 2 && ` y ${expiringSummary.within30.length - 2} más`}
                        </div>
                      </div>
                    )}
                    {dayAlertGroups.map((group) => (
                      <div
                        key={group.dateStr}
                        className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors ${
                          group.isOverdue
                            ? 'bg-red-50/60 hover:bg-red-100'
                            : 'bg-amber-50/60 hover:bg-amber-100'
                        }`}
                        onClick={() => {
                          setBellOpen(false);
                          navigate(`/accounts-payable?date=${group.dateStr}`);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-semibold ${group.isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
                            {formatAlertDate(group.dateStr)}
                          </span>
                          <span className={`text-sm font-bold ${group.isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                            S/ {group.total.toFixed(2)}
                          </span>
                        </div>
                        <div className={`text-xs mt-0.5 flex items-center gap-1 ${group.isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                          {group.isOverdue ? <AlertTriangle size={10} /> : <Clock size={10} />}
                          {group.count} pago{group.count > 1 ? 's' : ''} pendiente{group.count > 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                  {alertCount > 0 && (
                    <div className="px-4 py-2 bg-gray-50 border-t">
                      <button
                        onClick={() => {
                          setBellOpen(false);
                          navigate('/accounts-payable');
                        }}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium w-full text-center"
                      >
                        Ver calendario de pagos
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 pb-20 lg:p-8 overflow-auto min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (mobile only) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 grid grid-cols-4 h-16 pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegación principal"
      >
        {(user?.role === 'VENDEDOR_CAMPO' || user?.role === 'VENDEDOR'
          ? [
              { path: '/sales', label: 'Ventas', icon: ShoppingCart },
              { path: '/quotes', label: 'Cotizar', icon: ScrollText },
            ]
          : [
              { path: '/dashboard', label: 'Inicio', icon: BarChart3 },
              { path: '/cash-register', label: 'Caja', icon: Wallet },
            ]
        ).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-primary-600' : 'text-gray-500 active:text-gray-700'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <Link
          to="/pos"
          className="relative flex flex-col items-center justify-end pb-1.5"
          aria-label="POS"
        >
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-primary-600 text-white shadow-[0_8px_24px_-4px_rgba(220,86,8,0.45)] flex items-center justify-center ring-4 ring-white">
            <ScanLine size={22} />
          </span>
          <span
            className={`text-[10px] font-semibold ${
              location.pathname.startsWith('/pos') ? 'text-primary-700' : 'text-gray-500'
            }`}
          >
            POS
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-gray-500 active:text-gray-700 transition-colors"
          aria-label="Más opciones"
        >
          <MoreHorizontal size={20} />
          <span className="text-[10px] font-medium">Más</span>
        </button>
      </nav>
    </div>
  );
}

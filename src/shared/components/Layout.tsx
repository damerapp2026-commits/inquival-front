import { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { useAPAlerts } from '../../modules/accounts-payable/hooks/useAccountsPayable';
import {
  Package, ShoppingCart, TrendingUp, Users, Building2, Layers, ArrowLeftRight,
  LogOut, Menu, X, Wallet, CreditCard, BarChart3, FolderTree, Shield,
  ClipboardList, FileText, Bell, AlertTriangle, Clock, ScanLine, Ruler, ScrollText,
} from 'lucide-react';
import type { AccountPayable } from '../types';

type NavItem = { path: string; label: string; icon: any; roles?: string[] };
type NavSection = { label: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    label: 'PRINCIPAL',
    items: [{ path: '/dashboard', label: 'Inicio', icon: BarChart3 }],
  },
  {
    label: 'OPERACIONES',
    items: [
      { path: '/pos', label: 'POS', icon: ScanLine },
      { path: '/quotes', label: 'Proformas', icon: ScrollText },
      { path: '/products', label: 'Productos', icon: Package },
      { path: '/purchases', label: 'Compras', icon: TrendingUp },
      { path: '/sales', label: 'Ventas', icon: ShoppingCart },
      { path: '/stock', label: 'Stock', icon: ArrowLeftRight },
      { path: '/kardex', label: 'Kardex', icon: ClipboardList },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      { path: '/cash-register', label: 'Caja', icon: Wallet },
      { path: '/credits', label: 'Créditos', icon: CreditCard },
      { path: '/accounts-payable', label: 'Cuentas por Pagar', icon: FileText },
    ],
  },
  {
    label: 'CATÁLOGO',
    items: [
      { path: '/clients', label: 'Clientes', icon: Users },
      { path: '/categories', label: 'Categorías', icon: FolderTree },
      { path: '/units', label: 'Unidades de Medida', icon: Ruler },
      { path: '/companies', label: 'Empresas', icon: Building2 },
      { path: '/price-tiers', label: 'Rangos de Precio', icon: Layers },
    ],
  },
  {
    label: 'CONFIGURACIÓN',
    items: [{ path: '/users', label: 'Usuarios', icon: Shield, roles: ['ADMIN'] }],
  },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const { data: apAlerts } = useAPAlerts(3);
  const overdueCount = apAlerts?.overdue?.length || 0;
  const upcomingCount = apAlerts?.upcoming?.length || 0;
  const alertCount = overdueCount + upcomingCount;

  const getNextDueDate = (ap: AccountPayable) => {
    if (ap.paymentScheduleType === 'INSTALLMENTS' && ap.installments?.length) {
      const next = ap.installments.find((i: any) => i.status === 'PENDING');
      if (next) return new Date(next.dueDate).toLocaleDateString('es-PE');
    }
    return ap.dueDate ? new Date(ap.dueDate).toLocaleDateString('es-PE') : '-';
  };

  const getNextPendingAmount = (ap: AccountPayable) => {
    if (ap.paymentScheduleType === 'INSTALLMENTS' && ap.installments?.length) {
      const next = ap.installments.find((i: any) => i.status === 'PENDING');
      if (next) return next.amount;
    }
    return ap.pendingAmount;
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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100">
          <h1 className="text-base font-bold text-gray-800">Agrosystem</h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navSections.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.roles || item.roles.includes(user?.role || ''),
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label}>
                <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-gray-400">
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
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Icon size={18} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">
                {user?.fullName || user?.username}
              </div>
              <div className="text-xs text-gray-500 truncate">{user?.role}</div>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="h-16 bg-primary-600 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/80 hover:text-white">
              <Menu size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors border border-white/20 rounded-full px-4 py-1.5 cursor-default">
              <span className="w-2 h-2 rounded-full bg-green-300 shadow-[0_0_6px_2px_rgba(134,239,172,0.6)]"></span>
              <span className="text-white text-sm font-semibold tracking-wide">Sucursal Principal</span>
            </div>

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
                  <div className="max-h-72 overflow-y-auto">
                    {alertCount === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        Sin alertas pendientes
                      </div>
                    )}
                    {overdueCount > 0 && (
                      <>
                        <div className="px-4 py-2 bg-red-50 text-xs font-medium text-red-700 flex items-center gap-1">
                          <AlertTriangle size={12} /> Pagos vencidos ({overdueCount})
                        </div>
                        {apAlerts!.overdue.slice(0, 5).map((ap: AccountPayable) => (
                          <div
                            key={ap.id}
                            className="px-4 py-2 border-b border-gray-100 bg-red-50/50 hover:bg-red-100 cursor-pointer"
                            onClick={() => {
                              setBellOpen(false);
                              navigate('/accounts-payable');
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-800">{ap.supplier}</span>
                              <span className="text-sm font-bold text-red-600">
                                S/ {getNextPendingAmount(ap).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-red-500">Vencido: {getNextDueDate(ap)}</div>
                          </div>
                        ))}
                      </>
                    )}
                    {upcomingCount > 0 && (
                      <>
                        <div className="px-4 py-2 bg-yellow-50 text-xs font-medium text-yellow-700 flex items-center gap-1">
                          <Clock size={12} /> Próximos a vencer ({upcomingCount})
                        </div>
                        {apAlerts!.upcoming.slice(0, 5).map((ap: AccountPayable) => (
                          <div
                            key={ap.id}
                            className="px-4 py-2 border-b border-gray-100 hover:bg-yellow-50 cursor-pointer"
                            onClick={() => {
                              setBellOpen(false);
                              navigate('/accounts-payable');
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-800">{ap.supplier}</span>
                              <span className="text-sm font-bold text-yellow-600">
                                S/ {getNextPendingAmount(ap).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-yellow-600">Vence: {getNextDueDate(ap)}</div>
                          </div>
                        ))}
                      </>
                    )}
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
                        Ver todas las cuentas por pagar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

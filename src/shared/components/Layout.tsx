import React, { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { useAPAlerts } from '../../modules/accounts-payable/hooks/useAccountsPayable';
import { Package, ShoppingCart, TrendingUp, Users, Building2, Layers, ArrowLeftRight, LogOut, Menu, X, Wallet, CreditCard, BarChart3, FolderTree, Shield, ClipboardList, FileText, Bell, AlertTriangle, Clock } from 'lucide-react';
import type { AccountPayable } from '../types';

const navItems: { path: string; label: string; icon: any; roles?: string[] }[] = [
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/products', label: 'Productos', icon: Package },
  { path: '/purchases', label: 'Compras', icon: TrendingUp },
  { path: '/sales', label: 'Ventas', icon: ShoppingCart },
  { path: '/stock', label: 'Stock', icon: ArrowLeftRight },
  { path: '/kardex', label: 'Kardex', icon: ClipboardList },
  { path: '/cash-register', label: 'Caja', icon: Wallet },
  { path: '/credits', label: 'Creditos', icon: CreditCard },
  { path: '/accounts-payable', label: 'Cuentas por Pagar', icon: FileText },
  { path: '/clients', label: 'Clientes', icon: Users },
  { path: '/categories', label: 'Categorías', icon: FolderTree },
  { path: '/companies', label: 'Empresas', icon: Building2 },
  { path: '/price-tiers', label: 'Rangos de Precio', icon: Layers },
  { path: '/users', label: 'Usuarios', icon: Shield, roles: ['ADMIN'] },
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

  return (
    <div className="min-h-screen flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-primary-800 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-4 bg-primary-900">
          <h1 className="text-lg font-bold">Sistema Ventas</h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X size={20} /></button>
        </div>
        <nav className="mt-4 space-y-1 px-2">
          {navItems.filter((item) => !item.roles || item.roles.includes(user?.role || '')).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary-700 text-white' : 'text-primary-100 hover:bg-primary-700/50'}`}>
                <Icon size={18} />{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-primary-700">
          <div className="text-sm text-primary-200 mb-2">{user?.fullName}</div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-primary-200 hover:text-white"><LogOut size={16} />Cerrar sesion</button>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4"><Menu size={20} /></button>
            <div className="text-sm text-gray-500">Rol: <span className="font-medium text-gray-700">{user?.role}</span></div>
          </div>
          {/* Bell notifications */}
          <div className="relative" ref={bellRef}>
            <button onClick={() => setBellOpen(!bellOpen)} className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors">
              <Bell size={20} />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border z-50 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Notificaciones</span>
                  {alertCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{alertCount}</span>}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {alertCount === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">Sin alertas pendientes</div>
                  )}
                  {overdueCount > 0 && (
                    <>
                      <div className="px-4 py-2 bg-red-50 text-xs font-medium text-red-700 flex items-center gap-1">
                        <AlertTriangle size={12} /> Pagos vencidos ({overdueCount})
                      </div>
                      {apAlerts!.overdue.slice(0, 5).map((ap: AccountPayable) => (
                        <div key={ap.id} className="px-4 py-2 border-b border-gray-100 bg-red-50/50 hover:bg-red-100 cursor-pointer" onClick={() => { setBellOpen(false); navigate('/accounts-payable'); }}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800">{ap.supplier}</span>
                            <span className="text-sm font-bold text-red-600">S/ {getNextPendingAmount(ap).toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-red-500">Vencido: {getNextDueDate(ap)}</div>
                        </div>
                      ))}
                    </>
                  )}
                  {upcomingCount > 0 && (
                    <>
                      <div className="px-4 py-2 bg-yellow-50 text-xs font-medium text-yellow-700 flex items-center gap-1">
                        <Clock size={12} /> Proximos a vencer ({upcomingCount})
                      </div>
                      {apAlerts!.upcoming.slice(0, 5).map((ap: AccountPayable) => (
                        <div key={ap.id} className="px-4 py-2 border-b border-gray-100 hover:bg-yellow-50 cursor-pointer" onClick={() => { setBellOpen(false); navigate('/accounts-payable'); }}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800">{ap.supplier}</span>
                            <span className="text-sm font-bold text-yellow-600">S/ {getNextPendingAmount(ap).toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-yellow-600">Vence: {getNextDueDate(ap)}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {alertCount > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-t">
                    <button onClick={() => { setBellOpen(false); navigate('/accounts-payable'); }} className="text-xs text-green-600 hover:text-green-800 font-medium w-full text-center">
                      Ver todas las cuentas por pagar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}

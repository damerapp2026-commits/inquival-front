import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { Package, ShoppingCart, TrendingUp, Users, Building2, Layers, ArrowLeftRight, LogOut, Menu, X } from 'lucide-react';

const navItems = [
  { path: '/products', label: 'Productos', icon: Package },
  { path: '/purchases', label: 'Compras', icon: TrendingUp },
  { path: '/sales', label: 'Ventas', icon: ShoppingCart },
  { path: '/stock', label: 'Stock', icon: ArrowLeftRight },
  { path: '/clients', label: 'Clientes', icon: Users },
  { path: '/companies', label: 'Empresas', icon: Building2 },
  { path: '/price-tiers', label: 'Rangos de Precio', icon: Layers },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-green-800 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-4 bg-green-900">
          <h1 className="text-lg font-bold">Fertilizantes</h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X size={20} /></button>
        </div>
        <nav className="mt-4 space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-green-700 text-white' : 'text-green-100 hover:bg-green-700/50'}`}>
                <Icon size={18} />{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-green-700">
          <div className="text-sm text-green-200 mb-2">{user?.fullName}</div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-green-200 hover:text-white"><LogOut size={16} />Cerrar sesión</button>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b flex items-center px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4"><Menu size={20} /></button>
          <div className="text-sm text-gray-500">Rol: <span className="font-medium text-gray-700">{user?.role}</span></div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}

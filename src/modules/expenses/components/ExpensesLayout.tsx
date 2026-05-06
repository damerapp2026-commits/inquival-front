import { NavLink, Outlet } from 'react-router-dom';
import { Receipt, Wallet, Users as UsersIcon, BarChart3 } from 'lucide-react';

const tabs = [
  { to: '/expenses/cash',      label: 'Gastos de Caja',      icon: Wallet },
  { to: '/expenses/workers',   label: 'Viáticos',            icon: UsersIcon },
  { to: '/expenses/analytics', label: 'Analítica',           icon: BarChart3 },
];

export function ExpensesLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
          <Receipt size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Egresos de caja, viáticos y analítica de salidas</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-rose-300 hover:text-rose-700'
              }`
            }
          >
            <Icon size={15} /> {label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}

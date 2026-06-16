import { useState } from 'react';
import { Building2, Shield, Receipt } from 'lucide-react';
import { CompanyInfoForm } from '../components/CompanyInfoForm';
import { FiscalEntitySettings } from '../components/FiscalEntitySettings';
import { UsersPage } from '../../users/pages/UsersPage';

type Tab = 'company' | 'fiscal' | 'users';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'company', label: 'Información de la empresa', icon: Building2 },
  { id: 'fiscal', label: 'Entidades fiscales', icon: Receipt },
  { id: 'users', label: 'Usuarios', icon: Shield },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Ajustes de la empresa y administración de usuarios.</p>
      </div>

      <div className="border-b border-gray-200 mb-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'company' && <CompanyInfoForm />}
      {tab === 'fiscal' && <FiscalEntitySettings />}
      {tab === 'users' && <UsersPage />}
    </div>
  );
}

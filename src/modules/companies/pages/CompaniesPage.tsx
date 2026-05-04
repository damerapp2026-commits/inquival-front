import React, { useMemo, useState } from 'react';
import { useCompanies, useCreateCompany, useUpdateCompany, useDeleteCompany } from '../hooks/useCompanies';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Plus, Edit2, Trash2, Warehouse, Search, CheckCircle2, XCircle, Building2, AlertTriangle } from 'lucide-react';
import type { Company } from '../../../shared/types';

type StatusFilter = 'all' | 'active' | 'inactive';

export function CompaniesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: companies, isLoading } = useCompanies();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  const [form, setForm] = useState({ name: '', address: '', phone: '' });

  const openCreate = () => { setEditing(null); setForm({ name: '', address: '', phone: '' }); setShowModal(true); };
  const openEdit = (company: Company) => { setEditing(company); setForm({ name: company.name, address: company.address || '', phone: company.phone || '' }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateCompany.mutateAsync({ id: editing.id, data: form });
    else await createCompany.mutateAsync(form);
    setShowModal(false);
  };

  const list: Company[] = Array.isArray(companies) ? companies : [];

  const stats = useMemo(() => ({
    total: list.length,
    active: list.filter((c) => c.isActive).length,
    inactive: list.filter((c) => !c.isActive).length,
  }), [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      if (statusFilter === 'active' && !c.isActive) return false;
      if (statusFilter === 'inactive' && c.isActive) return false;
      if (!q) return true;
      return [c.name, c.address, c.phone].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [list, search, statusFilter]);

  const columns = [
    { key: 'name', header: 'Nombre', render: (item: Company) => <span className="font-medium text-gray-800">{item.name}</span> },
    { key: 'address', header: 'Dirección', render: (item: Company) => item.address || <span className="text-gray-300">—</span> },
    { key: 'phone', header: 'Teléfono', render: (item: Company) => item.phone || <span className="text-gray-300">—</span> },
    {
      key: 'isActive', header: 'Estado',
      render: (item: Company) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.isActive ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-primary-500' : 'bg-red-500'}`} />
          {item.isActive ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions', header: 'Acciones',
      render: (item: Company) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(item)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="Editar"><Edit2 size={15} /></button>
          <button onClick={() => setDeleteTarget(item)} className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Eliminar"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
              <Warehouse size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Almacenes</h1>
              <p className="text-sm text-gray-500 mt-0.5">Administra los almacenes y puntos de venta del negocio</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium shadow-sm transition-colors">
            <Plus size={18} /> Nuevo Almacén
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiMini icon={Building2} label="Total" value={stats.total} accent="bg-primary-100 text-primary-700" />
        <KpiMini icon={CheckCircle2} label="Activos" value={stats.active} accent="bg-emerald-100 text-emerald-700" />
        <KpiMini icon={XCircle} label="Inactivos" value={stats.inactive} accent="bg-red-100 text-red-600" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, dirección o teléfono..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { value: 'all', label: 'Todos' },
            { value: 'active', label: 'Activos' },
            { value: 'inactive', label: 'Inactivos' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === opt.value ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} />

      {/* Create/Edit modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar almacén' : 'Nuevo almacén'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre <span className="text-red-500 normal-case">*</span></label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ej: 1er Piso, Cochera, QUIVEN..." required autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dirección <span className="text-gray-400 normal-case font-normal">— opcional</span></label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Av. Tal #123, referencia..." />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Teléfono <span className="text-gray-400 normal-case font-normal">— opcional</span></label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button type="submit" disabled={editing ? updateCompany.isPending : createCompany.isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-semibold shadow-sm">{editing ? (updateCompany.isPending ? 'Actualizando...' : 'Guardar cambios') : (createCompany.isPending ? 'Creando...' : 'Crear')}</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar almacén">
        <div className="space-y-4">
          <div className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-red-700">
              Esta acción es <strong>permanente</strong>. Se eliminará el almacén <strong>{deleteTarget?.name}</strong>. Si tiene productos, stock o movimientos asociados, el sistema podría rechazar la operación.
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button
              disabled={deleteCompany.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteCompany.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                } catch { /* toast handled */ }
              }}
              className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold shadow-sm"
            >
              {deleteCompany.isPending ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function KpiMini({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent: string }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5 flex items-center gap-4 hover:shadow-card-hover transition-shadow">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold text-gray-800 leading-tight">{value}</div>
      </div>
    </div>
  );
}

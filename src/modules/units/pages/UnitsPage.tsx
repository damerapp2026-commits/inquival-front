import React, { useMemo, useState } from 'react';
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit } from '../hooks/useUnits';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Plus, Edit2, Trash2, Ruler, Search, CheckCircle2, XCircle, AlertTriangle, Scale } from 'lucide-react';

interface Unit { id: string; name: string; abbreviation?: string; isActive: boolean; }

type StatusFilter = 'all' | 'active' | 'inactive';

export function UnitsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [form, setForm] = useState({ name: '', abbreviation: '', isActive: true });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: units, isLoading } = useUnits();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', abbreviation: '', isActive: true });
    setShowModal(true);
  };
  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setForm({ name: unit.name, abbreviation: unit.abbreviation || '', isActive: unit.isActive });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateUnit.mutateAsync({ id: editing.id, data: form });
    else await createUnit.mutateAsync({ name: form.name, abbreviation: form.abbreviation || undefined });
    setShowModal(false);
  };

  const list: Unit[] = Array.isArray(units) ? units : [];

  const stats = useMemo(() => ({
    total: list.length,
    active: list.filter((u) => u.isActive).length,
    inactive: list.filter((u) => !u.isActive).length,
  }), [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((u) => {
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (!q) return true;
      return [u.name, u.abbreviation].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [list, search, statusFilter]);

  const columns = [
    { key: 'name', header: 'Nombre', render: (item: Unit) => <span className="font-medium text-gray-800">{item.name}</span> },
    {
      key: 'abbreviation', header: 'Abreviatura',
      render: (item: Unit) => item.abbreviation
        ? <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono">{item.abbreviation}</span>
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'isActive', header: 'Estado',
      render: (item: Unit) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.isActive ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-primary-500' : 'bg-red-500'}`} />
          {item.isActive ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions', header: 'Acciones',
      render: (item: Unit) => (
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
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
              <Ruler size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Unidades de Medida</h1>
              <p className="text-sm text-gray-500 mt-0.5">Define las unidades en las que se venden y compran tus productos</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium shadow-sm transition-colors">
            <Plus size={18} /> Nueva Unidad
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiMini icon={Scale} label="Total" value={stats.total} accent="bg-blue-100 text-blue-700" />
        <KpiMini icon={CheckCircle2} label="Activas" value={stats.active} accent="bg-emerald-100 text-emerald-700" />
        <KpiMini icon={XCircle} label="Inactivas" value={stats.inactive} accent="bg-red-100 text-red-600" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o abreviatura..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { value: 'all', label: 'Todas' },
            { value: 'active', label: 'Activas' },
            { value: 'inactive', label: 'Inactivas' },
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
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar unidad' : 'Nueva unidad de medida'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre <span className="text-red-500 normal-case">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Kilogramo, Litro, Saco..."
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Abreviatura <span className="text-gray-400 normal-case font-normal">— opcional</span></label>
            <input
              value={form.abbreviation}
              onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
              placeholder="Ej: kg, L, sac..."
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {editing && (
            <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-gray-50 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Unidad activa</span>
            </label>
          )}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button type="submit" disabled={editing ? updateUnit.isPending : createUnit.isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-semibold shadow-sm">
              {editing ? (updateUnit.isPending ? 'Actualizando...' : 'Guardar cambios') : (createUnit.isPending ? 'Creando...' : 'Crear')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar unidad">
        <div className="space-y-4">
          <div className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-red-700">
              Esta acción es <strong>permanente</strong>. Se eliminará la unidad <strong>{deleteTarget?.name}</strong>. Si está siendo usada por productos existentes, el sistema podría rechazar la operación.
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button
              disabled={deleteUnit.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteUnit.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                } catch { /* toast handled */ }
              }}
              className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold shadow-sm"
            >
              {deleteUnit.isPending ? 'Eliminando...' : 'Eliminar'}
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

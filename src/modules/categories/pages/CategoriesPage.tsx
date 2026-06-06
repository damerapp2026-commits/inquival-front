import React, { useMemo, useState } from 'react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks/useCategories';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Plus, Edit2, Trash2, PowerOff, FolderTree, Search, CheckCircle2, XCircle, AlertTriangle, Tag } from 'lucide-react';
import type { Category } from '../../../shared/types';

type StatusFilter = 'all' | 'active' | 'inactive';

export function CategoriesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [form, setForm] = useState({ name: '', description: '', isActive: true });

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', isActive: true }); setShowModal(true); };
  const openEdit = (category: Category) => { setEditing(category); setForm({ name: category.name, description: category.description || '', isActive: category.isActive }); setShowModal(true); };

  const handleDeactivate = async (item: Category) => {
    setDeactivatingId(item.id);
    try {
      await updateCategory.mutateAsync({ id: item.id, data: { isActive: false } });
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateCategory.mutateAsync({ id: editing.id, data: form });
    else await createCategory.mutateAsync({ name: form.name, description: form.description });
    setShowModal(false);
  };

  const list: Category[] = Array.isArray(categories) ? categories : [];

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
      return [c.name, c.description].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [list, search, statusFilter]);

  const columns = [
    { key: 'name', header: 'Nombre', render: (item: Category) => <span className="font-medium text-gray-800">{item.name}</span> },
    {
      key: 'description', header: 'Descripción',
      render: (item: Category) => item.description
        ? <span className="text-gray-600">{item.description}</span>
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'isActive', header: 'Estado',
      render: (item: Category) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.isActive ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-primary-500' : 'bg-red-500'}`} />
          {item.isActive ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions', header: 'Acciones',
      render: (item: Category) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(item)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="Editar"><Edit2 size={15} /></button>
          {item.isActive ? (
            <button
              onClick={() => handleDeactivate(item)}
              disabled={deactivatingId === item.id}
              className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-40"
              title="Desactivar"
            >
              <PowerOff size={15} />
            </button>
          ) : (
            <button
              onClick={() => setDeleteTarget(item)}
              className="p-2 rounded-lg text-red-600 hover:bg-red-50"
              title="Eliminar definitivamente"
            >
              <Trash2 size={15} />
            </button>
          )}
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
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
              <FolderTree size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
              <p className="text-sm text-gray-500 mt-0.5">Organiza tus productos por familia o tipo de uso</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium shadow-sm transition-colors">
            <Plus size={18} /> Nueva Categoría
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiMini icon={Tag} label="Total" value={stats.total} accent="bg-purple-100 text-purple-700" />
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
            placeholder="Buscar por nombre o descripción..."
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
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar categoría' : 'Nueva categoría'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre <span className="text-red-500 normal-case">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Antibióticos, Vitaminas..."
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Descripción <span className="text-gray-400 normal-case font-normal">— opcional</span></label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalle breve de la categoría..."
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
              <span className="text-sm font-medium text-gray-700">Categoría activa</span>
            </label>
          )}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button type="submit" disabled={editing ? updateCategory.isPending : createCategory.isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-semibold shadow-sm">
              {editing ? (updateCategory.isPending ? 'Actualizando...' : 'Guardar cambios') : (createCategory.isPending ? 'Creando...' : 'Crear')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar categoría definitivamente">
        <div className="space-y-4">
          <div className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-red-700">
              Esta acción es <strong>irreversible</strong>. La categoría <strong>{deleteTarget?.name}</strong> se eliminará permanentemente de la base de datos.
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button
              disabled={deleteCategory.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteCategory.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                } catch { /* toast handled */ }
              }}
              className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold shadow-sm"
            >
              {deleteCategory.isPending ? 'Eliminando...' : 'Eliminar'}
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

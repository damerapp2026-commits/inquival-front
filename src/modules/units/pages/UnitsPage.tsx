import React, { useState } from 'react';
import { useUnits, useCreateUnit, useUpdateUnit } from '../hooks/useUnits';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Plus, Edit2, Ruler } from 'lucide-react';

interface Unit { id: string; name: string; abbreviation?: string; isActive: boolean; }

export function UnitsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [form, setForm] = useState({ name: '', abbreviation: '', isActive: true });

  const { data: units, isLoading } = useUnits();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();

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

  const columns = [
    { key: 'name', header: 'Nombre' },
    { key: 'abbreviation', header: 'Abreviatura', render: (item: Unit) => item.abbreviation || <span className="text-gray-400">—</span> },
    {
      key: 'isActive', header: 'Estado',
      render: (item: Unit) => (
        <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-primary-100 text-primary-800' : 'bg-red-100 text-red-800'}`}>
          {item.isActive ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions', header: 'Acciones',
      render: (item: Unit) => (
        <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Ruler size={24} /> Unidades de Medida</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus size={18} /> Nueva Unidad
        </button>
      </div>

      <DataTable columns={columns} data={list} isLoading={isLoading} />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Unidad' : 'Nueva Unidad de Medida'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Kilogramo, Litro, Saco..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Abreviatura</label>
            <input
              value={form.abbreviation}
              onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
              placeholder="Ej: kg, L, sac..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Activo</label>
            </div>
          )}
          <button type="submit" disabled={editing ? updateUnit.isPending : createUnit.isPending} className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {editing ? (updateUnit.isPending ? 'Actualizando...' : 'Actualizar') : (createUnit.isPending ? 'Creando...' : 'Crear')}
          </button>
        </form>
      </Modal>
    </div>
  );
}

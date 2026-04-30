import React, { useState } from 'react';
import { useLaboratories, useCreateLaboratory, useUpdateLaboratory } from '../hooks/useLaboratories';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Plus, Edit2, FlaskConical } from 'lucide-react';
import type { Laboratory } from '../../../shared/types';

export function LaboratoriesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Laboratory | null>(null);
  const [search, setSearch] = useState('');

  const { data: laboratories, isLoading } = useLaboratories();
  const createLaboratory = useCreateLaboratory();
  const updateLaboratory = useUpdateLaboratory();

  const [form, setForm] = useState({ name: '', description: '', isActive: true });

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', isActive: true }); setShowModal(true); };
  const openEdit = (lab: Laboratory) => { setEditing(lab); setForm({ name: lab.name, description: lab.description || '', isActive: lab.isActive }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await updateLaboratory.mutateAsync({ id: editing.id, data: form });
      else await createLaboratory.mutateAsync({ name: form.name.trim(), description: form.description });
      setShowModal(false);
    } catch { /* toast manejado en hook */ }
  };

  const list: Laboratory[] = Array.isArray(laboratories) ? laboratories : [];
  const filtered = list.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { key: 'name', header: 'Nombre', render: (item: Laboratory) => <span className="font-medium text-gray-800">{item.name}</span> },
    { key: 'description', header: 'Descripción', render: (item: Laboratory) => item.description || <span className="text-gray-300">—</span> },
    { key: 'isActive', header: 'Estado', render: (item: Laboratory) => <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-primary-100 text-primary-800' : 'bg-red-100 text-red-800'}`}>{item.isActive ? 'Activo' : 'Inactivo'}</span> },
    { key: 'actions', header: 'Acciones', render: (item: Laboratory) => (
      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800" title="Editar"><Edit2 size={16} /></button>
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FlaskConical size={24} /> Laboratorios</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={18} /> Nuevo Laboratorio</button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar laboratorio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-md px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar laboratorio' : 'Nuevo laboratorio'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre <span className="text-red-500 normal-case">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Ej: FARMEX, BAYER, SYNGENTA..."
              required
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">No se permiten duplicados (FARMEX = Farmex = farmex).</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Descripción <span className="text-gray-400 normal-case font-normal">— opcional</span></label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Notas o información adicional"
            />
          </div>
          {editing && (
            <label htmlFor="isActive" className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Laboratorio activo</span>
            </label>
          )}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button
              type="submit"
              disabled={editing ? updateLaboratory.isPending : createLaboratory.isPending}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-semibold shadow-sm"
            >
              {editing ? (updateLaboratory.isPending ? 'Actualizando...' : 'Guardar cambios') : (createLaboratory.isPending ? 'Creando...' : 'Crear')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

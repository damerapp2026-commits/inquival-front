import React, { useState } from 'react';
import { usePriceTiers, useCreatePriceTier, useUpdatePriceTier } from '../hooks/usePriceTiers';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Plus, Edit2, Tag } from 'lucide-react';
import type { PriceTier } from '../../../shared/types';

export function PriceTiersPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PriceTier | null>(null);

  const { data: tiers, isLoading } = usePriceTiers(false);
  const createTier = useCreatePriceTier();
  const updateTier = useUpdatePriceTier();

  const [form, setForm] = useState({ name: '', description: '', priority: 0, isActive: true });

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', priority: 0, isActive: true }); setShowModal(true); };
  const openEdit = (tier: PriceTier) => { setEditing(tier); setForm({ name: tier.name, description: tier.description || '', priority: tier.priority, isActive: tier.isActive }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateTier.mutateAsync({ id: editing.id, data: form });
    else { const { isActive, ...createData } = form; await createTier.mutateAsync(createData); }
    setShowModal(false);
  };

  const list = Array.isArray(tiers) ? tiers : [];

  const columns = [
    { key: 'name', header: 'Nombre' },
    { key: 'description', header: 'Descripción' },
    { key: 'priority', header: 'Prioridad' },
    { key: 'isActive', header: 'Estado', render: (item: PriceTier) => <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-primary-100 text-primary-800' : 'bg-red-100 text-red-800'}`}>{item.isActive ? 'Activo' : 'Inactivo'}</span> },
    { key: 'actions', header: 'Acciones', render: (item: PriceTier) => (
      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Tag size={24} /> Rangos de Precio</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={18} /> Nuevo Rango</button>
      </div>
      <DataTable columns={columns} data={list} isLoading={isLoading} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Rango' : 'Nuevo Rango'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label><input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" /><label className="text-sm font-medium text-gray-700">Activo</label></div>
          <button type="submit" className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editing ? 'Actualizar' : 'Crear'}</button>
        </form>
      </Modal>
    </div>
  );
}

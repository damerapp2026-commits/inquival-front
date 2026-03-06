import React, { useState } from 'react';
import { useCategories, useCreateCategory, useUpdateCategory } from '../hooks/useCategories';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Plus, Edit2, FolderTree } from 'lucide-react';
import type { Category } from '../../../shared/types';

export function CategoriesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [form, setForm] = useState({ name: '', description: '', isActive: true });

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', isActive: true }); setShowModal(true); };
  const openEdit = (category: Category) => { setEditing(category); setForm({ name: category.name, description: category.description || '', isActive: category.isActive }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateCategory.mutateAsync({ id: editing.id, data: form });
    else await createCategory.mutateAsync({ name: form.name, description: form.description });
    setShowModal(false);
  };

  const list = Array.isArray(categories) ? categories : [];

  const columns = [
    { key: 'name', header: 'Nombre' },
    { key: 'description', header: 'Descripción' },
    { key: 'isActive', header: 'Estado', render: (item: Category) => <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.isActive ? 'Activo' : 'Inactivo'}</span> },
    { key: 'actions', header: 'Acciones', render: (item: Category) => (
      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FolderTree size={24} /> Categorías</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><Plus size={18} /> Nueva Categoría</button>
      </div>
      <DataTable columns={columns} data={list} isLoading={isLoading} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Categoría' : 'Nueva Categoría'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          {editing && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Activo</label>
            </div>
          )}
          <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">{editing ? 'Actualizar' : 'Crear'}</button>
        </form>
      </Modal>
    </div>
  );
}

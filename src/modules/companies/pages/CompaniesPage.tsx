import React, { useState } from 'react';
import { useCompanies, useCreateCompany, useUpdateCompany } from '../hooks/useCompanies';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Plus, Edit2, Warehouse } from 'lucide-react';
import type { Company } from '../../../shared/types';

export function CompaniesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);

  const { data: companies, isLoading } = useCompanies();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();

  const [form, setForm] = useState({ name: '', address: '', phone: '' });

  const openCreate = () => { setEditing(null); setForm({ name: '', address: '', phone: '' }); setShowModal(true); };
  const openEdit = (company: Company) => { setEditing(company); setForm({ name: company.name, address: company.address || '', phone: company.phone || '' }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateCompany.mutateAsync({ id: editing.id, data: form });
    else await createCompany.mutateAsync(form);
    setShowModal(false);
  };

  const list = Array.isArray(companies) ? companies : [];

  const columns = [
    { key: 'name', header: 'Nombre', render: (item: Company) => <span className="font-medium text-gray-800">{item.name}</span> },
    { key: 'address', header: 'Dirección', render: (item: Company) => item.address || <span className="text-gray-300">—</span> },
    { key: 'phone', header: 'Teléfono', render: (item: Company) => item.phone || <span className="text-gray-300">—</span> },
    { key: 'isActive', header: 'Estado', render: (item: Company) => <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-primary-100 text-primary-800' : 'bg-red-100 text-red-800'}`}>{item.isActive ? 'Activo' : 'Inactivo'}</span> },
    { key: 'actions', header: 'Acciones', render: (item: Company) => (
      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800" title="Editar"><Edit2 size={16} /></button>
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Warehouse size={24} /> Almacenes</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={18} /> Nuevo Almacén</button>
      </div>
      <DataTable columns={columns} data={list} isLoading={isLoading} />
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
    </div>
  );
}

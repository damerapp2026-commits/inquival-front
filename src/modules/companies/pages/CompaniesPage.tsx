import React, { useState } from 'react';
import { useCompanies, useCreateCompany, useUpdateCompany } from '../hooks/useCompanies';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Plus, Edit2, Building2 } from 'lucide-react';
import type { Company } from '../../../shared/types';

export function CompaniesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);

  const { data: companies, isLoading } = useCompanies();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();

  const [form, setForm] = useState({ name: '', ruc: '', address: '', phone: '' });

  const openCreate = () => { setEditing(null); setForm({ name: '', ruc: '', address: '', phone: '' }); setShowModal(true); };
  const openEdit = (company: Company) => { setEditing(company); setForm({ name: company.name, ruc: company.ruc, address: company.address || '', phone: company.phone || '' }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) { const { ruc, ...updateData } = form; await updateCompany.mutateAsync({ id: editing.id, data: updateData }); }
    else await createCompany.mutateAsync(form);
    setShowModal(false);
  };

  const list = Array.isArray(companies) ? companies : [];

  const columns = [
    { key: 'name', header: 'Nombre' },
    { key: 'ruc', header: 'RUC' },
    { key: 'address', header: 'Dirección' },
    { key: 'phone', header: 'Teléfono' },
    { key: 'isActive', header: 'Estado', render: (item: Company) => <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-primary-100 text-primary-800' : 'bg-red-100 text-red-800'}`}>{item.isActive ? 'Activo' : 'Inactivo'}</span> },
    { key: 'actions', header: 'Acciones', render: (item: Company) => (
      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Building2 size={24} /> Empresas</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={18} /> Nueva Empresa</button>
      </div>
      <DataTable columns={columns} data={list} isLoading={isLoading} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Empresa' : 'Nueva Empresa'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">RUC (11 dígitos)</label><input value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} className="w-full px-3 py-2 border rounded-lg" maxLength={11} pattern="\d{11}" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          <button type="submit" className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editing ? 'Actualizar' : 'Crear'}</button>
        </form>
      </Modal>
    </div>
  );
}

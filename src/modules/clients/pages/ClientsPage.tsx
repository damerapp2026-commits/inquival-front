import React, { useState } from 'react';
import { useClients, useCreateClient, useUpdateClient } from '../hooks/useClients';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { Plus, Search, Edit2, Users } from 'lucide-react';
import type { Client } from '../../../shared/types';

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const { data, isLoading } = useClients({ page, limit: 20, search: debouncedSearch });
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [form, setForm] = useState({ name: '', documentNumber: '', phone: '', email: '', address: '' });

  const openCreate = () => { setEditing(null); setForm({ name: '', documentNumber: '', phone: '', email: '', address: '' }); setShowModal(true); };
  const openEdit = (client: Client) => { setEditing(client); setForm({ name: client.name, documentNumber: client.documentNumber || '', phone: client.phone || '', email: client.email || '', address: client.address || '' }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanForm = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
    if (editing) await updateClient.mutateAsync({ id: editing.id, data: cleanForm });
    else await createClient.mutateAsync(cleanForm);
    setShowModal(false);
  };

  const clients = data?.data || [];
  const total = data?.total || 0;

  const columns = [
    { key: 'name', header: 'Nombre' },
    { key: 'documentNumber', header: 'DNI/RUC' },
    { key: 'phone', header: 'Teléfono' },
    { key: 'email', header: 'Email' },
    { key: 'isActive', header: 'Estado', render: (item: Client) => <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.isActive ? 'Activo' : 'Inactivo'}</span> },
    { key: 'actions', header: 'Acciones', render: (item: Client) => (
      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Users size={24} /> Clientes</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><Plus size={18} /> Nuevo Cliente</button>
      </div>
      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Buscar clientes..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
      </div>
      <DataTable columns={columns} data={clients} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Cliente' : 'Nuevo Cliente'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">DNI/RUC</label><input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">{editing ? 'Actualizar' : 'Crear'}</button>
        </form>
      </Modal>
    </div>
  );
}

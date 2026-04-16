import React, { useState } from 'react';
import { useClients, useCreateClient, useUpdateClient } from '../hooks/useClients';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useDniLookup, useRucLookup } from '../../../shared/hooks/useLookup';
import { Plus, Search, Edit2, Users, Loader2 } from 'lucide-react';
import type { Client } from '../../../shared/types';
import { clientService } from '../services/clientService';
import toast from 'react-hot-toast';

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const { data, isLoading } = useClients({ page, limit: 20, search: debouncedSearch });
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const dniLookup = useDniLookup();
  const rucLookup = useRucLookup();

  const [docType, setDocType] = useState<'DNI' | 'RUC'>('DNI');
  const [form, setForm] = useState({ name: '', documentNumber: '', phone: '', email: '', address: '' });
  const [lookupLoading, setLookupLoading] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDocType('DNI');
    setForm({ name: '', documentNumber: '', phone: '', email: '', address: '' });
    setShowModal(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    const dn = client.documentNumber || '';
    setDocType(dn.length === 11 ? 'RUC' : 'DNI');
    setForm({ name: client.name, documentNumber: dn, phone: client.phone || '', email: client.email || '', address: client.address || '' });
    setShowModal(true);
  };

  const handleLookup = async () => {
    const numero = form.documentNumber.trim();
    if (docType === 'DNI' && numero.length !== 8) { toast.error('El DNI debe tener 8 dígitos'); return; }
    if (docType === 'RUC' && numero.length !== 11) { toast.error('El RUC debe tener 11 dígitos'); return; }

    setLookupLoading(true);
    try {
      // First check local DB
      const allClients = await clientService.getAll({ search: numero, limit: 1 });
      const localMatch = (allClients?.data || allClients || []).find?.((c: Client) => c.documentNumber === numero);
      if (localMatch) {
        setForm({ name: localMatch.name, documentNumber: localMatch.documentNumber || '', phone: localMatch.phone || '', email: localMatch.email || '', address: localMatch.address || '' });
        toast.success('Cliente encontrado en el sistema');
        setLookupLoading(false);
        return;
      }

      // Then try Decolecta
      if (docType === 'DNI') {
        const result = await dniLookup.mutateAsync(numero);
        const fullName = `${result.apellidoPaterno} ${result.apellidoMaterno}, ${result.nombre}`;
        setForm(prev => ({ ...prev, name: fullName }));
        toast.success('Datos encontrados en RENIEC');
      } else {
        const result = await rucLookup.mutateAsync(numero);
        setForm(prev => ({ ...prev, name: result.razonSocial, address: result.direccion || prev.address }));
        toast.success('Datos encontrados en SUNAT');
      }
    } catch {
      // Error already handled by hook toast
    } finally {
      setLookupLoading(false);
    }
  };

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
    { key: 'isActive', header: 'Estado', render: (item: Client) => <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-primary-100 text-primary-800' : 'bg-red-100 text-red-800'}`}>{item.isActive ? 'Activo' : 'Inactivo'}</span> },
    { key: 'actions', header: 'Acciones', render: (item: Client) => (
      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
    )},
  ];

  const isValidDoc = docType === 'DNI' ? form.documentNumber.length === 8 : form.documentNumber.length === 11;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Users size={24} /> Clientes</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={18} /> Nuevo Cliente</button>
      </div>
      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Buscar clientes..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
      </div>
      <DataTable columns={columns} data={clients} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Cliente' : 'Nuevo Cliente'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Document type selector + number + search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => { setDocType('DNI'); setForm(prev => ({ ...prev, documentNumber: '' })); }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium border-2 transition ${docType === 'DNI' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                DNI
              </button>
              <button type="button" onClick={() => { setDocType('RUC'); setForm(prev => ({ ...prev, documentNumber: '' })); }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium border-2 transition ${docType === 'RUC' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                RUC
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={form.documentNumber}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setForm({ ...form, documentNumber: v.slice(0, docType === 'DNI' ? 8 : 11) }); }}
                className="flex-1 px-3 py-2 border rounded-lg"
                placeholder={docType === 'DNI' ? '8 dígitos' : '11 dígitos'}
                maxLength={docType === 'DNI' ? 8 : 11}
              />
              <button
                type="button"
                onClick={handleLookup}
                disabled={!isValidDoc || lookupLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Buscar
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          <button type="submit" disabled={editing ? updateClient.isPending : createClient.isPending} className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">{editing ? (updateClient.isPending ? 'Actualizando...' : 'Actualizar') : (createClient.isPending ? 'Creando...' : 'Crear')}</button>
        </form>
      </Modal>
    </div>
  );
}

import React, { useState } from 'react';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '../hooks/useClients';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useDniLookup, useRucLookup } from '../../../shared/hooks/useLookup';
import { Plus, Search, Edit2, Trash2, Users, Loader2, AlertTriangle, UserCheck, UserX, Contact, MapPin } from 'lucide-react';
import type { Client } from '../../../shared/types';
import { clientService } from '../services/clientService';
import { ExportClientStatementButton } from '../../credits/components/ExportClientStatementButton';
import { PERU_DEPARTMENTS } from '../constants/peruRegions';
import toast from 'react-hot-toast';

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const { data, isLoading } = useClients({ page, limit: 20, search: debouncedSearch });
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const dniLookup = useDniLookup();
  const rucLookup = useRucLookup();

  const [docType, setDocType] = useState<'DNI' | 'RUC'>('DNI');
  const [form, setForm] = useState({ name: '', documentNumber: '', phone: '', email: '', address: '', department: '', city: '' });
  const [lookupLoading, setLookupLoading] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDocType('DNI');
    setForm({ name: '', documentNumber: '', phone: '', email: '', address: '', department: '', city: '' });
    setShowModal(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    const dn = client.documentNumber || '';
    setDocType(dn.length === 11 ? 'RUC' : 'DNI');
    setForm({
      name: client.name,
      documentNumber: dn,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      department: client.department || '',
      city: client.city || '',
    });
    setShowModal(true);
  };

  const openDelete = (client: Client) => {
    setDeleteTarget(client);
    setConfirmText('');
  };

  const handleLookup = async () => {
    const numero = form.documentNumber.trim();
    if (docType === 'DNI' && numero.length !== 8) { toast.error('El DNI debe tener 8 dígitos'); return; }
    if (docType === 'RUC' && numero.length !== 11) { toast.error('El RUC debe tener 11 dígitos'); return; }

    setLookupLoading(true);
    try {
      const allClients = await clientService.getAll({ search: numero, limit: 1 });
      const localMatch = (allClients?.data || allClients || []).find?.((c: Client) => c.documentNumber === numero);
      if (localMatch) {
        setForm({
          name: localMatch.name,
          documentNumber: localMatch.documentNumber || '',
          phone: localMatch.phone || '',
          email: localMatch.email || '',
          address: localMatch.address || '',
          department: localMatch.department || '',
          city: localMatch.city || '',
        });
        toast.success('Cliente encontrado en el sistema');
        setLookupLoading(false);
        return;
      }

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

  const clients: Client[] = data?.data || [];
  const total = data?.total || 0;
  const activeCount = clients.filter((c) => c.isActive).length;
  const inactiveCount = clients.filter((c) => !c.isActive).length;

  const columns = [
    { key: 'name', header: 'Nombre', render: (item: Client) => <span className="font-medium text-gray-800">{item.name}</span> },
    {
      key: 'documentNumber', header: 'DNI/RUC',
      render: (item: Client) => item.documentNumber
        ? <span className="font-mono text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{item.documentNumber}</span>
        : <span className="text-gray-300">—</span>,
    },
    { key: 'phone', header: 'Teléfono', render: (item: Client) => item.phone || <span className="text-gray-300">—</span> },
    {
      key: 'zone', header: 'Zona',
      render: (item: Client) => {
        if (!item.city && !item.department) return <span className="text-gray-300">—</span>;
        return (
          <div className="flex items-center gap-1.5 text-sm text-gray-700">
            <MapPin size={13} className="text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              {item.city && <div className="font-medium truncate">{item.city}</div>}
              {item.department && <div className="text-xs text-gray-500 truncate">{item.department}</div>}
            </div>
          </div>
        );
      },
    },
    { key: 'email', header: 'Email', render: (item: Client) => item.email || <span className="text-gray-300">—</span> },
    {
      key: 'isActive', header: 'Estado',
      render: (item: Client) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.isActive ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-primary-500' : 'bg-red-500'}`} />
          {item.isActive ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions', header: 'Acciones',
      render: (item: Client) => (
        <div className="flex items-center gap-1">
          <ExportClientStatementButton client={item} variant="icon" />
          <button onClick={() => openEdit(item)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="Editar"><Edit2 size={15} /></button>
          <button onClick={() => openDelete(item)} className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Eliminar"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  const isValidDoc = docType === 'DNI' ? form.documentNumber.length === 8 : form.documentNumber.length === 11;
  const confirmRequired = deleteTarget?.documentNumber || deleteTarget?.name || '';
  const canConfirmDelete = confirmText.trim() === confirmRequired.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
              <p className="text-sm text-gray-500 mt-0.5">Gestiona la base de clientes con consulta automática a RENIEC y SUNAT</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium shadow-sm transition-colors">
            <Plus size={18} /> Nuevo Cliente
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiMini icon={Contact} label="Total" value={total} accent="bg-primary-100 text-primary-700" />
        <KpiMini icon={UserCheck} label="Activos (página)" value={activeCount} accent="bg-emerald-100 text-emerald-700" />
        <KpiMini icon={UserX} label="Inactivos (página)" value={inactiveCount} accent="bg-red-100 text-red-600" />
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, DNI/RUC, teléfono o email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <DataTable columns={columns} data={clients} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      {/* Create/Edit modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar cliente' : 'Nuevo cliente'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tipo de documento</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => { setDocType('DNI'); setForm(prev => ({ ...prev, documentNumber: '' })); }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition ${docType === 'DNI' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                DNI
              </button>
              <button type="button" onClick={() => { setDocType('RUC'); setForm(prev => ({ ...prev, documentNumber: '' })); }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition ${docType === 'RUC' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                RUC
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={form.documentNumber}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setForm({ ...form, documentNumber: v.slice(0, docType === 'DNI' ? 8 : 11) }); }}
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={docType === 'DNI' ? '8 dígitos' : '11 dígitos'}
                maxLength={docType === 'DNI' ? 8 : 11}
              />
              <button
                type="button"
                onClick={handleLookup}
                disabled={!isValidDoc || lookupLoading}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-medium shadow-sm"
              >
                {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Buscar
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre <span className="text-red-500 normal-case">*</span></label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dirección</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <MapPin size={13} className="text-primary-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Zona</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Departamento</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— Sin asignar —</option>
                  {PERU_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Ciudad / Distrito</label>
                <input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Otuzco, Trujillo..."
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button type="submit" disabled={editing ? updateClient.isPending : createClient.isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-semibold shadow-sm">
              {editing ? (updateClient.isPending ? 'Actualizando...' : 'Guardar cambios') : (createClient.isPending ? 'Creando...' : 'Crear')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation with type-to-confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar cliente">
        <div className="space-y-4">
          <div className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-red-700">
              Esta acción es <strong>permanente</strong>. Se eliminará a <strong>{deleteTarget?.name}</strong>
              {deleteTarget?.documentNumber && <> ({deleteTarget.documentNumber})</>}. Si tiene ventas, créditos o cotizaciones registradas, el sistema podría rechazar la operación.
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Para confirmar, escribe: <span className="text-red-600 normal-case font-mono">{confirmRequired}</span>
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Escribe aquí para confirmar"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
            <button
              disabled={!canConfirmDelete || deleteClient.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteClient.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                  setConfirmText('');
                } catch { /* toast handled */ }
              }}
              className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm"
            >
              {deleteClient.isPending ? 'Eliminando...' : 'Eliminar'}
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

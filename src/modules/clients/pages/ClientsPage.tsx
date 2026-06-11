import React, { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '../hooks/useClients';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useDniLookup, useRucLookup } from '../../../shared/hooks/useLookup';
import { Plus, Search, Edit2, Trash2, Users, Loader2, AlertTriangle, UserCheck, UserX, Contact, MapPin, CreditCard, ChevronDown } from 'lucide-react';
import type { Client } from '../../../shared/types';
import { clientService } from '../services/clientService';
import { ExportClientStatementButton } from '../../credits/components/ExportClientStatementButton';
import { CreditsPage } from '../../credits/pages/CreditsPage';
import { LocationFields } from '../components/LocationFields';
import { ClientHistoryPanel } from '../components/ClientHistoryPanel';
import { FixedScrollbar } from '../../../shared/components/FixedScrollbar';
import { useAuth } from '../../../app/providers/AuthProvider';
import toast from 'react-hot-toast';

export function ClientsPage() {
  const { user } = useAuth();
  const isSellerRole = user?.role === 'VENDEDOR' || user?.role === 'VENDEDOR_CAMPO';
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'creditos' ? 'creditos' : 'datos';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
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

  const tableWrapRef = useRef<HTMLDivElement>(null);

  const [docType, setDocType] = useState<'DNI' | 'RUC'>('DNI');
  const [form, setForm] = useState({ name: '', documentNumber: '', phone: '', email: '', address: '', department: '', province: '', district: '', hamlet: '', creditLimit: '', creditLimitCurrency: 'PEN' as 'PEN' | 'USD' });
  const [lookupLoading, setLookupLoading] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDocType('DNI');
    setForm({ name: '', documentNumber: '', phone: '', email: '', address: '', department: '', province: '', district: '', hamlet: '', creditLimit: '', creditLimitCurrency: 'PEN' });
    setShowModal(true);
  };

  const openEdit = (client: Client) => {
    if (isSellerRole) return;
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
      province: client.province || '',
      district: client.district || client.city || '',
      hamlet: client.hamlet || '',
      creditLimit: typeof client.creditLimit === 'number' ? String(client.creditLimit) : '',
      creditLimitCurrency: client.creditLimitCurrency || 'PEN',
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
          province: localMatch.province || '',
          district: localMatch.district || localMatch.city || '',
          hamlet: localMatch.hamlet || '',
          creditLimit: typeof localMatch.creditLimit === 'number' ? String(localMatch.creditLimit) : '',
          creditLimitCurrency: localMatch.creditLimitCurrency || 'PEN',
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
    if (!isValidDoc) {
      toast.error(docType === 'DNI' ? 'El DNI debe tener 8 dígitos' : 'El RUC debe tener 11 dígitos');
      return;
    }
    if (!form.department || !form.province || !form.district) {
      toast.error('Selecciona departamento, provincia y distrito');
      return;
    }
    const cleanForm: Record<string, any> = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
    if (cleanForm.creditLimit !== undefined) {
      const parsed = Number(cleanForm.creditLimit);
      if (Number.isFinite(parsed) && parsed >= 0) cleanForm.creditLimit = parsed;
      else delete cleanForm.creditLimit;
    }
    cleanForm.creditLimitCurrency = form.creditLimitCurrency;
    if (cleanForm.district) cleanForm.city = cleanForm.district;
    if (editing) await updateClient.mutateAsync({ id: editing.id, data: cleanForm });
    else await createClient.mutateAsync(cleanForm);
    setShowModal(false);
  };

  const clients: Client[] = data?.data || [];
  const total = data?.total || 0;
  const activeCount = clients.filter((c) => c.isActive).length;
  const inactiveCount = clients.filter((c) => !c.isActive).length;

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
          {activeTab === 'datos' && (
            <button onClick={openCreate} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium shadow-sm transition-colors">
              <Plus size={18} /> Nuevo Cliente
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-gray-100">
          <button
            onClick={() => setSearchParams({})}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'datos'
                ? 'text-primary-600 border-b-2 border-primary-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5"><Users size={14} /> Datos</span>
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'creditos' })}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'creditos'
                ? 'text-primary-600 border-b-2 border-primary-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5"><CreditCard size={14} /> Créditos</span>
          </button>
        </div>
      </div>

      {activeTab === 'creditos' && <CreditsPage asTab />}

      {activeTab === 'datos' && <>
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
            onChange={(e) => { setSearch(e.target.value); setPage(1); setExpandedClientId(null); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Clients table with expandable history rows */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-card p-4 animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
        </div>
      ) : (
        <div ref={tableWrapRef} className="overflow-x-auto bg-white rounded-xl shadow-card">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-3 w-8 bg-gray-50/60" />
                {['Nombre', 'DNI/RUC', 'Teléfono', 'Límite crédito', 'Zona', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 sm:px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/60">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-400">No hay datos disponibles</td></tr>
              ) : clients.map(client => {
                const isExpanded = expandedClientId === client.id;
                const primary = client.district || client.city;
                const secondary = [client.province, client.department].filter(Boolean).join(' · ');
                return (
                  <React.Fragment key={client.id}>
                    <tr className={`transition-colors hover:bg-gray-50/60 ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-3 py-3.5 text-center">
                        <button
                          onClick={() => setExpandedClientId(prev => prev === client.id ? null : client.id!)}
                          className="p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
                          title={isExpanded ? 'Cerrar historial' : 'Ver historial de ventas'}
                        >
                          <ChevronDown size={15} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm">
                        <span className="font-medium text-gray-800">{client.name}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm">
                        {client.documentNumber
                          ? <span className="font-mono text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{client.documentNumber}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">
                        {client.phone || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm">
                        {typeof client.creditLimit === 'number' && client.creditLimit > 0 ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border tabular-nums ${client.creditLimitCurrency === 'USD' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                            <CreditCard size={12} /> {client.creditLimitCurrency === 'USD' ? '$' : 'S/'} {client.creditLimit.toFixed(2)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-sm">
                        {!primary && !secondary && !client.hamlet ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              {primary && <div className="font-medium truncate">{primary}</div>}
                              {client.hamlet && <div className="text-xs text-gray-600 truncate">Caserío: {client.hamlet}</div>}
                              {secondary && <div className="text-xs text-gray-500 truncate">{secondary}</div>}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${client.isActive ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${client.isActive ? 'bg-primary-500' : 'bg-red-500'}`} />
                          {client.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-1">
                          <ExportClientStatementButton client={client} variant="icon" />
                          {!isSellerRole && (
                            <>
                              <button onClick={() => openEdit(client)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="Editar"><Edit2 size={15} /></button>
                              <button onClick={() => openDelete(client)} className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Eliminar"><Trash2 size={15} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-0 border-b border-indigo-100">
                          <ClientHistoryPanel clientId={client.id!} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <FixedScrollbar targetRef={tableWrapRef} deps={[isLoading, clients]} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={(p) => { setPage(p); setExpandedClientId(null); }} />

      {/* Create/Edit modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar cliente' : 'Nuevo cliente'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tipo de documento <span className="text-red-500 normal-case">*</span></label>
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
                minLength={docType === 'DNI' ? 8 : 11}
                maxLength={docType === 'DNI' ? 8 : 11}
                required
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Teléfono <span className="text-red-500 normal-case">*</span></label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required />
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
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <CreditCard size={13} className="text-primary-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Límite de crédito <span className="text-red-500 normal-case">*</span></span>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                <button type="button" onClick={() => setForm(prev => ({ ...prev, creditLimitCurrency: 'PEN' }))}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${form.creditLimitCurrency === 'PEN' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  S/ Soles
                </button>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, creditLimitCurrency: 'USD' }))}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${form.creditLimitCurrency === 'USD' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  $ Dólares
                </button>
              </div>
            </div>
            <div className="relative">
              <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold ${form.creditLimitCurrency === 'USD' ? 'text-emerald-600' : 'text-blue-600'}`}>
                {form.creditLimitCurrency === 'USD' ? '$' : 'S/'}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0.00"
                required
              />
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400">
              Las nuevas ventas a crédito que excedan este monto serán rechazadas. Usa 0 si el cliente no debe tener crédito.
            </p>
          </div>

          <LocationFields
            required
            value={{
              department: form.department || undefined,
              province: form.province || undefined,
              district: form.district || undefined,
              hamlet: form.hamlet || undefined,
            }}
            onChange={(loc) =>
              setForm({
                ...form,
                department: loc.department || '',
                province: loc.province || '',
                district: loc.district || '',
                hamlet: loc.hamlet || '',
              })
            }
          />

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
              {deleteTarget?.documentNumber && <> ({deleteTarget.documentNumber})</>}. Si el cliente tiene <strong>deudas pendientes</strong> el sistema rechazará la operación. Sus cuentas a crédito ya pagadas se eliminarán en cascada; las ventas y cotizaciones quedan registradas como "Sin cliente".
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
      </>}
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

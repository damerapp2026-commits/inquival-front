import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../app/providers/AuthProvider';
import { useBranch } from '../../app/providers/BranchProvider';
import { api, getPendingWriteCount, subscribePendingWrites } from '../services/api';
import { Modal } from './Modal';

export function BranchSelector() {
  const { user } = useAuth();
  const { branches, currentBranch, selectBranch, refreshBranches } = useBranch();
  const writes = useSyncExternalStore(subscribePendingWrites, getPendingWriteCount);
  const mutations = useIsMutating();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const busy = !!(writes || mutations || saving || switching);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api.post('/branches', form);
      await refreshBranches();
      setShowCreate(false);
      setForm({ name: '', address: '', phone: '' });
      toast.success('Sucursal creada. Ya puedes seleccionarla.');
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'No se pudo crear la sucursal';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally { setSaving(false); }
  };

  if (user?.role !== 'ADMIN') return <span className="text-white text-sm truncate max-w-40" title="Sucursal asignada">{currentBranch?.name}</span>;
  return <>
    <div className="flex items-center gap-2 text-white">
      <Building2 size={18} className="hidden sm:block shrink-0" />
      <div>
        <label htmlFor="active-branch" className="block text-[10px] text-white/80 leading-tight">Sucursal</label>
        <select id="active-branch" aria-label="Sucursal activa" value={currentBranch?.id || ''}
          disabled={busy} title={busy ? 'Espera a que termine la operación en curso' : 'Cambiar de sucursal'}
          onChange={async event => {
            setSwitching(true);
            try { await selectBranch(event.target.value); }
            catch (error: any) { toast.error(error.message); setSwitching(false); }
          }}
          className="max-w-36 sm:max-w-56 bg-white/15 border border-white/30 rounded-lg px-2 py-1.5 text-sm text-white disabled:opacity-60">
          {branches.map(branch => <option key={branch.id} value={branch.id} className="text-gray-800 bg-white">{branch.name}</option>)}
        </select>
      </div>
      <button type="button" aria-label="Crear sucursal" title="Crear sucursal" disabled={busy}
        onClick={() => setShowCreate(true)} className="p-2 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-60">
        <Plus size={18} />
      </button>
    </div>
    <Modal isOpen={showCreate} onClose={() => { if (!saving) setShowCreate(false); }} title="Nueva sucursal">
      <form onSubmit={create} className="space-y-4">
        <p className="text-sm text-gray-500">Tendrá su propio almacén, clientes, productos y caja. Empezará sin ventas, compras ni saldos.</p>
        <div><label htmlFor="branch-name" className="block text-sm font-medium mb-1">Nombre de la sucursal</label>
          <input id="branch-name" autoFocus required minLength={2} maxLength={80} value={form.name}
            onChange={event => setForm({ ...form, name: event.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
        <div><label htmlFor="branch-address" className="block text-sm font-medium mb-1">Dirección</label>
          <input id="branch-address" maxLength={250} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
        <div><label htmlFor="branch-phone" className="block text-sm font-medium mb-1">Teléfono</label>
          <input id="branch-phone" type="tel" maxLength={40} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
        <button type="submit" disabled={saving || form.name.trim().length < 2} className="w-full py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Creando sucursal…' : 'Crear sucursal'}</button>
      </form>
    </Modal>
  </>;
}

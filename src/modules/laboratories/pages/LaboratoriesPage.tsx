import React, { useState } from 'react';
import { useLaboratories, useCreateLaboratory, useUpdateLaboratory, useDeleteLaboratory } from '../hooks/useLaboratories';
import { useRucLookup } from '../../../shared/hooks/useLookup';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Plus, Edit2, Trash2, FlaskConical, Search, Loader2 } from 'lucide-react';
import type { Laboratory } from '../../../shared/types';
import toast from 'react-hot-toast';

export function LaboratoriesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Laboratory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Laboratory | null>(null);
  const [search, setSearch] = useState('');

  const { data: laboratories, isLoading } = useLaboratories();
  const createLaboratory = useCreateLaboratory();
  const updateLaboratory = useUpdateLaboratory();
  const deleteLaboratory = useDeleteLaboratory();
  const rucLookup = useRucLookup();

  const emptyForm = { name: '', description: '', ruc: '', address: '', phone: '', email: '', isActive: true };
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (lab: Laboratory) => {
    setEditing(lab);
    setForm({
      name: lab.name,
      description: lab.description || '',
      ruc: lab.ruc || '',
      address: lab.address || '',
      phone: lab.phone || '',
      email: lab.email || '',
      isActive: lab.isActive,
    });
    setShowModal(true);
  };

  const handleSunatLookup = async () => {
    const ruc = form.ruc.trim();
    if (ruc.length !== 11) { toast.error('El RUC debe tener 11 dígitos'); return; }
    try {
      const result = await rucLookup.mutateAsync(ruc);
      if (result.razonSocial) {
        setForm(prev => ({
          ...prev,
          name: prev.name.trim() ? prev.name : result.razonSocial,
          address: prev.address.trim() ? prev.address : (result.direccion || ''),
        }));
        toast.success('Datos cargados desde SUNAT');
      }
    } catch { /* toast manejado por el hook */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      ruc: form.ruc.trim() || undefined,
      address: form.address.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
    };
    if (payload.ruc && !/^\d{11}$/.test(payload.ruc)) { toast.error('El RUC debe tener 11 dígitos'); return; }
    try {
      if (editing) await updateLaboratory.mutateAsync({ id: editing.id, data: { ...payload, isActive: form.isActive } });
      else await createLaboratory.mutateAsync(payload);
      setShowModal(false);
    } catch { /* toast manejado en hook */ }
  };

  const list: Laboratory[] = Array.isArray(laboratories) ? laboratories : [];
  const filtered = list.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) || (l.ruc || '').includes(q);
  });

  const columns = [
    { key: 'name', header: 'Nombre', render: (item: Laboratory) => <span className="font-medium text-gray-800">{item.name}</span> },
    { key: 'ruc', header: 'RUC', render: (item: Laboratory) => item.ruc || <span className="text-gray-300">—</span> },
    { key: 'description', header: 'Descripción', render: (item: Laboratory) => item.description || <span className="text-gray-300">—</span> },
    { key: 'isActive', header: 'Estado', render: (item: Laboratory) => <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-primary-100 text-primary-800' : 'bg-red-100 text-red-800'}`}>{item.isActive ? 'Activo' : 'Inactivo'}</span> },
    { key: 'actions', header: 'Acciones', render: (item: Laboratory) => (
      <div className="flex items-center gap-3">
        <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800" title="Editar"><Edit2 size={16} /></button>
        <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:text-red-700" title="Eliminar"><Trash2 size={16} /></button>
      </div>
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
          placeholder="Buscar por nombre o RUC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-md px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar laboratorio">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            ¿Estás seguro de que deseas eliminar el laboratorio{' '}
            <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={deleteLaboratory.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteLaboratory.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                } catch { /* toast handled in hook */ }
              }}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold shadow-sm"
            >
              {deleteLaboratory.isPending ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar laboratorio' : 'Nuevo laboratorio'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">RUC <span className="text-gray-400 normal-case font-normal">— opcional pero recomendado</span></label>
            <div className="flex gap-2">
              <input
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="11 dígitos"
                maxLength={11}
              />
              <button
                type="button"
                onClick={handleSunatLookup}
                disabled={form.ruc.length !== 11 || rucLookup.isPending}
                className="px-3 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 text-sm font-semibold"
                title="Buscar en SUNAT y autocompletar"
              >
                {rucLookup.isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                SUNAT
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Si el RUC existe en SUNAT, se autocompletan razón social y dirección.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre / Razón social <span className="text-red-500 normal-case">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Ej: FARMEX, BAYER, SYNGENTA..."
              required
            />
            <p className="text-xs text-gray-400 mt-1">No se permiten duplicados (FARMEX = Farmex = farmex).</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Teléfono <span className="text-gray-400 normal-case font-normal">— opcional</span></label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="999 888 777"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Email <span className="text-gray-400 normal-case font-normal">— opcional</span></label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="ventas@laboratorio.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dirección <span className="text-gray-400 normal-case font-normal">— opcional</span></label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Av. ..."
            />
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

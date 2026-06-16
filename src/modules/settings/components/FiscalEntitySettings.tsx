import { useState } from 'react';
import { Building2, Plus, Save, Star, StarOff, Pencil, X } from 'lucide-react';
import { useFiscalEntities, useCreateFiscalEntity, useUpdateFiscalEntity } from '../../fiscal-entities/hooks/useFiscalEntities';
import type { FiscalEntity } from '../../../shared/types';

interface EntityForm {
  legalName: string;
  ruc: string;
  address: string;
  isDefault: boolean;
  isActive: boolean;
}

const blankForm = (): EntityForm => ({ legalName: '', ruc: '', address: '', isDefault: false, isActive: true });
const entityToForm = (e: FiscalEntity): EntityForm => ({
  legalName: e.legalName,
  ruc: e.ruc,
  address: e.address || '',
  isDefault: e.isDefault,
  isActive: e.isActive,
});

function EntityRow({ entity, onEdit }: { entity: FiscalEntity; onEdit: (e: FiscalEntity) => void }) {
  const updateMutation = useUpdateFiscalEntity();

  const toggleDefault = () => {
    if (entity.isDefault) return;
    updateMutation.mutate({ id: entity.id, payload: { isDefault: true } });
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${entity.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
      <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center shrink-0 mt-0.5">
        <Building2 size={16} className="text-primary-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-800 truncate">{entity.legalName}</span>
          {entity.isDefault && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              <Star size={10} /> Por defecto
            </span>
          )}
          {!entity.isActive && (
            <span className="text-[11px] font-medium bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Inactiva</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">RUC {entity.ruc}</p>
        {entity.address && <p className="text-xs text-gray-400 mt-0.5 truncate">{entity.address}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!entity.isDefault && (
          <button
            type="button"
            onClick={toggleDefault}
            disabled={updateMutation.isPending}
            title="Establecer como predeterminada"
            className="p-1.5 text-gray-400 hover:text-amber-500 rounded transition-colors"
          >
            <StarOff size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(entity)}
          className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors"
        >
          <Pencil size={15} />
        </button>
      </div>
    </div>
  );
}

export function FiscalEntitySettings() {
  const { data: entities = [], isLoading } = useFiscalEntities();
  const createMutation = useCreateFiscalEntity();
  const updateMutation = useUpdateFiscalEntity();

  const [editing, setEditing] = useState<FiscalEntity | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<EntityForm>(blankForm());

  const openAdd = () => {
    setEditing(null);
    setForm(blankForm());
    setAdding(true);
  };

  const openEdit = (entity: FiscalEntity) => {
    setAdding(false);
    setEditing(entity);
    setForm(entityToForm(entity));
  };

  const closeForm = () => {
    setAdding(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.legalName.trim()) return;
    if (!form.ruc.trim()) return;
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload: form });
    } else {
      await createMutation.mutateAsync(form);
    }
    closeForm();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Entidades fiscales</h2>
          <p className="text-xs text-gray-500 mt-0.5">Empresas que figuran como receptor en las facturas de compra.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Cargando…</p>}

      {!isLoading && entities.length === 0 && !adding && (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
          No hay entidades fiscales. Agrega la primera con el botón de arriba.
        </p>
      )}

      <div className="space-y-2">
        {entities.map((e) => (
          <EntityRow key={e.id} entity={e} onEdit={openEdit} />
        ))}
      </div>

      {(adding || editing) && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              {editing ? 'Editar entidad fiscal' : 'Nueva entidad fiscal'}
            </h3>
            <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Razón social</label>
              <input
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                placeholder="Nombre legal de la empresa"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">RUC</label>
              <input
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                placeholder="20XXXXXXXXX"
                maxLength={11}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dirección (opcional)</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Dirección fiscal"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="w-4 h-4 accent-primary-600"
                />
                <span className="text-xs text-gray-600">Establecer como predeterminada</span>
              </label>
              {editing && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-xs text-gray-600">Activa</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={closeForm}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !form.legalName.trim() || !form.ruc.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Save size={13} /> {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Building2, Plus, Save, Star, StarOff, Pencil, Trash2, X } from 'lucide-react';
import { useFiscalEntities, useCreateFiscalEntity, useUpdateFiscalEntity } from '../../fiscal-entities/hooks/useFiscalEntities';
import type { FiscalEntity } from '../../../shared/types';
import type { BankAccount } from '../../../config/companyInfo';

interface EntityForm {
  legalName: string;
  ruc: string;
  address: string;
  bankAccounts: BankAccount[];
  isDefault: boolean;
  isActive: boolean;
}

const blankForm = (): EntityForm => ({ legalName: '', ruc: '', address: '', bankAccounts: [], isDefault: false, isActive: true });
const entityToForm = (e: FiscalEntity): EntityForm => ({
  legalName: e.legalName,
  ruc: e.ruc,
  address: e.address || '',
  bankAccounts: (e.bankAccounts || []).map(account => ({ ...account })),
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
        {!!entity.bankAccounts?.length && <p className="text-xs text-gray-500 mt-1">{entity.bankAccounts.length} cuenta{entity.bankAccounts.length === 1 ? '' : 's'} bancaria{entity.bankAccounts.length === 1 ? '' : 's'}</p>}
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
          aria-label={`Editar ${entity.legalName}`}
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

  const invalidBanks = form.bankAccounts.some(account => !account.bank.trim() || !account.accountNumber.trim() || !account.holder.trim());
  const updateBank = (index: number, patch: Partial<BankAccount>) => {
    setForm(previous => ({ ...previous, bankAccounts: previous.bankAccounts.map((account, i) => i === index ? { ...account, ...patch } : account) }));
  };

  const handleSave = () => {
    if (!form.legalName.trim()) return;
    if (!form.ruc.trim()) return;
    if (invalidBanks) return;
    const payload = {
      legalName: form.legalName.trim(), ruc: form.ruc.trim(), address: form.address.trim(), isDefault: form.isDefault,
      bankAccounts: form.bankAccounts.map(account => ({
        bank: account.bank.trim(), currency: account.currency, accountNumber: account.accountNumber.trim(),
        cci: account.cci?.trim() || undefined, holder: account.holder.trim(),
      })),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: { ...payload, isActive: form.isActive } }, { onSuccess: closeForm });
    } else {
      createMutation.mutate(payload, { onSuccess: closeForm });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Entidades fiscales</h2>
          <p className="text-xs text-gray-500 mt-0.5">Empresas para compras y cotizaciones, con sus propias cuentas bancarias.</p>
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

          <section aria-label="Cuentas bancarias de la empresa" className="mt-5 border-t border-gray-200 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="text-sm font-semibold text-gray-700">Cuentas bancarias</h4>
              <button type="button" onClick={() => setForm(previous => ({ ...previous, bankAccounts: [...previous.bankAccounts, { bank: '', currency: 'PEN', accountNumber: '', cci: '', holder: previous.legalName }] }))}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
                <Plus size={14} /> Agregar cuenta
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Se mostrarán en las cotizaciones de esta empresa.</p>
            {!form.bankAccounts.length && <p className="text-sm text-gray-400">Esta empresa no tiene cuentas registradas.</p>}
            <div className="space-y-3">
              {form.bankAccounts.map((account, index) => (
                <fieldset key={index} className="rounded-lg border border-gray-200 bg-white p-3">
                  <legend className="sr-only">Cuenta bancaria {index + 1}</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-medium text-gray-600">Banco *
                      <input aria-label={`Banco de la cuenta ${index + 1}`} value={account.bank} onChange={event => updateBank(index, { bank: event.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </label>
                    <label className="text-xs font-medium text-gray-600">Moneda
                      <select aria-label={`Moneda de la cuenta ${index + 1}`} value={account.currency} onChange={event => updateBank(index, { currency: event.target.value as 'PEN' | 'USD' })}
                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                        <option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-gray-600">N° de cuenta *
                      <input aria-label={`Número de la cuenta ${index + 1}`} type="text" value={account.accountNumber} onChange={event => updateBank(index, { accountNumber: event.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
                    </label>
                    <label className="text-xs font-medium text-gray-600">CCI (opcional)
                      <input aria-label={`CCI de la cuenta ${index + 1}`} type="text" value={account.cci || ''} onChange={event => updateBank(index, { cci: event.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
                    </label>
                    <label className="text-xs font-medium text-gray-600 sm:col-span-2">Titular *
                      <input aria-label={`Titular de la cuenta ${index + 1}`} value={account.holder} onChange={event => updateBank(index, { holder: event.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </label>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button type="button" aria-label={`Quitar cuenta bancaria ${index + 1}`} onClick={() => setForm(previous => ({ ...previous, bankAccounts: previous.bankAccounts.filter((_account, i) => i !== index) }))}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"><Trash2 size={13} /> Quitar cuenta</button>
                  </div>
                </fieldset>
              ))}
            </div>
            {invalidBanks && <p className="mt-2 text-xs text-amber-700">Completa el banco, número y titular de cada cuenta.</p>}
          </section>

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
              disabled={isPending || !form.legalName.trim() || !form.ruc.trim() || invalidBanks}
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

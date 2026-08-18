import { useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useBusinessSettings, useUpdateBusinessSettings } from '../hooks/useBusinessSettings';
import type { CompanyInfo, BankAccount, WalletInfo, DetraccionAccountInfo } from '../../../config/companyInfo';

const EMPTY_BANK: BankAccount = { bank: '', currency: 'PEN', accountNumber: '', cci: '', holder: '' };

type FormState = {
  legalName: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  salesEmail: string;
  website: string;
  logoUrl: string;
  bankAccounts: BankAccount[];
  detraccionAccount: DetraccionAccountInfo;
  yape: WalletInfo;
  plin: WalletInfo;
};

const blankForm = (): FormState => ({
  legalName: '',
  ruc: '',
  address: '',
  phone: '',
  email: '',
  salesEmail: 'clientesquiven@outlook.es',
  website: '',
  logoUrl: '',
  bankAccounts: [],
  detraccionAccount: { bank: 'Banco de la Nación', accountNumber: '00771130054' },
  yape: { number: '', holder: '' },
  plin: { number: '', holder: '' },
});

export function CompanyInfoForm() {
  const { data, isLoading } = useBusinessSettings();
  const update = useUpdateBusinessSettings();
  const [form, setForm] = useState<FormState>(blankForm);

  useEffect(() => {
    if (!data) return;
    setForm({
      legalName: data.legalName || '',
      ruc: data.ruc || '',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      salesEmail: data.salesEmail || 'clientesquiven@outlook.es',
      website: data.website || '',
      logoUrl: data.logoUrl || '',
      bankAccounts: data.bankAccounts || [],
      detraccionAccount: data.detraccionAccount ?? { bank: 'Banco de la Nación', accountNumber: '00771130054' },
      yape: data.yape ?? { number: '', holder: '' },
      plin: data.plin ?? { number: '', holder: '' },
    });
  }, [data]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const updateBank = (idx: number, patch: Partial<BankAccount>) => {
    setForm((p) => ({
      ...p,
      bankAccounts: p.bankAccounts.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }));
  };

  const addBank = () => setForm((p) => ({ ...p, bankAccounts: [...p.bankAccounts, { ...EMPTY_BANK }] }));
  const removeBank = (idx: number) =>
    setForm((p) => ({ ...p, bankAccounts: p.bankAccounts.filter((_, i) => i !== idx) }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const yape = form.yape.number.trim() ? form.yape : undefined;
    const plin = form.plin.number.trim() ? form.plin : undefined;
    const payload: Partial<CompanyInfo> = {
      legalName: form.legalName.trim(),
      ruc: form.ruc.trim() || undefined,
      address: form.address.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      salesEmail: form.salesEmail.trim() || undefined,
      website: form.website.trim() || undefined,
      logoUrl: form.logoUrl.trim() || undefined,
      bankAccounts: form.bankAccounts
        .filter((b) => b.bank.trim() && b.accountNumber.trim() && b.holder.trim())
        .map((b) => ({ ...b, cci: b.cci?.trim() || undefined })),
      detraccionAccount: form.detraccionAccount.accountNumber.trim()
        ? {
            bank: form.detraccionAccount.bank.trim() || 'Banco de la Nación',
            accountNumber: form.detraccionAccount.accountNumber.trim(),
          }
        : undefined,
      yape,
      plin,
    };
    update.mutate(payload);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-500 text-sm">Cargando…</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Datos generales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Razón social *">
            <input
              required
              type="text"
              value={form.legalName}
              onChange={(e) => setField('legalName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </Field>
          <Field label="RUC">
            <input
              type="text"
              value={form.ruc}
              onChange={(e) => setField('ruc', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </Field>
          <Field label="Dirección" full>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </Field>
          <Field label="Teléfono">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </Field>
          <Field label="Email del área de ventas">
            <input
              type="email"
              value={form.salesEmail}
              onChange={(e) => setField('salesEmail', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </Field>
          <Field label="Sitio web">
            <input
              type="text"
              value={form.website}
              onChange={(e) => setField('website', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </Field>
          <Field label="URL del logo">
            <input
              type="text"
              value={form.logoUrl}
              onChange={(e) => setField('logoUrl', e.target.value)}
              placeholder="/pwa-192x192.png"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </Field>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Cuentas bancarias</h3>
          <button
            type="button"
            onClick={addBank}
            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Plus size={14} /> Agregar cuenta
          </button>
        </div>
        {form.bankAccounts.length === 0 && (
          <p className="text-sm text-gray-400">Sin cuentas registradas.</p>
        )}
        <div className="space-y-3">
          {form.bankAccounts.map((bank, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Banco">
                  <input type="text" value={bank.bank} onChange={(e) => updateBank(idx, { bank: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
                <Field label="Moneda">
                  <select
                    value={bank.currency}
                    onChange={(e) => updateBank(idx, { currency: e.target.value as 'PEN' | 'USD' })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </Field>
                <Field label="N° de cuenta">
                  <input type="text" value={bank.accountNumber} onChange={(e) => updateBank(idx, { accountNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
                <Field label="CCI">
                  <input type="text" value={bank.cci || ''} onChange={(e) => updateBank(idx, { cci: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
                <Field label="Titular" full>
                  <input type="text" value={bank.holder} onChange={(e) => updateBank(idx, { holder: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
              </div>
              <div className="flex justify-end mt-2">
                <button type="button" onClick={() => removeBank(idx)} className="text-red-500 hover:text-red-600 inline-flex items-center gap-1 text-sm">
                  <Trash2 size={14} /> Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border border-emerald-200 rounded-lg p-3 bg-emerald-50/50">
          <p className="text-xs font-semibold text-emerald-800 mb-3">Cuenta de detracciones</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Banco">
              <input
                type="text"
                value={form.detraccionAccount.bank}
                onChange={(e) => setField('detraccionAccount', { ...form.detraccionAccount, bank: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </Field>
            <Field label="N° de cuenta">
              <input
                type="text"
                value={form.detraccionAccount.accountNumber}
                onChange={(e) => setField('detraccionAccount', { ...form.detraccionAccount, accountNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </Field>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Billeteras digitales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Yape</p>
            <Field label="Número">
              <input type="text" value={form.yape.number} onChange={(e) => setField('yape', { ...form.yape, number: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </Field>
            <Field label="Titular">
              <input type="text" value={form.yape.holder} onChange={(e) => setField('yape', { ...form.yape, holder: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </Field>
          </div>
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Plin</p>
            <Field label="Número">
              <input type="text" value={form.plin.number} onChange={(e) => setField('plin', { ...form.plin, number: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </Field>
            <Field label="Titular">
              <input type="text" value={form.plin.holder} onChange={(e) => setField('plin', { ...form.plin, holder: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </Field>
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={update.isPending}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium px-5 py-2.5 rounded-lg disabled:opacity-50"
        >
          <Save size={16} />
          {update.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

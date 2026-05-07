import { useState, useEffect } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { useCreateClient } from '../hooks/useClients';
import { useDniLookup, useRucLookup } from '../../../shared/hooks/useLookup';
import { clientService } from '../services/clientService';
import { LocationFields } from './LocationFields';
import { Search, Loader2, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Client } from '../../../shared/types';

interface QuickClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (client: Client) => void;
  prefillName?: string;
  prefillDocument?: string;
}

export function QuickClientModal({ isOpen, onClose, onCreated, prefillName, prefillDocument }: QuickClientModalProps) {
  const createClient = useCreateClient();
  const dniLookup = useDniLookup();
  const rucLookup = useRucLookup();

  const [docType, setDocType] = useState<'DNI' | 'RUC'>('DNI');
  const [form, setForm] = useState({ name: '', documentNumber: '', phone: '', email: '', address: '', department: '', province: '', district: '', hamlet: '', creditLimit: '' });
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onlyDigits = (prefillDocument || '').replace(/\D/g, '');
    const initialDocType: 'DNI' | 'RUC' = onlyDigits.length === 11 ? 'RUC' : 'DNI';
    setDocType(initialDocType);
    setForm({
      name: prefillName?.match(/^\d+$/) ? '' : (prefillName || ''),
      documentNumber: onlyDigits.slice(0, initialDocType === 'DNI' ? 8 : 11),
      phone: '',
      email: '',
      address: '',
      department: '',
      province: '',
      district: '',
      hamlet: '',
      creditLimit: '',
    });
  }, [isOpen, prefillName, prefillDocument]);

  const isValidDoc = docType === 'DNI' ? form.documentNumber.length === 8 : form.documentNumber.length === 11;

  const handleLookup = async () => {
    const numero = form.documentNumber.trim();
    if (docType === 'DNI' && numero.length !== 8) { toast.error('El DNI debe tener 8 dígitos'); return; }
    if (docType === 'RUC' && numero.length !== 11) { toast.error('El RUC debe tener 11 dígitos'); return; }
    setLookupLoading(true);
    try {
      const allClients = await clientService.getAll({ search: numero, limit: 1 });
      const localMatch = (allClients?.data || allClients || []).find?.((c: Client) => c.documentNumber === numero);
      if (localMatch) {
        toast.success('Este cliente ya existe en el sistema');
        onCreated(localMatch);
        onClose();
        return;
      }
      if (docType === 'DNI') {
        const result = await dniLookup.mutateAsync(numero);
        const fullName = `${result.apellidoPaterno} ${result.apellidoMaterno}, ${result.nombre}`;
        setForm((prev) => ({ ...prev, name: fullName }));
        toast.success('Datos encontrados en RENIEC');
      } else {
        const result = await rucLookup.mutateAsync(numero);
        setForm((prev) => ({ ...prev, name: result.razonSocial, address: result.direccion || prev.address }));
        toast.success('Datos encontrados en SUNAT');
      }
    } catch {
      /* hook toast */
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Ingresa un nombre'); return; }
    const cleanForm: Record<string, any> = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
    if (cleanForm.creditLimit !== undefined) {
      const parsed = Number(cleanForm.creditLimit);
      if (Number.isFinite(parsed) && parsed >= 0) cleanForm.creditLimit = parsed;
      else delete cleanForm.creditLimit;
    }
    if (cleanForm.district) cleanForm.city = cleanForm.district;
    try {
      const created: Client = await createClient.mutateAsync(cleanForm);
      onCreated(created);
      onClose();
    } catch { /* toast handled */ }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo cliente">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tipo de documento</label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => { setDocType('DNI'); setForm((prev) => ({ ...prev, documentNumber: '' })); }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition ${docType === 'DNI' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              DNI
            </button>
            <button
              type="button"
              onClick={() => { setDocType('RUC'); setForm((prev) => ({ ...prev, documentNumber: '' })); }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition ${docType === 'RUC' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
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
              autoFocus
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
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
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
            <CreditCard size={13} className="text-primary-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Límite de crédito</span>
            <span className="text-[11px] text-gray-400 normal-case font-normal">— opcional, en S/</span>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">S/</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Sin límite"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">
            Si se define, las nuevas ventas a crédito que excedan este monto serán rechazadas.
          </p>
        </div>

        <LocationFields
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
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancelar</button>
          <button
            type="submit"
            disabled={createClient.isPending}
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-semibold shadow-sm"
          >
            {createClient.isPending ? 'Creando...' : 'Crear y seleccionar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

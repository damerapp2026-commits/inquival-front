import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { SmartSearchSelect } from '../../../shared/components/SmartSearchSelect';
import { QuickClientModal } from '../../clients/components/QuickClientModal';
import { useCreateHistoricalCredit } from '../hooks/useCredits';
import { useClients } from '../../clients/hooks/useClients';
import type { Client } from '../../../shared/types';
import { History, User, CalendarDays, Wallet, FileText, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialClientId?: string;
}

interface FormState {
  clientId: string;
  name: string;
  totalAmount: string;
  paidAmount: string;
  issueDate: string;
  dueDate: string;
  notes: string;
}

const empty: FormState = {
  clientId: '',
  name: '',
  totalAmount: '',
  paidAmount: '',
  issueDate: '',
  dueDate: '',
  notes: '',
};

function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function RegisterHistoricalCreditModal({ isOpen, onClose, initialClientId }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [clientSearch, setClientSearch] = useState('');
  const [showQuickClient, setShowQuickClient] = useState(false);
  const { data: clientsData } = useClients({ limit: 500 });
  const create = useCreateHistoricalCredit();

  const clients: Client[] = useMemo(() => clientsData?.data || [], [clientsData]);

  useEffect(() => {
    if (isOpen) {
      setForm({ ...empty, clientId: initialClientId || '', issueDate: todayIsoDate() });
    }
  }, [isOpen, initialClientId]);

  const totalNum = Number(form.totalAmount);
  const paidNum = Number(form.paidAmount || 0);
  const pendingNum = Number.isFinite(totalNum) && Number.isFinite(paidNum) ? Math.max(0, totalNum - paidNum) : 0;
  const overpaid = Number.isFinite(totalNum) && Number.isFinite(paidNum) && paidNum > totalNum;
  const status: 'PENDING' | 'PARTIAL' | 'PAID' =
    pendingNum === 0 && totalNum > 0 ? 'PAID' : (paidNum > 0 ? 'PARTIAL' : 'PENDING');

  const canSubmit =
    !!form.clientId &&
    Number.isFinite(totalNum) &&
    totalNum >= 0.01 &&
    !overpaid &&
    !create.isPending;

  const selectedClient = clients.find((c) => c.id === form.clientId);
  const limitInfo = selectedClient && typeof selectedClient.creditLimit === 'number' && selectedClient.creditLimit > 0
    ? `Cliente con límite de S/ ${selectedClient.creditLimit.toFixed(2)}`
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const payload: Record<string, any> = {
      clientId: form.clientId,
      totalAmount: totalNum,
    };
    if (form.name.trim()) payload.name = form.name.trim();
    if (paidNum > 0) payload.paidAmount = paidNum;
    if (form.issueDate) payload.issueDate = new Date(form.issueDate + 'T00:00:00').toISOString();
    if (form.dueDate) payload.dueDate = new Date(form.dueDate + 'T00:00:00').toISOString();
    if (form.notes.trim()) payload.notes = form.notes.trim();
    try {
      await create.mutateAsync(payload);
      onClose();
    } catch { /* toast handled in hook */ }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar deuda histórica" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-sm">
          <History size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            Usa esta opción para registrar deudas que el cliente ya tenía antes de migrar al sistema.
            La cuenta se crea sin venta asociada y puedes retro-fechar la emisión.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
            <User size={12} /> Cliente <span className="text-red-500 normal-case">*</span>
          </label>
          <SmartSearchSelect
            items={clients}
            value={form.clientId}
            onChange={(id) => { setForm({ ...form, clientId: id }); setClientSearch(''); }}
            getId={(c) => c.id}
            getLabel={(c) => c.name}
            getSubLabel={(c) => (
              <span className="flex items-center gap-2">
                {c.documentNumber && <span className="font-mono">{c.documentNumber}</span>}
                {c.phone && <span>· {c.phone}</span>}
              </span>
            )}
            searchFields={(c) => [c.name, c.documentNumber, c.phone]}
            placeholder="Buscar por nombre, DNI/RUC o teléfono…"
            emptyText="No se encontraron clientes con esa búsqueda"
            onAddNew={(text) => { setClientSearch(text); setShowQuickClient(true); }}
            addNewLabel="Añadir nuevo cliente"
          />
          {limitInfo && (
            <p className="mt-1.5 text-[11px] text-blue-700">{limitInfo}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
            <FileText size={12} /> Concepto / Descripción
            <span className="text-gray-400 normal-case font-normal">— opcional</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej: Saldo pendiente de campaña anterior, Compra Feb 2026..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Monto total <span className="text-red-500 normal-case">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">S/</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.totalAmount}
                onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Ya pagado <span className="text-gray-400 normal-case font-normal">— si aplica</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">S/</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.paidAmount}
                onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                className={`w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 ${overpaid ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-primary-500'}`}
                placeholder="0.00"
              />
            </div>
            {overpaid && (
              <p className="mt-1.5 text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle size={11} /> No puede superar el monto total.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
              <CalendarDays size={12} /> Fecha de emisión
            </label>
            <input
              type="date"
              value={form.issueDate}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
              <CalendarDays size={12} /> Vencimiento
              <span className="text-gray-400 normal-case font-normal">— opcional</span>
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {totalNum > 0 && (
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400">Total</div>
              <div className="font-semibold text-gray-700 tabular-nums">S/ {totalNum.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400">Pagado</div>
              <div className="font-semibold text-blue-700 tabular-nums">S/ {paidNum.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400">Saldo</div>
              <div className={`font-semibold tabular-nums ${pendingNum === 0 ? 'text-primary-700' : pendingNum > 0 && paidNum > 0 ? 'text-amber-700' : 'text-rose-700'}`}>S/ {pendingNum.toFixed(2)}</div>
            </div>
            <div className="col-span-3 text-center">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                status === 'PAID' ? 'bg-primary-100 text-primary-800' :
                status === 'PARTIAL' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                <Wallet size={11} /> Estado: {status === 'PAID' ? 'Pagado' : status === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm"
          >
            {create.isPending ? 'Registrando...' : 'Registrar deuda'}
          </button>
        </div>
      </form>

      <QuickClientModal
        isOpen={showQuickClient}
        onClose={() => setShowQuickClient(false)}
        onCreated={(client) => { setForm((prev) => ({ ...prev, clientId: client.id })); setClientSearch(''); }}
        prefillName={clientSearch.trim() && !/^\d+$/.test(clientSearch.trim()) ? clientSearch.trim() : undefined}
        prefillDocument={clientSearch.trim() && /^\d+$/.test(clientSearch.trim()) ? clientSearch.trim() : undefined}
      />
    </Modal>
  );
}

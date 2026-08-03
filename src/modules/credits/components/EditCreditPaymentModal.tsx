import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { AlertCircle, CalendarDays, DollarSign, History, UserCheck } from 'lucide-react';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { useCollectors } from '../../users/hooks/useUsers';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useEditCreditPayment } from '../hooks/useCredits';
import type { CreditAccount, CreditPayment, PaymentMethod, User } from '../../../shared/types';
import { formatMoney, moneySymbol } from '../utils/money';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  credit: CreditAccount | null;
  payment: CreditPayment | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function EditCreditPaymentModal({ isOpen, onClose, credit, payment }: Props) {
  const { user } = useAuth();
  const { data: paymentMethodsData } = usePaymentMethods();
  const paymentMethods: PaymentMethod[] = Array.isArray(paymentMethodsData)
    ? paymentMethodsData.filter((m: PaymentMethod) => m.isActive)
    : [];
  const { data: usersData } = useCollectors();
  const workers: User[] = useMemo(() => {
    const raw: any = usersData;
    const list: User[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list
      .filter((worker) => worker.isActive !== false)
      .sort((a, b) => (a.fullName || a.username).localeCompare(b.fullName || b.username, 'es'));
  }, [usersData]);

  const editPayment = useEditCreditPayment();

  const todayLocal = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
    [],
  );

  const [amount, setAmount] = useState<number>(0);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentDate, setPaymentDate] = useState<string>(todayLocal);
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && payment) {
      setAmount(payment.amount);
      setPaymentMethodId(payment.paymentMethodId || '');
      setPaymentDate(payment.paymentDate.slice(0, 10));
      setReceivedBy(payment.receivedBy || user?.id || '');
      setNotes(payment.notes || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, payment?.id, user?.id]);

  if (!credit || !payment) return null;

  const isHistorical = !!paymentDate && paymentDate !== todayLocal;
  const currency = credit.currency || 'PEN';
  const symbol = moneySymbol(currency);
  // Tope: lo pendiente (ya redondeado en backend) + lo que este abono ya cubría.
  const maxAmount = round2(credit.pendingAmount + payment.amount);

  const errors: string[] = [];
  if (!amount || amount <= 0) errors.push('El monto debe ser mayor a 0');
  if (amount > maxAmount + 0.001) errors.push(`El monto excede el total. Máximo: ${formatMoney(maxAmount, currency)}`);
  if (!paymentMethodId) errors.push('Selecciona un método de pago');
  if (!receivedBy) errors.push('Selecciona quién cobró el crédito');

  const previousCollectorUnavailable = !!payment.receivedBy
    && !workers.some((worker) => worker.id === payment.receivedBy);

  const noChange =
    amount === payment.amount &&
    paymentMethodId === (payment.paymentMethodId || '') &&
    paymentDate === payment.paymentDate.slice(0, 10) &&
    receivedBy === (payment.receivedBy || '') &&
    (notes || '') === (payment.notes || '');

  const disabled = editPayment.isPending || errors.length > 0 || noChange;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const data: any = {};
    if (amount !== payment.amount) data.amount = round2(amount);
    if (paymentMethodId !== (payment.paymentMethodId || '')) data.paymentMethodId = paymentMethodId;
    if (paymentDate !== payment.paymentDate.slice(0, 10)) data.paymentDate = paymentDate;
    if (receivedBy !== (payment.receivedBy || '')) data.receivedBy = receivedBy;
    if ((notes || '') !== (payment.notes || '')) data.notes = notes;
    await editPayment.mutateAsync({ creditId: credit.id, paymentId: payment.id, data });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar abono">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Cuenta</span>
            <span className="font-medium text-gray-800 truncate ml-2">{credit.name || 'Sin nombre'}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-500">Pendiente actual</span>
            <span className="font-medium text-red-600">{formatMoney(credit.pendingAmount, currency)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-500">Máx. para este abono</span>
            <span className="font-medium text-gray-800">{formatMoney(maxAmount, currency)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{symbol}</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAmount}
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">Seleccionar método...</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <UserCheck size={14} /> Cobrado por
          </label>
          <select
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          >
            <option value="">Seleccionar trabajador...</option>
            {previousCollectorUnavailable && (
              <option value={payment.receivedBy}>
                {payment.receivedByName || 'Responsable anterior'} (no disponible)
              </option>
            )}
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.fullName || worker.username}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-500">
            Este responsable también se actualizará en el movimiento de Caja.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <CalendarDays size={13} /> Fecha del pago
          </label>
          <input
            type="date"
            value={paymentDate}
            max={todayLocal}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
              isHistorical ? 'border-amber-300 focus:ring-amber-400 bg-amber-50/40' : 'border-gray-200 focus:ring-primary-500'
            }`}
          />
          {isHistorical && (
            <div className="mt-1.5 text-[11px] text-amber-700 flex items-start gap-1">
              <History size={11} className="mt-0.5 flex-shrink-0" />
              <span>Fecha retro. El abono se moverá a la caja de ese día.</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Comentario"
          />
        </div>

        {errors.slice(0, 2).map((err, i) => (
          <div key={i} className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle size={12} /> {err}
          </div>
        ))}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={disabled}
            className={`flex-1 py-2 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
              disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 shadow-sm'
            }`}
          >
            <DollarSign size={16} />
            {editPayment.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

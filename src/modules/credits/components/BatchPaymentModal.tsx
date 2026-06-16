import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { AlertCircle, CalendarDays, DollarSign, History, Layers } from 'lucide-react';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { useBatchPayment } from '../hooks/useCredits';
import type { CreditAccount, PaymentMethod } from '../../../shared/types';

type Mode = 'EXPLICIT' | 'FIFO';
type PaymentMode = 'SINGLE' | 'MIXED';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  openCredits: CreditAccount[];
}

interface ExplicitRow {
  creditId: string;
  selected: boolean;
  amount: number;
}

interface PaymentSplit {
  paymentMethodId: string;
  amount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function BatchPaymentModal({ isOpen, onClose, clientId, clientName, openCredits }: Props) {
  const { data: paymentMethodsData } = usePaymentMethods();
  const paymentMethods: PaymentMethod[] = useMemo(
    () => (Array.isArray(paymentMethodsData) ? paymentMethodsData.filter((m: PaymentMethod) => m.isActive) : []),
    [paymentMethodsData],
  );

  const batchPayment = useBatchPayment();

  const todayLocal = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
    [],
  );

  const [mode, setMode] = useState<Mode>('EXPLICIT');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('SINGLE');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState<string>(todayLocal);
  const [rows, setRows] = useState<ExplicitRow[]>([]);
  const [fifoAmount, setFifoAmount] = useState<number>(0);

  const isHistorical = !!paymentDate && paymentDate !== todayLocal;

  const totalPending = useMemo(
    () => round2(openCredits.reduce((s, c) => s + c.pendingAmount, 0)),
    [openCredits],
  );

  const orderedByAge = useMemo(
    () => [...openCredits].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
    [openCredits],
  );

  useEffect(() => {
    if (isOpen) {
      setMode('EXPLICIT');
      setPaymentMode('SINGLE');
      setPaymentMethodId(paymentMethods[0]?.id || '');
      setPaymentSplits([
        { paymentMethodId: paymentMethods[0]?.id || '', amount: 0 },
        { paymentMethodId: paymentMethods[1]?.id || '', amount: 0 },
      ]);
      setNotes('');
      setPaymentDate(todayLocal);
      setFifoAmount(0);
      setRows(openCredits.map((c) => ({ creditId: c.id, selected: false, amount: 0 })));
    }
  }, [isOpen, openCredits.length, paymentMethods]);

  const explicitTotal = useMemo(
    () => round2(rows.filter((r) => r.selected).reduce((s, r) => s + (r.amount || 0), 0)),
    [rows],
  );

  const explicitErrors = useMemo(() => {
    const errs: string[] = [];
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) errs.push('Selecciona al menos una cuenta');
    for (const row of selected) {
      const credit = openCredits.find((c) => c.id === row.creditId);
      if (!credit) continue;
      if (row.amount <= 0) errs.push(`Monto inválido para "${credit.name || 'sin nombre'}"`);
      if (row.amount > credit.pendingAmount) {
        errs.push(`"${credit.name || 'sin nombre'}" excede el pendiente (S/ ${credit.pendingAmount.toFixed(2)})`);
      }
    }
    return errs;
  }, [rows, openCredits]);

  const fifoPreview = useMemo(() => {
    if (mode !== 'FIFO' || !fifoAmount || fifoAmount <= 0) return [];
    let remaining = round2(fifoAmount);
    const preview: { creditId: string; name: string; amount: number }[] = [];
    for (const c of orderedByAge) {
      if (remaining <= 0) break;
      const apply = round2(Math.min(c.pendingAmount, remaining));
      if (apply <= 0) continue;
      preview.push({ creditId: c.id, name: c.name || 'Sin nombre', amount: apply });
      remaining = round2(remaining - apply);
    }
    if (preview.length > 0 && remaining < 0) {
      preview[preview.length - 1].amount = round2(preview[preview.length - 1].amount + remaining);
    }
    return preview;
  }, [mode, fifoAmount, orderedByAge]);

  const fifoErrors = useMemo(() => {
    const errs: string[] = [];
    if (!fifoAmount || fifoAmount <= 0) errs.push('Ingresa un monto mayor a 0');
    else if (fifoAmount > totalPending) errs.push(`El monto excede la deuda total (S/ ${totalPending.toFixed(2)})`);
    return errs;
  }, [fifoAmount, totalPending]);

  const paymentTotal = mode === 'EXPLICIT' ? explicitTotal : round2(fifoAmount || 0);
  const splitTotal = useMemo(
    () => round2(paymentSplits.reduce((s, p) => s + (p.amount || 0), 0)),
    [paymentSplits],
  );

  const paymentErrors = useMemo(() => {
    const errs: string[] = [];
    if (paymentMode === 'SINGLE') {
      if (!paymentMethodId) errs.push('Selecciona un método de pago');
      return errs;
    }

    const validSplits = paymentSplits.filter((p) => p.paymentMethodId && p.amount > 0);
    if (validSplits.length < 2) errs.push('El pago mixto requiere al menos dos métodos con monto');
    const ids = validSplits.map((p) => p.paymentMethodId);
    if (new Set(ids).size !== ids.length) errs.push('No repitas el mismo método en el pago mixto');
    if (paymentTotal > 0 && Math.abs(splitTotal - paymentTotal) > 0.01) {
      errs.push(`La suma del pago mixto (S/ ${splitTotal.toFixed(2)}) debe ser S/ ${paymentTotal.toFixed(2)}`);
    }
    return errs;
  }, [paymentMethodId, paymentMode, paymentSplits, paymentTotal, splitTotal]);

  const disabled =
    batchPayment.isPending ||
    (mode === 'EXPLICIT' ? explicitErrors.length > 0 : fifoErrors.length > 0) ||
    paymentErrors.length > 0;

  const toggleRow = (creditId: string, selected: boolean) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.creditId !== creditId) return r;
        if (selected) {
          const credit = openCredits.find((c) => c.id === creditId);
          return { ...r, selected: true, amount: r.amount > 0 ? r.amount : (credit?.pendingAmount || 0) };
        }
        return { ...r, selected: false, amount: 0 };
      }),
    );
  };
  const setRowAmount = (creditId: string, amount: number) => {
    setRows((prev) => prev.map((r) => (r.creditId === creditId ? { ...r, amount } : r)));
  };
  const fillRow = (creditId: string) => {
    const credit = openCredits.find((c) => c.id === creditId);
    if (!credit) return;
    setRows((prev) => prev.map((r) => (r.creditId === creditId ? { ...r, selected: true, amount: credit.pendingAmount } : r)));
  };

  const addPaymentSplit = () => {
    const used = new Set(paymentSplits.map((p) => p.paymentMethodId).filter(Boolean));
    const nextMethod = paymentMethods.find((m) => !used.has(m.id));
    setPaymentSplits((prev) => [...prev, { paymentMethodId: nextMethod?.id || '', amount: 0 }]);
  };

  const updatePaymentSplit = (idx: number, field: keyof PaymentSplit, value: string | number) => {
    setPaymentSplits((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const removePaymentSplit = (idx: number) => {
    setPaymentSplits((prev) => prev.filter((_, i) => i !== idx));
  };

  const fillSplitRemaining = () => {
    const remaining = round2(paymentTotal - splitTotal);
    if (remaining <= 0) return;
    setPaymentSplits((prev) => {
      const emptyIdx = prev.findIndex((p) => !p.amount);
      if (emptyIdx >= 0) {
        return prev.map((p, i) => (i === emptyIdx ? { ...p, amount: remaining } : p));
      }
      return prev.map((p, i) => (i === prev.length - 1 ? { ...p, amount: round2((p.amount || 0) + remaining) } : p));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (mode === 'EXPLICIT') {
      const allocations = rows
        .filter((r) => r.selected && r.amount > 0)
        .map((r) => ({ creditId: r.creditId, amount: round2(r.amount) }));
      await batchPayment.mutateAsync({
        clientId,
        ...(paymentMode === 'SINGLE'
          ? { paymentMethodId }
          : { payments: paymentSplits.filter((p) => p.paymentMethodId && p.amount > 0).map((p) => ({ ...p, amount: round2(p.amount) })) }),
        mode: 'EXPLICIT',
        allocations,
        notes: notes || undefined,
        paymentDate: paymentDate || undefined,
      });
    } else {
      await batchPayment.mutateAsync({
        clientId,
        ...(paymentMode === 'SINGLE'
          ? { paymentMethodId }
          : { payments: paymentSplits.filter((p) => p.paymentMethodId && p.amount > 0).map((p) => ({ ...p, amount: round2(p.amount) })) }),
        mode: 'FIFO',
        totalAmount: round2(fifoAmount),
        notes: notes || undefined,
        paymentDate: paymentDate || undefined,
      });
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Pagar — ${clientName}`} size="xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Pendiente total</div>
            <div className="text-2xl font-bold text-red-600">S/ {totalPending.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-500">Cuentas abiertas</div>
            <div className="text-xl font-semibold text-gray-800">{openCredits.length}</div>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('EXPLICIT')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'EXPLICIT' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Específico
          </button>
          <button
            type="button"
            onClick={() => setMode('FIFO')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'FIFO' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            General (más antiguo primero)
          </button>
        </div>

        {mode === 'EXPLICIT' ? (
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
            {openCredits.length === 0 ? (
              <div className="text-center text-gray-400 py-6">No hay cuentas abiertas</div>
            ) : (
              openCredits.map((credit) => {
                const row = rows.find((r) => r.creditId === credit.id);
                const selected = !!row?.selected;
                const amount = row?.amount || 0;
                return (
                  <div
                    key={credit.id}
                    className={`border rounded-xl p-3 transition-colors ${
                      selected ? 'border-primary-400 bg-primary-50/40' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => toggleRow(credit.id, e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">
                          {credit.name || <span className="italic text-gray-400">Sin nombre</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(credit.createdAt).toLocaleDateString('es-PE')} · Pendiente S/ {credit.pendingAmount.toFixed(2)}
                        </div>
                        {credit.saleDetails && credit.saleDetails.length > 0 && (
                          <div className="text-xs text-gray-400 truncate mt-0.5" title={
                            credit.saleDetails.flatMap((s) => s.items.map((i: any) => `${i.productName} x${i.quantity}`)).join(', ')
                          }>
                            {credit.saleDetails
                              .flatMap((s) => s.items.map((i: any) => `${i.productName} x${i.quantity}`))
                              .slice(0, 3)
                              .join(', ')}
                            {credit.saleDetails.reduce((n, s) => n + s.items.length, 0) > 3 && '...'}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">S/</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={credit.pendingAmount}
                            value={amount || ''}
                            onChange={(e) => setRowAmount(credit.id, parseFloat(e.target.value) || 0)}
                            disabled={!selected}
                            className="w-28 pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => fillRow(credit.id)}
                          className="text-xs px-2 py-1 bg-white border border-gray-200 rounded-md text-gray-600 hover:border-primary-400 hover:text-primary-600"
                        >
                          Todo
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">Total a pagar</span>
              <span className="text-xl font-bold text-primary-700">S/ {explicitTotal.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">S/</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={totalPending}
                  value={fifoAmount || ''}
                  onChange={(e) => setFifoAmount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            {fifoPreview.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Layers size={12} /> Se aplicará:
                </div>
                <div className="space-y-1">
                  {fifoPreview.map((p) => {
                    const credit = orderedByAge.find((c) => c.id === p.creditId);
                    return (
                      <div key={p.creditId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate">
                          {p.name}
                          {credit && (
                            <span className="text-gray-400 ml-2 text-xs">
                              {new Date(credit.createdAt).toLocaleDateString('es-PE')}
                            </span>
                          )}
                        </span>
                        <span className="font-medium text-primary-700">S/ {p.amount.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                <span>Pago retro-fechado. Se registrará en la caja de ese día (se crea si no existe).</span>
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setPaymentMode('SINGLE')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  paymentMode === 'SINGLE'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                }`}
              >
                Uno
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('MIXED');
                  setPaymentSplits((prev) => prev.length >= 2 ? prev : [
                    { paymentMethodId: paymentMethods[0]?.id || '', amount: 0 },
                    { paymentMethodId: paymentMethods[1]?.id || '', amount: 0 },
                  ]);
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  paymentMode === 'MIXED'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                Mixto
              </button>
            </div>

            {paymentMode === 'SINGLE' ? (
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
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-blue-800">
                    Total mixto: S/ {splitTotal.toFixed(2)} de S/ {paymentTotal.toFixed(2)}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={fillSplitRemaining} className="text-xs text-blue-700 hover:text-blue-900 font-medium">
                      Completar saldo
                    </button>
                    <button type="button" onClick={addPaymentSplit} className="text-xs text-blue-700 hover:text-blue-900 font-medium">
                      + Agregar
                    </button>
                  </div>
                </div>
                {paymentSplits.map((split, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={split.paymentMethodId}
                      onChange={(e) => updatePaymentSplit(idx, 'paymentMethodId', e.target.value)}
                      className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      required
                    >
                      <option value="">Seleccionar método...</option>
                      {paymentMethods.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <div className="relative w-32">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">S/</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={split.amount || ''}
                        onChange={(e) => updatePaymentSplit(idx, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-2 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    {paymentSplits.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removePaymentSplit(idx)}
                        className="text-red-400 hover:text-red-600 px-1"
                        title="Quitar método"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Comentario común"
            />
          </div>
        </div>

        {(mode === 'EXPLICIT' ? explicitErrors : fifoErrors).slice(0, 3).map((err, i) => (
          <div key={i} className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle size={12} /> {err}
          </div>
        ))}
        {paymentErrors.slice(0, 3).map((err, i) => (
          <div key={`payment-${i}`} className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle size={12} /> {err}
          </div>
        ))}

        <button
          type="submit"
          disabled={disabled}
          className={`w-full py-3 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
            disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 shadow-sm'
          }`}
        >
          <DollarSign size={18} />
          {batchPayment.isPending ? 'Registrando...' : 'Registrar Pago'}
        </button>
      </form>
    </Modal>
  );
}

import { useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateEs } from '../../../shared/utils/date.util';
import { addDaysToDate, PURCHASE_ORDER_CREDIT_DAYS } from '../utils/purchaseOrderDetails';
import { generateOrderInstallments, orderInstallmentsError, type OrderInstallment } from '../utils/purchaseOrderSchedule';

const inputClass = 'mt-1 w-full min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
const daysBetween = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 86400000);

interface Props {
  issueDate: string;
  total: number;
  currency: 'PEN' | 'USD';
  scheduleType: 'SINGLE_DATE' | 'INSTALLMENTS';
  onScheduleTypeChange: (value: 'SINGLE_DATE' | 'INSTALLMENTS') => void;
  creditDays: number;
  onCreditDaysChange: (value: number) => void;
  installments: OrderInstallment[];
  onInstallmentsChange: (value: OrderInstallment[]) => void;
}

export function PurchaseOrderCreditSchedule({ issueDate, total, currency, scheduleType, onScheduleTypeChange, creditDays, onCreditDaysChange, installments, onInstallmentsChange }: Props) {
  const [generator, setGenerator] = useState(() => ({
    count: installments.length || 6,
    intervalDays: installments.length > 1 ? Math.max(1, daysBetween(installments[0].dueDate, installments[1].dueDate)) : 15,
    firstDays: installments.length ? Math.max(0, daysBetween(issueDate, installments[0].dueDate)) : 15,
  }));
  const standardDays = PURCHASE_ORDER_CREDIT_DAYS.some(days => days === creditDays);
  const dueDate = addDaysToDate(issueDate, creditDays);
  const symbol = currency === 'USD' ? 'US$' : 'S/';
  const sum = installments.reduce((value, installment) => value + Math.round(installment.amount * 100), 0) / 100;
  const error = orderInstallmentsError(installments, total, issueDate);
  const generate = () => {
    const generated = generateOrderInstallments(total, issueDate, generator);
    if (!generated.length) {
      toast.error('Completa los productos y la fecha del pedido. Usa de 1 a 36 cuotas, días enteros y un plazo máximo de 3650 días; cada cuota debe ser de al menos 0.01.');
      return;
    }
    onInstallmentsChange(generated);
  };

  return <div className="sm:col-span-2 space-y-3">
    <div className="flex flex-wrap gap-2">
      {(['SINGLE_DATE', 'INSTALLMENTS'] as const).map(value => <button key={value} type="button" aria-pressed={scheduleType === value} onClick={() => {
        onScheduleTypeChange(value);
        if (value === 'SINGLE_DATE') onInstallmentsChange([]);
      }} className={`px-3 py-2 rounded-lg border text-sm ${scheduleType === value ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
        {value === 'SINGLE_DATE' ? 'Fecha única' : 'Letras / cuotas'}
      </button>)}
    </div>
    {scheduleType === 'SINGLE_DATE' ? <label className="block">
      <span className="text-xs font-medium text-gray-600">Plazo de crédito</span>
      <select aria-label="Plazo de crédito" value={standardDays ? creditDays : 'custom'} onChange={event => onCreditDaysChange(event.target.value === 'custom' ? 0 : Number(event.target.value))} className={inputClass}>
        {PURCHASE_ORDER_CREDIT_DAYS.map(days => <option key={days} value={days}>{days} días</option>)}
        <option value="custom">Otro plazo</option>
      </select>
      {!standardDays && <input type="number" aria-label="Plazo personalizado en días" min="1" max="3650" step="1" required value={creditDays || ''} onChange={event => onCreditDaysChange(Number(event.target.value))} className={inputClass} placeholder="Número de días" />}
      {creditDays > 0 && dueDate && <span className="mt-2 block text-sm font-medium text-primary-700">Vence: {formatDateEs(dueDate)}</span>}
    </label> : <div className="space-y-3 rounded-lg border border-primary-100 bg-primary-50/30 p-3">
      <p className="text-sm font-medium text-gray-700">Programar letras o cuotas</p>
      <p className="text-xs text-gray-500">Las fechas se calculan desde la fecha del pedido. El total a repartir incluye IGV.</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="min-w-0 text-xs text-gray-600">N° cuotas<input aria-label="N° cuotas" type="number" min="1" max="36" step="1" value={generator.count || ''} onChange={e => setGenerator(current => ({ ...current, count: Number(e.target.value) }))} className={inputClass} /></label>
        <label className="min-w-0 text-xs text-gray-600">Cada (días)<input aria-label="Cada (días)" type="number" min="1" max="3650" step="1" value={generator.intervalDays || ''} onChange={e => setGenerator(current => ({ ...current, intervalDays: Number(e.target.value) }))} className={inputClass} /></label>
        <label className="min-w-0 text-xs text-gray-600">1ra cuota (días)<input aria-label="1ra cuota (días)" type="number" min="0" max="3650" step="1" value={generator.firstDays} onChange={e => setGenerator(current => ({ ...current, firstDays: Number(e.target.value) }))} className={inputClass} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        {[15, 20, 30].map(days => <button type="button" key={days} onClick={() => setGenerator(current => ({ ...current, intervalDays: days, firstDays: days }))} className="px-2.5 py-1.5 text-xs border border-primary-200 rounded-md text-primary-700 bg-white">Cada {days} días</button>)}
        <button type="button" onClick={generate} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary-600 text-white"><Wand2 size={14} />Generar cuotas</button>
      </div>
      {!!installments.length && <div className="space-y-2">
        <div className="grid grid-cols-[20px_minmax(0,1fr)_minmax(0,1.3fr)_28px] gap-2 text-xs text-gray-500"><span>#</span><span>Monto ({symbol})</span><span>Fecha de pago</span><span /></div>
        {installments.map((installment, index) => <div key={index} className="grid grid-cols-[20px_minmax(0,1fr)_minmax(0,1.3fr)_28px] gap-2 items-center">
          <span className="text-xs text-gray-500">{index + 1}</span>
          <input type="number" aria-label={`Monto cuota ${index + 1}`} min="0.01" step="0.01" required value={installment.amount || ''} onChange={e => onInstallmentsChange(installments.map((i, idx) => idx === index ? { ...i, amount: Number(e.target.value) } : i))} className={inputClass} />
          <input type="date" aria-label={`Vencimiento cuota ${index + 1}`} min={issueDate} required value={installment.dueDate} onChange={e => onInstallmentsChange(installments.map((i, idx) => idx === index ? { ...i, dueDate: e.target.value } : i))} className={inputClass} />
          <button type="button" aria-label={`Quitar cuota ${index + 1}`} onClick={() => onInstallmentsChange(installments.filter((_, idx) => idx !== index))} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
        </div>)}
        <p className={`text-xs font-medium ${error ? 'text-amber-700' : 'text-primary-700'}`}>Total de cuotas: {symbol} {sum.toFixed(2)} / Total de la orden: {symbol} {total.toFixed(2)}</p>
      </div>}
      <button type="button" onClick={() => onInstallmentsChange([...installments, { amount: Math.max(0, Math.round((total - sum) * 100) / 100), dueDate: addDaysToDate(installments[installments.length - 1]?.dueDate || issueDate, installments.length ? Math.max(1, generator.intervalDays) : Math.max(0, generator.firstDays)) }])} className="flex items-center gap-1 text-xs font-medium text-primary-700"><Plus size={14} />Agregar cuota</button>
      {error && <p className="text-xs text-amber-700" role="status">{error}</p>}
    </div>}
  </div>;
}

import { useId } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  selectedStatementPeriod, statementPeriodError, statementPeriodSelection,
  type StatementPeriodPreset, type StatementPeriodSelection,
} from '../utils/clientStatementPeriod';

export function ClientStatementPeriodFilter({ value, onChange, disabled = false }: {
  value: StatementPeriodSelection;
  onChange: (value: StatementPeriodSelection) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const error = statementPeriodError(selectedStatementPeriod(value));
  return (
    <fieldset disabled={disabled} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <legend className="px-1 text-sm font-semibold text-gray-700 inline-flex items-center gap-1.5"><CalendarDays size={15} /> Periodo del estado de cuenta</legend>
      <label htmlFor={`${id}-preset`} className="block text-xs font-medium text-gray-600">Periodo</label>
      <select id={`${id}-preset`} value={value.preset}
        onChange={event => {
          const preset = event.target.value as StatementPeriodPreset;
          onChange(preset === 'custom' ? { ...value, preset } : statementPeriodSelection(preset));
        }}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50">
        <option value="all">Todo el historial</option>
        <option value="month">Este mes</option>
        <option value="previousMonth">Mes anterior</option>
        <option value="custom">Personalizado</option>
      </select>
      {value.preset !== 'all' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-600" htmlFor={`${id}-from`}>Desde
            <input id={`${id}-from`} type="date" value={value.from} max={value.to || undefined} required aria-invalid={!!error}
              onChange={event => onChange({ ...value, preset: 'custom', from: event.target.value })}
              className="mt-1 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-gray-600" htmlFor={`${id}-to`}>Hasta
            <input id={`${id}-to`} type="date" value={value.to} min={value.from || undefined} required aria-invalid={!!error}
              onChange={event => onChange({ ...value, preset: 'custom', to: event.target.value })}
              className="mt-1 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
          </label>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">El periodo selecciona las cuentas por su fecha de creación y las ventas por su fecha de venta. Incluye los abonos y el saldo actual de esas cuentas.</p>
    </fieldset>
  );
}

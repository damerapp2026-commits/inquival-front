import { useMemo, useState } from 'react';
import type { CreditAccount } from '../../../shared/types';
import { formatDateEs } from '../../../shared/utils/date.util';
import { creditAccountLabel, creditSaleReferences } from '../utils/creditReference';
import { statementAccountMatches, statementAccountSearchText } from '../utils/statementAccountSearch';
import { formatMoney } from '../utils/money';

const accountDate = (value: string) => formatDateEs(value, { day: '2-digit', month: '2-digit', year: 'numeric' }) || 'Sin fecha';
const STATUS: Record<CreditAccount['status'], string> = { PENDING: 'Pendiente', PARTIAL: 'Abono parcial', PAID: 'Pagada' };

export function ClientStatementAccountSelector({ credits, value, onChange, disabled = false, totalAccounts, onShowAll, periodError }: {
  credits: CreditAccount[];
  value: string[] | undefined;
  onChange: (ids: string[] | undefined) => void;
  disabled?: boolean;
  totalAccounts?: number;
  onShowAll?: () => void;
  periodError?: string;
}) {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(20);
  const accounts = useMemo(() => [...new Map(credits.map(credit => [credit.id, credit])).values()]
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)), [credits]);
  const indexed = useMemo(() => accounts.map(credit => ({ credit, text: statementAccountSearchText(credit) })), [accounts]);
  const selected = new Set(value ?? accounts.map(credit => credit.id));
  const count = accounts.filter(credit => selected.has(credit.id)).length;
  const matches = indexed.filter(account => statementAccountMatches(account.text, search)).map(account => account.credit);
  const matchingIds = new Set(matches.map(credit => credit.id));
  const hiddenSelected = accounts.filter(credit => selected.has(credit.id) && !matchingIds.has(credit.id)).length;
  const total = Math.max(totalAccounts ?? accounts.length, accounts.length);
  const outsidePeriod = total - accounts.length;

  return (
    <fieldset disabled={disabled} className="rounded-xl border border-gray-200 p-4 space-y-3">
      <legend className="px-1 text-sm font-semibold text-gray-700">Cuentas a exportar</legend>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={value !== undefined} onChange={event => onChange(event.target.checked ? [] : undefined)} className="rounded border-gray-300" />
        Elegir cuentas específicas
      </label>
      <p role="status" className="text-xs text-gray-500">Se exportarán {count} de {accounts.length} cuentas del periodo.</p>
      {periodError ? <p className="text-xs text-gray-500">Completa un periodo válido para ver las cuentas.</p>
        : !accounts.length && <p className="text-sm text-gray-600">{total ? 'No hay cuentas creadas en el periodo seleccionado.' : 'Este cliente no tiene cuentas registradas.'}</p>}
      {outsidePeriod > 0 && onShowAll && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <p>Hay {outsidePeriod} cuenta{outsidePeriod === 1 ? '' : 's'} en otras fechas.</p>
          <button type="button" onClick={() => { setSearch(''); setLimit(20); onShowAll(); }} className="mt-1.5 font-semibold underline">Ver todas las cuentas ({total})</button>
        </div>
      )}
      {value !== undefined && accounts.length > 0 && (
        <>
          <p className="text-xs text-gray-600">Marca la casilla de la nota que deseas exportar. Puedes reconocerla por su fecha y monto; no necesitas conocer el nombre de la cuenta.</p>
          <input type="search" aria-label="Buscar cuenta para exportar" placeholder="Buscar por nota de venta, fecha o monto..." value={search}
            onChange={event => { setSearch(event.target.value); setLimit(20); }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-3 text-xs font-medium">
            <button type="button" onClick={() => onChange(accounts.map(credit => credit.id))} className="text-primary-700 hover:underline">Seleccionar todas</button>
            <button type="button" onClick={() => onChange([])} className="text-gray-600 hover:underline">Quitar todas</button>
          </div>
          {hiddenSelected > 0 && <p className="text-xs text-amber-700">{hiddenSelected} cuenta{hiddenSelected === 1 ? ' marcada no coincide' : 's marcadas no coinciden'} con esta búsqueda y seguirá{hiddenSelected === 1 ? '' : 'n'} incluida{hiddenSelected === 1 ? '' : 's'} en el PDF.</p>}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-100">
            {matches.slice(0, limit).map(credit => {
              const references = creditSaleReferences(credit).map(sale => sale.label).join(', ');
              return (
                <label key={credit.id} className={`flex items-start gap-2 px-3 py-3 text-sm cursor-pointer ${selected.has(credit.id) ? 'bg-primary-50/60' : 'hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={selected.has(credit.id)}
                    aria-label={`Incluir ${creditAccountLabel(credit)} del ${accountDate(credit.createdAt)} por ${formatMoney(credit.totalAmount, credit.currency)}`}
                    onChange={event => {
                      const next = new Set(value);
                      if (event.target.checked) next.add(credit.id); else next.delete(credit.id);
                      onChange([...next]);
                    }} className="mt-1 rounded border-gray-300 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-primary-800 break-words">{references || creditAccountLabel(credit)}</span>
                    {references && credit.name?.trim() && credit.name.trim() !== references && <span className="block text-xs text-gray-500 mt-0.5">Cuenta: {credit.name}</span>}
                    <span className="block text-xs text-gray-600 mt-1">Fecha: {accountDate(credit.createdAt)} · {STATUS[credit.status]}</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs mt-1">
                      <span className="text-gray-700">Total: <strong className="font-semibold">{formatMoney(credit.totalAmount, credit.currency)}</strong></span>
                      <span className="text-red-600">Saldo actual: <strong className="font-semibold">{formatMoney(credit.pendingAmount, credit.currency)}</strong></span>
                    </span>
                  </span>
                </label>
              );
            })}
            {!matches.length && <div className="p-3 text-xs text-gray-500"><p>No hay cuentas que coincidan con esta búsqueda.</p><button type="button" onClick={() => { setSearch(''); setLimit(20); }} className="mt-1 text-primary-700 underline">Limpiar búsqueda</button></div>}
          </div>
          {matches.length > limit && <button type="button" onClick={() => setLimit(limit + 20)} className="text-xs text-primary-700 hover:underline">Mostrar más cuentas ({matches.length - limit} restantes)</button>}
        </>
      )}
    </fieldset>
  );
}

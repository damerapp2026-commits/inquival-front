import { CreditAccountReference } from './CreditAccountReference';
import { creditAccountLabel, creditAccountText } from '../utils/creditReference';
import { useMemo, useState } from 'react';
import type { CreditAccount } from '../../../shared/types';
import { formatDateEs } from '../../../shared/utils/date.util';
import { formatMoney } from '../utils/money';

export function ClientStatementAccountSelector({ credits, value, onChange, disabled = false }: {
  credits: CreditAccount[];
  value: string[] | undefined;
  onChange: (ids: string[] | undefined) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(20);
  const accounts = useMemo(() => [...new Map(credits.map(credit => [credit.id, credit])).values()], [credits]);
  const selected = new Set(value ?? accounts.map(credit => credit.id));
  const count = accounts.filter(credit => selected.has(credit.id)).length;
  const matches = accounts.filter(credit => creditAccountText(credit).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return (
    <fieldset disabled={disabled} className="rounded-xl border border-gray-200 p-4 space-y-3">
      <legend className="px-1 text-sm font-semibold text-gray-700">Cuentas a exportar</legend>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={value !== undefined} onChange={event => onChange(event.target.checked ? accounts.map(credit => credit.id) : undefined)} className="rounded border-gray-300" />
        Elegir cuentas específicas
      </label>
      <p role="status" className="text-xs text-gray-500">Se exportarán {count} de {accounts.length} cuentas del periodo.</p>
      {value !== undefined && (
        <>
          <input type="search" aria-label="Buscar cuenta para exportar" placeholder="Buscar cuenta..." value={search}
            onChange={event => { setSearch(event.target.value); setLimit(20); }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-3 text-xs font-medium">
            <button type="button" onClick={() => onChange(accounts.map(credit => credit.id))} className="text-primary-700 hover:underline">Seleccionar todas</button>
            <button type="button" onClick={() => onChange([])} className="text-gray-600 hover:underline">Quitar todas</button>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-100">
            {matches.slice(0, limit).map(credit => (
              <label key={credit.id} className="flex items-start gap-2 px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(credit.id)}
                  aria-label={`Incluir ${creditAccountLabel(credit)} del ${formatDateEs(credit.createdAt)}`}
                  onChange={event => {
                    const next = new Set(value);
                    if (event.target.checked) next.add(credit.id); else next.delete(credit.id);
                    onChange([...next]);
                  }} className="mt-1 rounded border-gray-300 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-800 break-words"><CreditAccountReference credit={credit} /></span>
                  <span className="block text-xs text-gray-500 mt-0.5">Creada: {formatDateEs(credit.createdAt)} · Total: {formatMoney(credit.totalAmount, credit.currency)}</span>
                  <span className="block text-xs text-gray-500">Saldo actual: {formatMoney(credit.pendingAmount, credit.currency)}</span>
                </span>
              </label>
            ))}
            {!matches.length && <p className="p-3 text-xs text-gray-500">No hay cuentas que coincidan.</p>}
          </div>
          {matches.length > limit && <button type="button" onClick={() => setLimit(limit + 20)} className="text-xs text-primary-700 hover:underline">Mostrar más cuentas ({matches.length - limit} restantes)</button>}
        </>
      )}
    </fieldset>
  );
}

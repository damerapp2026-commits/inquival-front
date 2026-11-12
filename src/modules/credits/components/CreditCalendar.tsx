import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock, Eye, X } from 'lucide-react';
import type { CreditAccount } from '../../../shared/types';
import { Pagination } from '../../../shared/components/Pagination';
import { addMonthsToDate, daysUntilDate, formatDateEs, getTodayDateString } from '../../../shared/utils/date.util';
import { buildCreditCalendar, creditCalendarDays, creditDueDate, pendingCreditTotals, type CreditDueEntry } from '../utils/creditCalendar';
import { formatMoney } from '../utils/money';

const PAGE_SIZE = 10;

function Totals({ credits }: { credits: CreditAccount[] }) {
  const totals = pendingCreditTotals(credits);
  return <MoneyTotals totals={totals} />;
}

function MoneyTotals({ totals }: { totals: { PEN: number; USD: number } }) {
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
      {(totals.PEN > 0 || totals.USD === 0) && <span>{formatMoney(totals.PEN, 'PEN')}</span>}
      {totals.USD > 0 && <span>{formatMoney(totals.USD, 'USD')}</span>}
    </span>
  );
}

function CreditDueList({ entries, getClientName, onView, today }: {
  entries: CreditDueEntry[];
  getClientName: (clientId: string) => string;
  onView: (credit: CreditAccount) => void;
  today: string;
}) {
  const [requestedPage, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  return (
    <>
      <ul className="divide-y divide-gray-100">
        {entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(({ credit, dueDate }) => {
          const overdue = !!dueDate && dueDate < today;
          return (
            <li key={credit.id} className={`p-4 ${overdue ? 'bg-red-50/40' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-800 break-words">{getClientName(credit.clientId)}</p>
                  <p className="text-xs text-gray-500 mt-0.5 break-words">{credit.name || 'Crédito sin nombre'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-gray-500">Saldo pendiente</p>
                  <p className={`font-bold text-sm tabular-nums ${overdue ? 'text-red-600' : 'text-gray-800'}`}>
                    {formatMoney(credit.pendingAmount, credit.currency)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-500'}>
                  {dueDate ? `Vence: ${formatDateEs(dueDate)}` : 'Sin fecha de vencimiento'}
                </span>
                {dueDate && dueDate <= today && (
                  <span className={`rounded-full px-2 py-0.5 font-medium ${overdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                    {overdue ? 'Vencido' : 'Vence hoy'}
                  </span>
                )}
                {credit.status === 'PARTIAL' && <span className="rounded-full px-2 py-0.5 bg-blue-50 text-blue-700">Abono parcial</span>}
                <button type="button" onClick={() => onView(credit)}
                  aria-label={`Ver detalle de ${credit.name || 'crédito'} de ${getClientName(credit.clientId)}`}
                  className="inline-flex items-center gap-1 ml-auto px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">
                  <Eye size={13} /> Ver detalle
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {totalPages > 1 && (
        <div className="px-4 pb-4">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </>
  );
}

export function CreditCalendar({ credits, getClientName, onView, filterKey }: {
  credits: CreditAccount[];
  getClientName: (clientId: string) => string;
  onView: (credit: CreditAccount) => void;
  filterKey: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = getTodayDateString();
  const selectedDate = creditDueDate(searchParams.get('creditDate') || undefined);
  const monthParam = searchParams.get('creditMonth') || '';
  const month = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(monthParam)
    ? monthParam : (selectedDate || today).slice(0, 7);
  const model = useMemo(() => buildCreditCalendar(credits, today), [credits, today]);
  const days = useMemo(() => creditCalendarDays(month), [month]);
  const visibleEntries = selectedDate
    ? (model.byDate[selectedDate] || [])
    : model.dated.filter(entry => entry.dueDate.startsWith(month));
  const monthLabel = formatDateEs(`${month}-01`, { month: 'long', year: 'numeric' });

  const selectDate = (date: string) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('creditMonth', date.slice(0, 7));
      if (selectedDate === date) next.delete('creditDate'); else next.set('creditDate', date);
      return next;
    }, { replace: true });
  };
  const changeMonth = (value: string, date?: string) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('creditMonth', value);
      if (date) next.set('creditDate', date); else next.delete('creditDate');
      return next;
    }, { replace: true });
  };

  const summaries = [
    { key: 'overdue' as const, label: 'Vencido', icon: AlertCircle, color: 'border-red-200', iconColor: 'bg-red-100 text-red-600' },
    { key: 'today' as const, label: 'Vence hoy', icon: CalendarClock, color: 'border-yellow-200', iconColor: 'bg-yellow-100 text-yellow-700' },
    { key: 'upcoming' as const, label: 'Próximos 7 días', icon: Clock, color: 'border-primary-200', iconColor: 'bg-primary-100 text-primary-600' },
    { key: 'pending' as const, label: 'Total por cobrar', icon: CalendarDays, color: 'border-gray-200', iconColor: 'bg-gray-100 text-gray-600' },
  ];

  return (
    <section aria-label="Calendario de cobros" className="space-y-5">
      <p className="text-sm text-gray-500">Consulta las fechas de vencimiento de los créditos con saldo pendiente.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {summaries.map(({ key, label, icon: Icon, color, iconColor }) => (
          <div key={key} role="group" aria-label={label} className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${color}`}>
            <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}><Icon size={20} /></span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">{label}</p>
              <div className="font-bold text-gray-800 text-base"><MoneyTotals totals={model.summary[key].totals} /></div>
              <p className="text-xs text-gray-500">{model.summary[key].count} crédito{model.summary[key].count !== 1 ? 's' : ''}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-5 items-start">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <button type="button" aria-label="Mes anterior de cobros" onClick={() => changeMonth(addMonthsToDate(`${month}-01`, -1).slice(0, 7))}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronLeft size={18} /></button>
            <h2 className="font-semibold text-gray-800 text-sm capitalize">{monthLabel}</h2>
            <button type="button" aria-label="Mes siguiente de cobros" onClick={() => changeMonth(addMonthsToDate(`${month}-01`, 1).slice(0, 7))}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronRight size={18} /></button>
          </div>
          <button type="button" onClick={() => changeMonth(today.slice(0, 7), today)} className="block ml-auto mb-3 text-xs font-medium text-primary-700 hover:underline">Ir a hoy</button>
          <div className="grid grid-cols-7 mb-1" aria-hidden="true">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(day => <div key={day} className="text-center text-[11px] font-semibold text-gray-400 py-1">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} aria-hidden="true" className="min-h-[44px]" />;
              const count = model.byDate[date]?.length || 0;
              const selected = date === selectedDate;
              const overdue = date < today;
              const soon = daysUntilDate(date, today) <= 7;
              const colors = !count ? 'border-transparent text-gray-700 hover:bg-gray-100'
                : overdue ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                : soon ? 'border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100'
                : 'border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100';
              return (
                <button key={date} type="button" aria-pressed={selected} aria-current={date === today ? 'date' : undefined}
                  aria-label={`${formatDateEs(date, { day: 'numeric', month: 'long', year: 'numeric' })}: ${count} crédito${count !== 1 ? 's' : ''} por cobrar`}
                  onClick={() => selectDate(date)}
                  className={`flex flex-col items-center justify-center rounded-lg min-h-[44px] border text-sm font-medium transition-colors ${selected ? 'bg-primary-600 text-white border-primary-600' : colors} ${date === today ? 'ring-1 ring-primary-400' : ''}`}>
                  <span>{Number(date.slice(-2))}</span>
                  {count > 0 && <span className="text-[10px] font-bold leading-none mt-0.5">{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-[11px] text-gray-500 justify-center">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Vencido</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Próximo</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-500" /> Futuro</span>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Selecciona un día para consultar sus cobros.</p>
        </div>

        <section aria-label="Vencimientos de créditos" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
          <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm capitalize">
                {selectedDate ? formatDateEs(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : `Vencimientos de ${monthLabel}`}
              </h3>
              <div className="text-xs text-gray-500 mt-1">
                {visibleEntries.length} crédito{visibleEntries.length !== 1 ? 's' : ''} · <Totals credits={visibleEntries.map(entry => entry.credit)} />
              </div>
            </div>
            {selectedDate && <button type="button" aria-label="Ver todos los vencimientos del mes" onClick={() => changeMonth(month)} className="text-gray-400 hover:text-gray-700 p-1"><X size={18} /></button>}
          </div>
          {visibleEntries.length ? (
            <CreditDueList key={`${month}:${selectedDate}:${filterKey}`} entries={visibleEntries} getClientName={getClientName} onView={onView} today={today} />
          ) : (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              <CalendarDays size={32} className="mx-auto mb-2 text-gray-300" />
              {selectedDate ? 'No hay créditos por cobrar para este día.' : 'No hay créditos por cobrar con vencimiento en este mes.'}
            </div>
          )}
        </section>
      </div>

      {model.undated.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-700">Sin fecha de vencimiento ({model.undated.length})</summary>
          <div className="px-4 pb-3 text-xs text-gray-500">
            Saldo pendiente: <Totals credits={model.undated.map(entry => entry.credit)} />. Puedes asignar la fecha desde el listado de créditos.
          </div>
          <CreditDueList key={filterKey} entries={model.undated} getClientName={getClientName} onView={onView} today={today} />
        </details>
      )}
    </section>
  );
}

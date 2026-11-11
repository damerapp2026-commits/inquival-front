import { useState } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight, Eye, Loader2 } from 'lucide-react';
import { useAccountsPayable } from '../hooks/useAccountsPayable';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { formatDateEs, toLocalDateString } from '../../../shared/utils/date.util';
import type { AccountPayable } from '../../../shared/types';

const PAGE_SIZE = 20;

function lastPaymentDate(account: AccountPayable): string | undefined {
  const dates = [
    ...account.payments.map(payment => payment.paymentDate),
    ...account.installments.filter(installment => installment.status === 'PAID').map(installment => installment.paidDate),
  ].filter((date): date is string => !!date).map(date => toLocalDateString(date)).filter(Boolean);
  dates.sort();
  return dates[dates.length - 1];
}

export function PaidAccountsTab({ supplier, currency, onView }: {
  supplier: string;
  currency: 'ALL' | 'PEN' | 'USD';
  onView: (id: string) => void;
}) {
  const search = useDebounce(supplier.trim(), 300);
  const filterKey = JSON.stringify([search, currency]);
  const [pagination, setPagination] = useState({ filterKey, page: 1 });
  const page = pagination.filterKey === filterKey ? pagination.page : 1;
  const { data, isLoading, isError, refetch } = useAccountsPayable({
    status: 'PAID', supplier: search || undefined,
    currency: currency === 'ALL' ? undefined : currency,
    page, limit: PAGE_SIZE,
  });
  const accounts: AccountPayable[] = data?.data || [];
  const total: number = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section aria-label="Cuentas pagadas" className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><CheckCircle size={18} className="text-green-600" /> Cuentas pagadas</h2>
        <p className="text-sm text-gray-500 mt-1">Consulta las cuentas pagadas por completo y el historial de sus abonos.</p>
        {!isLoading && !isError && <p className="text-xs font-medium text-green-700 mt-2">{total} cuenta{total !== 1 ? 's' : ''} pagada{total !== 1 ? 's' : ''}</p>}
      </div>

      {isLoading ? (
        <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" /> Cargando cuentas pagadas...</div>
      ) : isError ? (
        <div className="py-12 px-4 text-center">
          <p role="alert" className="text-sm text-red-600">No se pudieron cargar las cuentas pagadas.</p>
          <button type="button" onClick={() => { void refetch(); }} className="mt-3 text-sm font-medium text-primary-700 hover:underline">Reintentar</button>
        </div>
      ) : accounts.length === 0 ? (
        <div className="py-12 px-4 text-center text-sm text-gray-500">
          {search || currency !== 'ALL' ? 'No hay cuentas pagadas que coincidan con estos filtros.' : 'Todavía no hay cuentas pagadas por completo.'}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {accounts.map(account => {
              const paidDate = lastPaymentDate(account);
              return (
                <li key={account.id} className="p-4 sm:px-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_160px_150px_140px] gap-3 items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 break-words">{account.supplier}</p>
                    <p className="mt-1 text-xs text-gray-500">Comprobante: <span className="font-mono text-gray-700">{account.purchaseRef || 'Sin comprobante registrado'}</span></p>
                    <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5"><CheckCircle size={12} /> Pagado</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total cancelado</p>
                    <p className="font-semibold text-gray-800 tabular-nums">{account.currency === 'USD' ? '$' : 'S/'} {account.totalAmount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-gray-500">{account.currency || 'PEN'}</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Último pago registrado</p>
                    <p className="text-sm text-gray-700">{paidDate ? formatDateEs(paidDate) : 'Sin fecha registrada'}</p>
                  </div>
                  <button type="button" onClick={() => onView(account.id)} aria-label={`Ver historial de ${account.supplier}${account.purchaseRef ? `, ${account.purchaseRef}` : ''}`}
                    className="inline-flex justify-center items-center gap-1.5 px-3 py-2 border border-primary-200 rounded-lg text-sm font-medium text-primary-700 hover:bg-primary-50">
                    <Eye size={15} /> Ver historial
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap justify-between items-center gap-3">
            <span className="text-xs text-gray-500">Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}</span>
            {totalPages > 1 && (
              <nav aria-label="Páginas de cuentas pagadas" className="flex items-center gap-3">
                <button type="button" aria-label="Página anterior de cuentas pagadas" disabled={page <= 1} onClick={() => setPagination({ filterKey, page: page - 1 })} className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="text-xs text-gray-600">Página {page} de {totalPages}</span>
                <button type="button" aria-label="Página siguiente de cuentas pagadas" disabled={page >= totalPages} onClick={() => setPagination({ filterKey, page: page + 1 })} className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40"><ChevronRight size={16} /></button>
              </nav>
            )}
          </div>
        </>
      )}
    </section>
  );
}

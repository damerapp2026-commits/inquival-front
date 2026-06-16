import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useSales } from '../../sales/hooks/useSales';
import { formatDateEs } from '../../../shared/utils/date.util';
import type { Sale } from '../../../shared/types';

const PAGE_SIZE = 10;
type Tab = 'all' | 'contado' | 'credito';

function dispTotal(sale: Sale): number {
  return sale.currency === 'USD' && sale.totalUsd != null ? sale.totalUsd : sale.total;
}
function sym(sale: Sale): string {
  return sale.currency === 'USD' ? '$' : 'S/';
}

export function ClientHistoryPanel({ clientId }: { clientId: string }) {
  const { data, isLoading } = useSales({ clientId, limit: 200, excludeCancelled: 'true' });
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);

  const allSales: Sale[] = useMemo(
    () => (data?.data || []).slice().sort((a: Sale, b: Sale) => b.date.localeCompare(a.date)),
    [data],
  );

  const filtered = useMemo(() => {
    if (tab === 'contado') return allSales.filter(s => !s.isCredit);
    if (tab === 'credito') return allSales.filter(s => s.isCredit);
    return allSales;
  }, [allSales, tab]);

  const totals = useMemo(() => {
    const pen = filtered.filter(s => s.currency !== 'USD').reduce((a, s) => a + s.total, 0);
    const usd = filtered.filter(s => s.currency === 'USD').reduce((a, s) => a + dispTotal(s), 0);
    return { pen, usd };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleTab = (t: Tab) => { setTab(t); setPage(1); };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'contado', label: 'Contado' },
    { key: 'credito', label: 'Crédito' },
  ];

  return (
    <div className="bg-indigo-50/30 border-t border-indigo-100 px-6 py-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => handleTab(t.key)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                tab === t.key ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {totals.pen > 0 && (
            <span>S/ <span className="font-bold text-gray-800">{totals.pen.toFixed(2)}</span></span>
          )}
          {totals.usd > 0 && (
            <span>$ <span className="font-bold text-emerald-700">{totals.usd.toFixed(2)}</span></span>
          )}
          <span className="text-gray-400">{filtered.length} venta{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-white/70 rounded animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
          <ShoppingBag size={28} className="text-gray-300" />
          Sin ventas{tab !== 'all' ? ` al ${tab}` : ''} registradas
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">N°</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Comprobante</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">
                      {sale.saleNumber || `NV-${sale.id.slice(-6).toUpperCase()}`}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{formatDateEs(sale.date)}</td>
                    <td className="px-3 py-2.5">
                      {sale.voucherType === 'BOLETA'
                        ? <span className="text-primary-700 font-medium">Boleta</span>
                        : sale.voucherType === 'FACTURA'
                        ? <span className="text-blue-700 font-medium">Factura</span>
                        : <span className="text-gray-400 text-xs">{(sale.voucherType && sale.voucherType !== 'NONE') ? sale.voucherType : 'N. Venta'}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
                      <span className={sale.currency === 'USD' ? 'text-emerald-700' : 'text-gray-800'}>
                        {sym(sale)} {dispTotal(sale).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {sale.isCredit ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-orange-700">
                          Crédito
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">
                          {sale.payments?.map(p => p.paymentMethodName).filter(Boolean).join(' + ') || 'Efectivo'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2 px-0.5">
              <span className="text-xs text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-white transition-colors"
                >
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                      page === n
                        ? 'bg-primary-600 text-white'
                        : 'border border-gray-200 text-gray-600 hover:bg-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-white transition-colors"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

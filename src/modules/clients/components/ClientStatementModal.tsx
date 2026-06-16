import React, { useState, useMemo } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { useSales } from '../../sales/hooks/useSales';
import { useClientCredits } from '../../credits/hooks/useCredits';
import { formatDateEs } from '../../../shared/utils/date.util';
import { ChevronDown, ChevronRight, ShoppingBag, CreditCard, CheckCircle2, Clock } from 'lucide-react';
import type { Client, Sale, CreditAccount } from '../../../shared/types';

interface Props {
  client: Client | null;
  onClose: () => void;
}

export function ClientStatementModal({ client, onClose }: Props) {
  return (
    <Modal isOpen={!!client} onClose={onClose} title={`Detalle de cuenta — ${client?.name || ''}`} size="xl">
      {client && <ClientStatementContent client={client} />}
    </Modal>
  );
}

function ClientStatementContent({ client }: { client: Client }) {
  const { data: salesData, isLoading: loadingSales } = useSales({ clientId: client.id, limit: 500, excludeCancelled: 'true' });
  const { data: creditsData, isLoading: loadingCredits } = useClientCredits(client.id, { limit: 200 });
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [expandedCreditId, setExpandedCreditId] = useState<string | null>(null);

  const allSales: Sale[] = useMemo(
    () => ((salesData as any)?.data || []).slice().sort((a: Sale, b: Sale) => b.date.localeCompare(a.date)),
    [salesData],
  );

  const allCredits: CreditAccount[] = useMemo(
    () => Array.isArray(creditsData) ? creditsData : ((creditsData as any)?.data || []),
    [creditsData],
  );

  const sym = (sale: Sale) => sale.currency === 'USD' ? '$' : 'S/';
  const dispTotal = (sale: Sale) => sale.currency === 'USD' && sale.totalUsd != null ? sale.totalUsd : sale.total;

  const totalPen = allSales.filter(s => s.currency !== 'USD').reduce((a, s) => a + s.total, 0);
  const totalUsd = allSales.filter(s => s.currency === 'USD').reduce((a, s) => a + dispTotal(s), 0);
  const creditSales = allSales.filter(s => s.isCredit);
  const pendingCredits = allCredits.filter(c => c.status !== 'PAID');
  const totalPending = pendingCredits.reduce((a, c) => a + c.pendingAmount, 0);
  const totalPaidCredit = allCredits.reduce((a, c) => a + c.paidAmount, 0);
  const totalCreditAmount = allCredits.reduce((a, c) => a + c.totalAmount, 0);

  const statusBadge = (credit: CreditAccount) => {
    if (credit.status === 'PAID') return { label: 'Pagado', cls: 'bg-green-100 text-green-700' };
    if (credit.status === 'PARTIAL') return { label: 'Parcial', cls: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Pendiente', cls: 'bg-orange-100 text-orange-700' };
  };

  if (loadingSales || loadingCredits) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-[11px] text-blue-600 font-semibold uppercase tracking-wider mb-1">Total compras</div>
          <div className="font-bold text-blue-800 tabular-nums text-sm">
            {totalPen > 0 && <div>S/ {totalPen.toFixed(2)}</div>}
            {totalUsd > 0 && <div className="text-emerald-700">$ {totalUsd.toFixed(2)}</div>}
            {totalPen === 0 && totalUsd === 0 && <div className="text-gray-400">—</div>}
          </div>
          <div className="text-[10px] text-blue-500 mt-0.5">{allSales.length} ventas</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <div className="text-[11px] text-orange-600 font-semibold uppercase tracking-wider mb-1">En crédito</div>
          <div className="font-bold text-orange-800 tabular-nums text-sm">S/ {totalCreditAmount.toFixed(2)}</div>
          <div className="text-[10px] text-orange-500 mt-0.5">{creditSales.length} al crédito</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-[11px] text-green-600 font-semibold uppercase tracking-wider mb-1">Abonado</div>
          <div className="font-bold text-green-800 tabular-nums text-sm">S/ {totalPaidCredit.toFixed(2)}</div>
          <div className="text-[10px] text-green-500 mt-0.5">{allCredits.filter(c => c.status === 'PAID').length} cuentas pagadas</div>
        </div>
        <div className={`rounded-xl p-3 text-center ${totalPending > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${totalPending > 0 ? 'text-red-600' : 'text-gray-500'}`}>Pendiente</div>
          <div className={`font-bold tabular-nums text-sm ${totalPending > 0 ? 'text-red-700' : 'text-gray-400'}`}>S/ {totalPending.toFixed(2)}</div>
          <div className={`text-[10px] mt-0.5 ${totalPending > 0 ? 'text-red-400' : 'text-gray-400'}`}>{pendingCredits.length} cuenta{pendingCredits.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Historial de ventas */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <ShoppingBag size={14} className="text-gray-400" /> Historial de ventas
        </h3>
        {allSales.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">Sin ventas registradas</div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="w-7 px-2 py-2" />
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">N°</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allSales.map(sale => {
                  const isExp = expandedSaleId === sale.id;
                  return (
                    <React.Fragment key={sale.id}>
                      <tr className={`hover:bg-gray-50 transition-colors ${isExp ? 'bg-indigo-50/30' : ''}`}>
                        <td className="px-2 py-2 text-center">
                          {(sale.items?.length ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedSaleId(prev => prev === sale.id ? null : sale.id)}
                              className="text-gray-400 hover:text-gray-700"
                            >
                              {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-500">
                          {sale.saleNumber || `NV-${sale.id.slice(-6).toUpperCase()}`}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{formatDateEs(sale.date)}</td>
                        <td className="px-3 py-2.5">
                          {sale.voucherType === 'BOLETA'
                            ? <span className="text-primary-700 font-medium text-xs">Boleta</span>
                            : sale.voucherType === 'FACTURA'
                            ? <span className="text-blue-700 font-medium text-xs">Factura</span>
                            : <span className="text-gray-400 text-xs">{sale.voucherType || '—'}</span>}
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
                      {isExp && (sale.items?.length ?? 0) > 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 pb-3 pt-1 bg-indigo-50/20">
                            <div className="rounded-lg border border-gray-200 overflow-hidden">
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Producto</th>
                                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Cant.</th>
                                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase">P. Unit.</th>
                                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {sale.items.map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-1.5 text-gray-800">{item.productName || item.productId}</td>
                                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">{item.quantity}</td>
                                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">
                                        {sale.currency === 'USD' ? '$' : 'S/'} {(item.unitPriceUsd ?? item.unitPrice).toFixed(2)}
                                      </td>
                                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-gray-800">
                                        {sale.currency === 'USD' ? '$' : 'S/'} {(item.subtotalUsd ?? item.subtotal).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cuentas de crédito */}
      {allCredits.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CreditCard size={14} className="text-orange-400" /> Cuentas de crédito
          </h3>
          <div className="space-y-2">
            {allCredits.map(credit => {
              const isExp = expandedCreditId === credit.id;
              const badge = statusBadge(credit);
              const isPending = credit.status !== 'PAID';
              return (
                <div key={credit.id} className={`border rounded-lg overflow-hidden ${isPending ? 'border-orange-200' : 'border-gray-200'}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedCreditId(prev => prev === credit.id ? null : credit.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${isPending ? 'bg-orange-50/40' : 'bg-white'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExp ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-800 truncate block">
                          {credit.name || `Crédito — ${formatDateEs(credit.createdAt)}`}
                        </span>
                        {credit.dueDate && (
                          <span className="text-[11px] text-gray-500">Vence: {formatDateEs(credit.dueDate)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-gray-400">Pendiente</div>
                        <div className={`text-sm font-bold tabular-nums ${isPending ? 'text-red-600' : 'text-gray-400'}`}>
                          S/ {credit.pendingAmount.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-gray-400">Total</div>
                        <div className="text-sm font-semibold tabular-nums text-gray-700">S/ {credit.totalAmount.toFixed(2)}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                    </div>
                  </button>
                  {isExp && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-white space-y-3">
                      <div className="flex justify-between text-xs text-gray-600 sm:hidden mb-1">
                        <span>Total: <span className="font-semibold">S/ {credit.totalAmount.toFixed(2)}</span></span>
                        <span>Pendiente: <span className={`font-semibold ${isPending ? 'text-red-600' : ''}`}>S/ {credit.pendingAmount.toFixed(2)}</span></span>
                      </div>
                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span>Abonado: S/ {credit.paidAmount.toFixed(2)}</span>
                          <span>Total: S/ {credit.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${credit.totalAmount > 0 ? Math.min(100, (credit.paidAmount / credit.totalAmount) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                      {/* Historial de abonos */}
                      {(credit.payments?.length ?? 0) > 0 ? (
                        <div>
                          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Abonos</div>
                          <div className="space-y-1">
                            {credit.payments.map((payment, idx) => (
                              <div key={payment.id || idx} className="flex items-center justify-between py-1.5 px-3 bg-green-50 rounded-lg text-xs">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                                  <span className="text-gray-700 whitespace-nowrap">{formatDateEs(payment.paymentDate)}</span>
                                  {payment.paymentMethodName && <span className="text-gray-500">· {payment.paymentMethodName}</span>}
                                  {payment.receivedByName && <span className="text-gray-400">· {payment.receivedByName}</span>}
                                  {payment.notes && <span className="text-gray-400 italic truncate max-w-[120px]">· {payment.notes}</span>}
                                </div>
                                <span className="font-semibold tabular-nums text-green-700 ml-2">S/ {payment.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 flex items-center gap-1.5">
                          <Clock size={12} /> Sin abonos registrados
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { useSales } from '../../sales/hooks/useSales';
import { useClientCredits } from '../../credits/hooks/useCredits';
import { formatDateEs } from '../../../shared/utils/date.util';
import { ChevronDown, ChevronRight, ShoppingBag, CheckCircle2, Clock } from 'lucide-react';
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

function voucherLabel(voucherType?: string): { text: string; cls: string } {
  if (voucherType === 'BOLETA') return { text: 'Boleta', cls: 'text-primary-700 font-medium text-xs' };
  if (voucherType === 'FACTURA') return { text: 'Factura', cls: 'text-blue-700 font-medium text-xs' };
  return { text: 'N. Venta', cls: 'text-gray-400 text-xs' };
}

function statusBadge(credit: CreditAccount) {
  if (credit.status === 'PAID') return { label: 'Pagado', cls: 'bg-green-100 text-green-700' };
  if (credit.status === 'PARTIAL') return { label: 'Parcial', cls: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Pendiente', cls: 'bg-orange-100 text-orange-700' };
}

function ClientStatementContent({ client }: { client: Client }) {
  const { data: salesData, isLoading: loadingSales } = useSales({ clientId: client.id, limit: 500, excludeCancelled: 'true' });
  const { data: creditsData, isLoading: loadingCredits } = useClientCredits(client.id, { limit: 200 });
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const allSales: Sale[] = useMemo(
    () => ((salesData as any)?.data || []).slice().sort((a: Sale, b: Sale) => b.date.localeCompare(a.date)),
    [salesData],
  );

  const allCredits: CreditAccount[] = useMemo(
    () => (Array.isArray(creditsData) ? creditsData : ((creditsData as any)?.data || []))
      .filter((c: CreditAccount) => c.totalAmount > 0),
    [creditsData],
  );

  // Map saleId → CreditAccount for O(1) lookup in each row
  const creditBySaleId = useMemo(() => {
    const map = new Map<string, CreditAccount>();
    allCredits.forEach(credit => {
      (credit.saleIds || []).forEach(saleId => map.set(saleId, credit));
    });
    return map;
  }, [allCredits]);

  const sym = (sale: Sale) => sale.currency === 'USD' ? '$' : 'S/';
  const dispTotal = (sale: Sale) => sale.currency === 'USD' && sale.totalUsd != null ? sale.totalUsd : sale.total;

  const totalPen = allSales.filter(s => s.currency !== 'USD').reduce((a, s) => a + s.total, 0);
  const totalUsd = allSales.filter(s => s.currency === 'USD').reduce((a, s) => a + dispTotal(s), 0);
  const creditSales = allSales.filter(s => s.isCredit);
  const pendingCredits = allCredits.filter(c => c.status !== 'PAID');
  const totalPending = pendingCredits.reduce((a, c) => a + c.pendingAmount, 0);
  const totalPaidCredit = allCredits.reduce((a, c) => a + c.paidAmount, 0);
  const totalCreditAmount = allCredits.reduce((a, c) => a + c.totalAmount, 0);

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
          <div className="text-[11px] text-blue-600 font-semibold uppercase tracking-wider mb-1">Total ventas</div>
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
                  const credit = creditBySaleId.get(sale.id);
                  const hasItems = (sale.items?.length ?? 0) > 0;
                  const isExpandable = hasItems || (sale.isCredit && !!credit);
                  const label = voucherLabel(sale.voucherType);
                  const currSym = sym(sale);

                  return (
                    <React.Fragment key={sale.id}>
                      <tr className={`hover:bg-gray-50 transition-colors ${isExp ? 'bg-indigo-50/30' : ''}`}>
                        <td className="px-2 py-2 text-center">
                          {isExpandable && (
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
                          <span className={label.cls}>{label.text}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
                          <span className={sale.currency === 'USD' ? 'text-emerald-700' : 'text-gray-800'}>
                            {currSym} {dispTotal(sale).toFixed(2)}
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

                      {isExp && isExpandable && (
                        <tr>
                          <td colSpan={6} className="px-4 pb-3 pt-1 bg-indigo-50/20">
                            <div className="space-y-2">

                              {/* Tabla de productos */}
                              {hasItems && (
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
                                            {currSym} {(item.unitPriceUsd ?? item.unitPrice).toFixed(2)}
                                          </td>
                                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-gray-800">
                                            {currSym} {(item.subtotalUsd ?? item.subtotal).toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Sección de cuenta por cobrar */}
                              {sale.isCredit && credit && (() => {
                                const badge = statusBadge(credit);
                                const isPending = credit.status !== 'PAID';
                                const pct = credit.totalAmount > 0
                                  ? Math.min(100, (credit.paidAmount / credit.totalAmount) * 100)
                                  : 0;
                                const initialAmount = (sale.payments || []).reduce((s, p) => s + p.amount, 0);

                                return (
                                  <div className={`rounded-lg border overflow-hidden ${isPending ? 'border-orange-200' : 'border-green-200'}`}>
                                    {/* Header */}
                                    <div className={`px-3 py-2 flex items-center justify-between ${isPending ? 'bg-orange-50' : 'bg-green-50'}`}>
                                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${isPending ? 'text-orange-700' : 'text-green-700'}`}>
                                        Cuenta por cobrar
                                      </span>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                                    </div>

                                    <div className="px-3 py-2.5 bg-white space-y-2.5">
                                      {/* Montos */}
                                      <div className="grid grid-cols-4 gap-2 text-xs">
                                        <div>
                                          <div className="text-[10px] text-gray-400 mb-0.5">Total</div>
                                          <div className="font-semibold text-gray-800 tabular-nums">{currSym} {dispTotal(sale).toFixed(2)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] text-gray-400 mb-0.5">Inicial</div>
                                          <div className="font-semibold text-blue-600 tabular-nums">
                                            {initialAmount > 0 ? `${currSym} ${initialAmount.toFixed(2)}` : '—'}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] text-gray-400 mb-0.5">Abonos</div>
                                          <div className="font-semibold text-green-600 tabular-nums">S/ {credit.paidAmount.toFixed(2)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] text-gray-400 mb-0.5">Pendiente</div>
                                          <div className={`font-bold tabular-nums ${isPending ? 'text-red-600' : 'text-gray-400'}`}>
                                            S/ {credit.pendingAmount.toFixed(2)}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Barra de progreso */}
                                      <div>
                                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-green-500 rounded-full transition-all"
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                                          <span>{pct.toFixed(0)}% abonado</span>
                                          {credit.dueDate && <span>Vence: {formatDateEs(credit.dueDate)}</span>}
                                        </div>
                                      </div>

                                      {/* Abonos */}
                                      {(credit.payments?.length ?? 0) > 0 ? (
                                        <div>
                                          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Abonos</div>
                                          <div className="space-y-1">
                                            {credit.payments.map((payment, idx) => (
                                              <div key={payment.id || idx} className="flex items-center justify-between py-1 px-2.5 bg-green-50 rounded-md text-xs">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                  <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" />
                                                  <span className="text-gray-700 whitespace-nowrap">{formatDateEs(payment.paymentDate)}</span>
                                                  {payment.paymentMethodName && <span className="text-gray-500">· {payment.paymentMethodName}</span>}
                                                  {payment.receivedByName && <span className="text-gray-400 truncate">· {payment.receivedByName}</span>}
                                                  {payment.notes && <span className="text-gray-400 italic truncate max-w-[100px]">· {payment.notes}</span>}
                                                </div>
                                                <span className="font-semibold tabular-nums text-green-700 ml-2 flex-shrink-0">S/ {payment.amount.toFixed(2)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                          <Clock size={11} /> Sin abonos registrados
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}

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
    </div>
  );
}

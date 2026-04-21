import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClientCredits } from '../hooks/useCredits';
import { useClients } from '../../clients/hooks/useClients';
import { Pagination } from '../../../shared/components/Pagination';
import { BatchPaymentModal } from '../components/BatchPaymentModal';
import { ArrowLeft, DollarSign, ShoppingBag, Layers } from 'lucide-react';
import type { CreditAccount, CreditPayment, Client } from '../../../shared/types';

interface TransactionGroup {
  groupId: string;
  paymentDate: string;
  paymentMethodName?: string;
  notes?: string;
  receivedByName?: string;
  total: number;
  breakdown: Array<{ creditId: string; creditName: string; amount: number }>;
}

export function ClientCreditDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [showBatch, setShowBatch] = useState(false);

  const { data, isLoading } = useClientCredits(clientId!, { page, limit: 20 });
  const { data: clientsData } = useClients({ limit: 200 });

  const credits: CreditAccount[] = data?.data || [];
  const total = data?.total || 0;
  const clients = clientsData?.data || [];
  const client = clients.find((c: Client) => c.id === clientId);

  const totalPending = credits.reduce((sum, c) => sum + c.pendingAmount, 0);
  const totalDebt = credits.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalPaid = credits.reduce((sum, c) => sum + c.paidAmount, 0);
  const openCredits = credits.filter((c) => c.status !== 'PAID');

  const transactionGroups: TransactionGroup[] = useMemo(() => {
    const byGroup = new Map<string, TransactionGroup>();
    for (const credit of credits) {
      for (const payment of credit.payments || []) {
        if (!payment.paymentGroupId) continue;
        const existing = byGroup.get(payment.paymentGroupId);
        const slice = {
          creditId: credit.id,
          creditName: credit.name || 'Sin nombre',
          amount: payment.amount,
        };
        if (existing) {
          existing.total += payment.amount;
          existing.breakdown.push(slice);
        } else {
          byGroup.set(payment.paymentGroupId, {
            groupId: payment.paymentGroupId,
            paymentDate: payment.paymentDate,
            paymentMethodName: payment.paymentMethodName,
            notes: payment.notes,
            receivedByName: payment.receivedByName,
            total: payment.amount,
            breakdown: [slice],
          });
        }
      }
    }
    return Array.from(byGroup.values())
      .filter((g) => g.breakdown.length > 1)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [credits]);

  const groupSizeById = useMemo(() => {
    const map = new Map<string, number>();
    for (const credit of credits) {
      for (const p of credit.payments || []) {
        if (!p.paymentGroupId) continue;
        map.set(p.paymentGroupId, (map.get(p.paymentGroupId) || 0) + 1);
      }
    }
    return map;
  }, [credits]);

  const statusLabels: Record<string, { label: string; class: string }> = {
    PENDING: { label: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' },
    PARTIAL: { label: 'Parcial', class: 'bg-blue-100 text-blue-800' },
    PAID: { label: 'Pagado', class: 'bg-primary-100 text-primary-800' },
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/credits')} className="text-gray-500 hover:text-gray-700"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold text-gray-800">Creditos - {client?.name || 'Cliente'}</h1>
        <div className="ml-auto">
          {openCredits.length > 0 && (
            <button
              onClick={() => setShowBatch(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium shadow-sm"
            >
              <DollarSign size={16} /> Pagar al cliente
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg"><div className="text-sm text-gray-500">Total en Creditos</div><div className="text-lg font-bold">S/ {totalDebt.toFixed(2)}</div></div>
        <div className="bg-primary-50 p-4 rounded-lg"><div className="text-sm text-primary-600">Total Pagado</div><div className="text-lg font-bold text-primary-600">S/ {totalPaid.toFixed(2)}</div></div>
        <div className="bg-red-50 p-4 rounded-lg"><div className="text-sm text-red-600">Total Pendiente</div><div className="text-lg font-bold text-red-600">S/ {totalPending.toFixed(2)}</div></div>
      </div>

      {transactionGroups.length > 0 && (
        <div className="mb-6 bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
            <Layers size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-gray-700">Transacciones grupales</span>
            <span className="text-xs text-gray-400">({transactionGroups.length})</span>
          </div>
          <div className="divide-y divide-gray-100">
            {transactionGroups.map((g) => (
              <div key={g.groupId} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500">{new Date(g.paymentDate).toLocaleDateString('es-PE')}</span>
                    {g.paymentMethodName && (
                      <span className="text-xs bg-white border rounded px-2 py-0.5 text-gray-600">{g.paymentMethodName}</span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 rounded px-2 py-0.5 font-medium">
                      <Layers size={10} /> {g.breakdown.length} cuentas
                    </span>
                  </div>
                  <div className="text-lg font-bold text-primary-700">S/ {g.total.toFixed(2)}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.breakdown.map((b, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 rounded-md px-2 py-1">
                      <span className="font-medium">{b.creditName}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-primary-700 font-semibold">S/ {b.amount.toFixed(2)}</span>
                    </span>
                  ))}
                </div>
                {(g.notes || g.receivedByName) && (
                  <div className="mt-1 text-xs text-gray-400 flex items-center gap-3">
                    {g.notes && <span>{g.notes}</span>}
                    {g.receivedByName && <span>por {g.receivedByName}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {credits.map((credit) => {
          const st = statusLabels[credit.status] || { label: credit.status, class: 'bg-gray-100' };
          return (
            <div key={credit.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.class}`}>{st.label}</span>
                  <span className="text-sm text-gray-500">{new Date(credit.createdAt).toLocaleDateString('es-PE')}</span>
                  {credit.name && <span className="text-sm font-medium text-gray-700">· {credit.name}</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">Total: <span className="font-bold">S/ {credit.totalAmount.toFixed(2)}</span></span>
                  <span className="text-sm text-red-600">Pendiente: <span className="font-bold">S/ {credit.pendingAmount.toFixed(2)}</span></span>
                </div>
              </div>

              {credit.saleDetails && credit.saleDetails.length > 0 && (
                <div className="mb-3 space-y-2">
                  {credit.saleDetails.map((sale, sIdx) => (
                    <div key={sIdx} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <ShoppingBag size={12} /> Venta {sIdx + 1} — {new Date(sale.date).toLocaleDateString('es-PE')} · S/ {sale.total.toFixed(2)}
                      </div>
                      <div className="border rounded overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">Producto</th>
                              <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">Empresa</th>
                              <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">Cant.</th>
                              <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">P. Unit.</th>
                              <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {sale.items.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-3 py-1.5 font-medium">{item.productName}</td>
                                <td className="px-3 py-1.5 text-gray-600">{item.companyName}</td>
                                <td className="px-3 py-1.5 text-right">{item.quantity}</td>
                                <td className="px-3 py-1.5 text-right">S/ {item.unitPrice.toFixed(2)}</td>
                                <td className="px-3 py-1.5 text-right font-medium">S/ {item.subtotal.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {credit.payments.length > 0 && (
                <div className="border-t pt-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">Historial de abonos:</div>
                  <div className="space-y-1.5">
                    {credit.payments.map((p: CreditPayment, idx: number) => {
                      const groupSize = p.paymentGroupId ? groupSizeById.get(p.paymentGroupId) || 0 : 0;
                      return (
                        <div key={idx} className="flex items-center justify-between bg-primary-50 rounded px-3 py-1.5 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500">{new Date(p.paymentDate).toLocaleDateString('es-PE')}</span>
                            <span className="font-medium text-primary-700">S/ {p.amount.toFixed(2)}</span>
                            {p.paymentMethodName && (
                              <span className="text-xs bg-white border rounded px-1.5 py-0.5 text-gray-600">{p.paymentMethodName}</span>
                            )}
                            {groupSize > 1 && (
                              <span
                                className="text-[10px] inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 font-medium"
                                title="Parte de una transacción grupal"
                              >
                                <Layers size={9} /> Grupo {groupSize}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            {p.notes && <span>{p.notes}</span>}
                            {p.receivedByName && <span>por {p.receivedByName}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {credits.length === 0 && <div className="text-center py-8 text-gray-400">No hay creditos para este cliente</div>}
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      {showBatch && client && (
        <BatchPaymentModal
          isOpen={showBatch}
          onClose={() => setShowBatch(false)}
          clientId={client.id}
          clientName={client.name}
          openCredits={openCredits}
        />
      )}
    </div>
  );
}

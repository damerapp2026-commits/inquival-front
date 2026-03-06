import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClientCredits, useRegisterPayment } from '../hooks/useCredits';
import { useClients } from '../../clients/hooks/useClients';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { ArrowLeft, DollarSign, ShoppingBag } from 'lucide-react';
import type { CreditAccount, CreditPayment, Client, PaymentMethod } from '../../../shared/types';

export function ClientCreditDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditAccount | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, paymentMethodId: '', notes: '' });

  const { data, isLoading } = useClientCredits(clientId!, { page, limit: 20 });
  const { data: clientsData } = useClients({ limit: 200 });
  const { data: paymentMethodsData } = usePaymentMethods();
  const registerPayment = useRegisterPayment();

  const credits: CreditAccount[] = data?.data || [];
  const total = data?.total || 0;
  const clients = clientsData?.data || [];
  const client = clients.find((c: Client) => c.id === clientId);
  const paymentMethods: PaymentMethod[] = Array.isArray(paymentMethodsData) ? paymentMethodsData.filter((m: PaymentMethod) => m.isActive) : [];

  const totalPending = credits.reduce((sum, c) => sum + c.pendingAmount, 0);
  const totalDebt = credits.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalPaid = credits.reduce((sum, c) => sum + c.paidAmount, 0);

  const openPayment = (credit: CreditAccount) => {
    setSelectedCredit(credit);
    setPayForm({ amount: 0, paymentMethodId: paymentMethods[0]?.id || '', notes: '' });
    setShowPayModal(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    await registerPayment.mutateAsync({ creditId: selectedCredit!.id, data: payForm });
    setShowPayModal(false);
  };

  const statusLabels: Record<string, { label: string; class: string }> = {
    PENDING: { label: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' },
    PARTIAL: { label: 'Parcial', class: 'bg-blue-100 text-blue-800' },
    PAID: { label: 'Pagado', class: 'bg-green-100 text-green-800' },
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/credits')} className="text-gray-500 hover:text-gray-700"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold text-gray-800">Creditos - {client?.name || 'Cliente'}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg"><div className="text-sm text-gray-500">Total en Creditos</div><div className="text-lg font-bold">S/ {totalDebt.toFixed(2)}</div></div>
        <div className="bg-green-50 p-4 rounded-lg"><div className="text-sm text-green-600">Total Pagado</div><div className="text-lg font-bold text-green-600">S/ {totalPaid.toFixed(2)}</div></div>
        <div className="bg-red-50 p-4 rounded-lg"><div className="text-sm text-red-600">Total Pendiente</div><div className="text-lg font-bold text-red-600">S/ {totalPending.toFixed(2)}</div></div>
      </div>

      <div className="space-y-4">
        {credits.map((credit) => {
          const st = statusLabels[credit.status] || { label: credit.status, class: 'bg-gray-100' };
          return (
            <div key={credit.id} className="bg-white border rounded-lg p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.class}`}>{st.label}</span>
                  <span className="text-sm text-gray-500">{new Date(credit.createdAt).toLocaleDateString('es-PE')}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">Total: <span className="font-bold">S/ {credit.totalAmount.toFixed(2)}</span></span>
                  <span className="text-sm text-red-600">Pendiente: <span className="font-bold">S/ {credit.pendingAmount.toFixed(2)}</span></span>
                  {credit.status !== 'PAID' && (
                    <button onClick={() => openPayment(credit)} className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"><DollarSign size={14} /> Pagar</button>
                  )}
                </div>
              </div>

              {/* Detalle de la venta */}
              {credit.saleDetail && credit.saleDetail.items.length > 0 && (
                <div className="mb-3 bg-gray-50 rounded-lg p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><ShoppingBag size={12} /> Productos de la venta:</div>
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
                        {credit.saleDetail.items.map((item, idx) => (
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
              )}

              {/* Historial de pagos */}
              {credit.payments.length > 0 && (
                <div className="border-t pt-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">Historial de abonos:</div>
                  <div className="space-y-1.5">
                    {credit.payments.map((p: CreditPayment, idx: number) => (
                      <div key={idx} className="flex items-center justify-between bg-green-50 rounded px-3 py-1.5 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500">{new Date(p.paymentDate).toLocaleDateString('es-PE')}</span>
                          <span className="font-medium text-green-700">S/ {p.amount.toFixed(2)}</span>
                          {p.paymentMethodName && (
                            <span className="text-xs bg-white border rounded px-1.5 py-0.5 text-gray-600">{p.paymentMethodName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {p.notes && <span>{p.notes}</span>}
                          {p.receivedByName && <span>por {p.receivedByName}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {credits.length === 0 && <div className="text-center py-8 text-gray-400">No hay creditos para este cliente</div>}
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      {/* Modal registrar pago */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Registrar Pago">
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <div>Total del crédito: <span className="font-bold">S/ {selectedCredit?.totalAmount.toFixed(2)}</span></div>
            <div>Ya pagado: <span className="font-medium text-green-600">S/ {selectedCredit?.paidAmount.toFixed(2)}</span></div>
            <div className="font-bold text-red-600 mt-1">Pendiente: S/ {selectedCredit?.pendingAmount.toFixed(2)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
            <select value={payForm.paymentMethodId} onChange={(e) => setPayForm({ ...payForm, paymentMethodId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
              <option value="">Seleccionar método...</option>
              {paymentMethods.map((m: PaymentMethod) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto a pagar</label>
            <input type="number" min="0.01" step="0.01" max={selectedCredit?.pendingAmount} value={payForm.amount || ''} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <button type="submit" disabled={registerPayment.isPending} className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {registerPayment.isPending ? 'Registrando...' : 'Registrar Pago'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

import React, { useState } from 'react';
import { useAccountsPayable, useAccountPayableById, useRegisterAPPayment } from '../hooks/useAccountsPayable';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { FileText, DollarSign, AlertCircle, Eye, Clock, CheckCircle } from 'lucide-react';
import type { AccountPayable, AccountPayableInstallment, AccountPayablePayment } from '../../../shared/types';

export function AccountsPayablePage() {
  const [page, setPage] = useState(1);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedAP, setSelectedAP] = useState<AccountPayable | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, notes: '' });

  const { data, isLoading } = useAccountsPayable({ page, limit: 20, supplier: supplierFilter || undefined, status: statusFilter || undefined });
  const { data: detailAP } = useAccountPayableById(viewingId);
  const registerPayment = useRegisterAPPayment();

  const items = data?.data || [];
  const total = data?.total || 0;

  const getNextInstallment = (ap: AccountPayable) => {
    if (ap.paymentScheduleType === 'INSTALLMENTS' && ap.installments?.length) {
      return ap.installments.find(i => i.status === 'PENDING') || null;
    }
    return null;
  };

  const openPayment = (ap: AccountPayable) => {
    setSelectedAP(ap);
    const nextInst = getNextInstallment(ap);
    setPayForm({ amount: nextInst ? nextInst.amount : 0, notes: '' });
    setShowPayModal(true);
  };

  const nextInstallment = selectedAP ? getNextInstallment(selectedAP) : null;
  const exceedsPending = selectedAP ? payForm.amount > selectedAP.pendingAmount : false;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exceedsPending) return;
    await registerPayment.mutateAsync({ apId: selectedAP!.id, data: payForm });
    setShowPayModal(false);
  };

  const statusLabels: Record<string, { label: string; class: string }> = {
    PENDING: { label: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' },
    PARTIAL: { label: 'Parcial', class: 'bg-blue-100 text-blue-800' },
    PAID: { label: 'Pagado', class: 'bg-primary-100 text-primary-800' },
  };

  const getDueDateColor = (ap: AccountPayable) => {
    if (ap.status === 'PAID') return 'text-primary-600';
    const due = ap.paymentScheduleType === 'INSTALLMENTS'
      ? ap.installments?.find(i => i.status === 'PENDING')?.dueDate
      : ap.dueDate;
    if (!due) return 'text-gray-500';
    const now = new Date();
    const dueDate = new Date(due);
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'text-red-600 font-bold';
    if (diffDays <= 3) return 'text-yellow-600 font-medium';
    return 'text-primary-600';
  };

  const getNextDueDate = (ap: AccountPayable) => {
    if (ap.paymentScheduleType === 'INSTALLMENTS') {
      const next = ap.installments?.find(i => i.status === 'PENDING');
      return next ? new Date(next.dueDate).toLocaleDateString('es-PE') : '-';
    }
    return ap.dueDate ? new Date(ap.dueDate).toLocaleDateString('es-PE') : '-';
  };

  const columns = [
    { key: 'supplier', header: 'Proveedor' },
    { key: 'createdAt', header: 'Fecha', render: (item: AccountPayable) => new Date(item.createdAt).toLocaleDateString('es-PE') },
    { key: 'totalAmount', header: 'Total', render: (item: AccountPayable) => `S/ ${item.totalAmount.toFixed(2)}` },
    { key: 'paidAmount', header: 'Pagado', render: (item: AccountPayable) => <span className="text-primary-600">S/ {item.paidAmount.toFixed(2)}</span> },
    { key: 'pendingAmount', header: 'Pendiente', render: (item: AccountPayable) => <span className="text-red-600 font-medium">S/ {item.pendingAmount.toFixed(2)}</span> },
    { key: 'dueDate', header: 'Vencimiento', render: (item: AccountPayable) => (
      <span className={getDueDateColor(item)}>{getNextDueDate(item)}</span>
    )},
    { key: 'status', header: 'Estado', render: (item: AccountPayable) => {
      const st = statusLabels[item.status] || { label: item.status, class: 'bg-gray-100 text-gray-800' };
      return <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.class}`}>{st.label}</span>;
    }},
    { key: 'actions', header: 'Acciones', render: (item: AccountPayable) => (
      <div className="flex gap-2">
        <button onClick={() => setViewingId(item.id)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs"><Eye size={14} /> Ver</button>
        {item.status !== 'PAID' && (
          <button onClick={() => openPayment(item)} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs"><DollarSign size={14} /> Pagar</button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FileText size={24} /> Cuentas por Pagar</h1>
      </div>
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <input value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }} placeholder="Buscar proveedor..." className="px-3 py-2 border rounded-lg text-sm" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="PARTIAL">Parcial</option>
          <option value="PAID">Pagado</option>
        </select>
      </div>
      <DataTable columns={columns} data={items} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      {/* Payment Modal */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Registrar Pago a Proveedor">
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
            <div className="font-medium text-gray-700 mb-1">{selectedAP?.supplier}</div>
            <div>Total deuda: S/ {selectedAP?.totalAmount.toFixed(2)}</div>
            <div>Pagado: S/ {selectedAP?.paidAmount.toFixed(2)}</div>
            <div className="font-bold text-red-600">Pendiente total: S/ {selectedAP?.pendingAmount.toFixed(2)}</div>
            {nextInstallment && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="font-medium text-blue-700">Proxima cuota: S/ {nextInstallment.amount.toFixed(2)}</div>
                <div className="text-xs text-gray-500">Vence: {new Date(nextInstallment.dueDate).toLocaleDateString('es-PE')}</div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto a pagar</label>
            <input type="number" min="0.01" step="0.01" max={selectedAP?.pendingAmount} value={payForm.amount || ''} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg ${exceedsPending ? 'border-red-500' : ''}`} required />
            {exceedsPending && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> El monto no puede exceder el pendiente (S/ {selectedAP?.pendingAmount.toFixed(2)})</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <button type="submit" disabled={exceedsPending || registerPayment.isPending} className={`w-full py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${exceedsPending ? 'bg-gray-400' : 'bg-primary-600 hover:bg-primary-700'}`}>{registerPayment.isPending ? 'Registrando...' : 'Registrar Pago'}</button>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!viewingId} onClose={() => setViewingId(null)} title="Detalle - Cuenta por Pagar">
        {detailAP && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Proveedor</span>
                <span className="text-sm font-medium">{detailAP.supplier}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Estado</span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(statusLabels[detailAP.status] || { class: '' }).class}`}>
                  {(statusLabels[detailAP.status] || { label: detailAP.status }).label}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Total</span>
                <span className="text-sm font-bold">S/ {detailAP.totalAmount.toFixed(2)}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Pendiente</span>
                <span className="text-sm font-bold text-red-600">S/ {detailAP.pendingAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Installments */}
            {detailAP.paymentScheduleType === 'INSTALLMENTS' && detailAP.installments.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Cuotas</h3>
                <div className="space-y-2">
                  {detailAP.installments.map((inst: AccountPayableInstallment, idx: number) => (
                    <div key={inst.id || idx} className={`flex items-center justify-between p-2 rounded-lg border ${inst.status === 'PAID' ? 'bg-primary-50 border-primary-200' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        {inst.status === 'PAID' ? <CheckCircle size={14} className="text-primary-500" /> : <Clock size={14} className="text-gray-400" />}
                        <span className="text-sm">Cuota {idx + 1}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">S/ {inst.amount.toFixed(2)}</div>
                        <div className={`text-xs ${inst.status === 'PAID' ? 'text-primary-600' : 'text-gray-500'}`}>
                          {inst.status === 'PAID' ? `Pagada ${inst.paidDate ? new Date(inst.paidDate).toLocaleDateString('es-PE') : ''}` : `Vence: ${new Date(inst.dueDate).toLocaleDateString('es-PE')}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Single date */}
            {detailAP.paymentScheduleType === 'SINGLE_DATE' && detailAP.dueDate && (
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Fecha de vencimiento</span>
                <span className={`text-sm font-medium ${getDueDateColor(detailAP)}`}>
                  {new Date(detailAP.dueDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}

            {/* Payment History */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Historial de Pagos ({detailAP.payments.length})</h3>
              {detailAP.payments.length === 0 ? (
                <p className="text-sm text-gray-400">Sin pagos registrados</p>
              ) : (
                <div className="space-y-2">
                  {detailAP.payments.map((p: AccountPayablePayment, idx: number) => (
                    <div key={p.id || idx} className="flex items-center justify-between p-2 bg-primary-50 rounded-lg border border-primary-200">
                      <div>
                        <div className="text-sm font-medium text-primary-700">S/ {p.amount.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">{new Date(p.paymentDate).toLocaleDateString('es-PE')}{p.registeredByName ? ` - ${p.registeredByName}` : ''}</div>
                      </div>
                      {p.notes && <div className="text-xs text-gray-500 max-w-[200px] truncate">{p.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

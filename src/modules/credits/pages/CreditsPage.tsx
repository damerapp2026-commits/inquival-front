import React, { useState } from 'react';
import { useCredits, useRegisterPayment, useEditCredit, useDeleteCredit } from '../hooks/useCredits';
import { useClients } from '../../clients/hooks/useClients';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { CreditCard, DollarSign, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CreditAccount, Client, PaymentMethod } from '../../../shared/types';

export function CreditsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditAccount | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, paymentMethodId: '', notes: '' });
  const [editAmount, setEditAmount] = useState(0);

  const { data, isLoading } = useCredits({ page, limit: 20, clientId: clientFilter || undefined, status: statusFilter || undefined });
  const { data: clientsData } = useClients({ limit: 200 });
  const { data: paymentMethodsData } = usePaymentMethods();
  const registerPayment = useRegisterPayment();
  const editCreditMutation = useEditCredit();
  const deleteCreditMutation = useDeleteCredit();

  const credits = data?.data || [];
  const total = data?.total || 0;
  const clients = clientsData?.data || [];

  const paymentMethods: PaymentMethod[] = Array.isArray(paymentMethodsData) ? paymentMethodsData.filter((m: PaymentMethod) => m.isActive) : [];

  const getClientName = (id: string) => clients.find((c: Client) => c.id === id)?.name || 'N/A';

  const openPayment = (credit: CreditAccount) => {
    setSelectedCredit(credit);
    setPayForm({ amount: 0, paymentMethodId: paymentMethods[0]?.id || '', notes: '' });
    setShowPayModal(true);
  };

  const openEdit = (credit: CreditAccount) => {
    setSelectedCredit(credit);
    setEditAmount(credit.totalAmount);
    setShowEditModal(true);
  };

  const openDelete = (credit: CreditAccount) => {
    setSelectedCredit(credit);
    setShowDeleteModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editCreditMutation.mutateAsync({ creditId: selectedCredit!.id, data: { totalAmount: editAmount } });
    setShowEditModal(false);
  };

  const handleDelete = async () => {
    await deleteCreditMutation.mutateAsync(selectedCredit!.id);
    setShowDeleteModal(false);
  };

  const exceedsPending = selectedCredit ? payForm.amount > selectedCredit.pendingAmount : false;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exceedsPending) return;
    await registerPayment.mutateAsync({ creditId: selectedCredit!.id, data: payForm });
    setShowPayModal(false);
  };

  const statusLabels: Record<string, { label: string; class: string }> = {
    PENDING: { label: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' },
    PARTIAL: { label: 'Parcial', class: 'bg-blue-100 text-blue-800' },
    PAID: { label: 'Pagado', class: 'bg-primary-100 text-primary-800' },
  };

  const columns = [
    { key: 'clientId', header: 'Cliente', render: (item: CreditAccount) => (
      <button onClick={() => navigate(`/credits/client/${item.clientId}`)} className="text-blue-600 hover:underline">{getClientName(item.clientId)}</button>
    )},
    { key: 'createdAt', header: 'Fecha Venta', render: (item: CreditAccount) => new Date(item.createdAt).toLocaleDateString('es-PE') },
    { key: 'totalAmount', header: 'Total', render: (item: CreditAccount) => `S/ ${item.totalAmount.toFixed(2)}` },
    { key: 'paidAmount', header: 'Pagado', render: (item: CreditAccount) => <span className="text-primary-600">S/ {item.paidAmount.toFixed(2)}</span> },
    { key: 'pendingAmount', header: 'Pendiente', render: (item: CreditAccount) => <span className="text-red-600 font-medium">S/ {item.pendingAmount.toFixed(2)}</span> },
    { key: 'status', header: 'Estado', render: (item: CreditAccount) => {
      const st = statusLabels[item.status] || { label: item.status, class: 'bg-gray-100 text-gray-800' };
      return <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.class}`}>{st.label}</span>;
    }},
    { key: 'actions', header: 'Acciones', render: (item: CreditAccount) => (
      <div className="flex items-center gap-2">
        {item.status !== 'PAID' && (
          <button onClick={() => openPayment(item)} className="flex items-center gap-1 text-primary-600 hover:text-primary-800 text-sm"><DollarSign size={14} /> Pagar</button>
        )}
        <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800" title="Editar"><Edit2 size={14} /></button>
        <button onClick={() => openDelete(item)} className="text-red-600 hover:text-red-800" title="Eliminar"><Trash2 size={14} /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><CreditCard size={24} /> Creditos</h1>
      </div>
      <div className="mb-4 flex gap-3">
        <select value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Todos los clientes</option>
          {clients.map((c: Client) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="PARTIAL">Parcial</option>
          <option value="PAID">Pagado</option>
        </select>
      </div>
      <DataTable columns={columns} data={credits} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Registrar Pago">
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <div>Total: S/ {selectedCredit?.totalAmount.toFixed(2)}</div>
            <div>Pagado: S/ {selectedCredit?.paidAmount.toFixed(2)}</div>
            <div className="font-bold text-red-600">Pendiente: S/ {selectedCredit?.pendingAmount.toFixed(2)}</div>
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
            <input type="number" min="0.01" step="0.01" max={selectedCredit?.pendingAmount} value={payForm.amount || ''} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg ${exceedsPending ? 'border-red-500' : ''}`} required />
            {exceedsPending && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> El monto no puede exceder el pendiente (S/ {selectedCredit?.pendingAmount.toFixed(2)})</p>
            )}
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <button type="submit" disabled={exceedsPending} className={`w-full py-2 text-white rounded-lg ${exceedsPending ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'}`}>Registrar Pago</button>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Crédito">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <div>Cliente: <span className="font-medium">{selectedCredit ? getClientName(selectedCredit.clientId) : ''}</span></div>
            <div>Monto actual: <span className="font-medium">S/ {selectedCredit?.totalAmount.toFixed(2)}</span></div>
            <div>Pagado: <span className="text-primary-600 font-medium">S/ {selectedCredit?.paidAmount.toFixed(2)}</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo monto total</label>
            <input
              type="number"
              min={selectedCredit?.paidAmount || 0.01}
              step="0.01"
              value={editAmount || ''}
              onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
            {selectedCredit && editAmount < selectedCredit.paidAmount && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> No puede ser menor al monto ya pagado (S/ {selectedCredit.paidAmount.toFixed(2)})</p>
            )}
          </div>
          <button
            type="submit"
            disabled={!!(selectedCredit && editAmount < selectedCredit.paidAmount)}
            className={`w-full py-2 text-white rounded-lg ${selectedCredit && editAmount < selectedCredit.paidAmount ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Guardar Cambio
          </button>
        </form>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar Crédito">
        <div className="space-y-4">
          <div className="bg-red-50 p-3 rounded-lg text-sm text-red-800">
            <p className="font-medium">¿Estás seguro de eliminar este crédito?</p>
            <p className="mt-1">Esta acción no se puede deshacer.</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <div>Cliente: <span className="font-medium">{selectedCredit ? getClientName(selectedCredit.clientId) : ''}</span></div>
            <div>Total: <span className="font-medium">S/ {selectedCredit?.totalAmount.toFixed(2)}</span></div>
            <div>Pagado: <span className="text-primary-600">S/ {selectedCredit?.paidAmount.toFixed(2)}</span></div>
            <div>Pendiente: <span className="text-red-600 font-medium">S/ {selectedCredit?.pendingAmount.toFixed(2)}</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Eliminar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

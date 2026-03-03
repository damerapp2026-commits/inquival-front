import React, { useState } from 'react';
import { useCredits, useRegisterPayment } from '../hooks/useCredits';
import { useClients } from '../../clients/hooks/useClients';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { CreditCard, DollarSign, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CreditAccount, Client } from '../../../shared/types';

export function CreditsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditAccount | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, notes: '' });

  const { data, isLoading } = useCredits({ page, limit: 20, clientId: clientFilter || undefined, status: statusFilter || undefined });
  const { data: clientsData } = useClients({ limit: 200 });
  const registerPayment = useRegisterPayment();

  const credits = data?.data || [];
  const total = data?.total || 0;
  const clients = clientsData?.data || [];

  const getClientName = (id: string) => clients.find((c: Client) => c.id === id)?.name || 'N/A';

  const openPayment = (credit: CreditAccount) => {
    setSelectedCredit(credit);
    setPayForm({ amount: 0, notes: '' });
    setShowPayModal(true);
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
    PAID: { label: 'Pagado', class: 'bg-green-100 text-green-800' },
  };

  const columns = [
    { key: 'clientId', header: 'Cliente', render: (item: CreditAccount) => (
      <button onClick={() => navigate(`/credits/client/${item.clientId}`)} className="text-blue-600 hover:underline">{getClientName(item.clientId)}</button>
    )},
    { key: 'createdAt', header: 'Fecha Venta', render: (item: CreditAccount) => new Date(item.createdAt).toLocaleDateString('es-PE') },
    { key: 'totalAmount', header: 'Total', render: (item: CreditAccount) => `S/ ${item.totalAmount.toFixed(2)}` },
    { key: 'paidAmount', header: 'Pagado', render: (item: CreditAccount) => <span className="text-green-600">S/ {item.paidAmount.toFixed(2)}</span> },
    { key: 'pendingAmount', header: 'Pendiente', render: (item: CreditAccount) => <span className="text-red-600 font-medium">S/ {item.pendingAmount.toFixed(2)}</span> },
    { key: 'status', header: 'Estado', render: (item: CreditAccount) => {
      const st = statusLabels[item.status] || { label: item.status, class: 'bg-gray-100 text-gray-800' };
      return <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.class}`}>{st.label}</span>;
    }},
    { key: 'actions', header: 'Acciones', render: (item: CreditAccount) => item.status !== 'PAID' ? (
      <button onClick={() => openPayment(item)} className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm"><DollarSign size={14} /> Pagar</button>
    ) : null },
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto a pagar</label>
            <input type="number" min="0.01" step="0.01" max={selectedCredit?.pendingAmount} value={payForm.amount || ''} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg ${exceedsPending ? 'border-red-500' : ''}`} required />
            {exceedsPending && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> El monto no puede exceder el pendiente (S/ {selectedCredit?.pendingAmount.toFixed(2)})</p>
            )}
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <button type="submit" disabled={exceedsPending} className={`w-full py-2 text-white rounded-lg ${exceedsPending ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>Registrar Pago</button>
        </form>
      </Modal>
    </div>
  );
}

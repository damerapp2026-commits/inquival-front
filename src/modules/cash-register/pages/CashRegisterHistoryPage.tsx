import React, { useState } from 'react';
import { useCashRegisters, useCashRegisterById } from '../hooks/useCashRegister';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { Modal } from '../../../shared/components/Modal';
import { History } from 'lucide-react';
import type { CashRegister, CashRegisterEntry } from '../../../shared/types';

export function CashRegisterHistoryPage() {
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  const { data, isLoading } = useCashRegisters({ page, limit: 20, startDate: startDate || undefined, endDate: endDate || undefined });
  const { data: detail } = useCashRegisterById(selectedId);

  const registers = data?.data || [];
  const total = data?.total || 0;

  const openDetail = (reg: CashRegister) => { setSelectedId(reg.id); setShowDetail(true); };

  const categoryLabels: Record<string, string> = { SALE: 'Venta', CREDIT_PAYMENT: 'Pago Credito', PURCHASE: 'Compra', ADJUSTMENT: 'Ajuste', OTHER: 'Otro' };

  const columns = [
    { key: 'date', header: 'Fecha', render: (item: CashRegister) => item.date },
    { key: 'openingBalance', header: 'Balance Apertura', render: (item: CashRegister) => `S/ ${item.openingBalance.toFixed(2)}` },
    { key: 'income', header: 'Ingresos', render: (item: CashRegister) => {
      const active = item.entries.filter(e => !e.isDeleted);
      const income = active.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
      return <span className="text-green-600">S/ {income.toFixed(2)}</span>;
    }},
    { key: 'expense', header: 'Egresos', render: (item: CashRegister) => {
      const active = item.entries.filter(e => !e.isDeleted);
      const expense = active.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
      return <span className="text-red-600">S/ {expense.toFixed(2)}</span>;
    }},
    { key: 'closingBalance', header: 'Balance Cierre', render: (item: CashRegister) => item.closingBalance != null ? `S/ ${item.closingBalance.toFixed(2)}` : '-' },
    { key: 'status', header: 'Estado', render: (item: CashRegister) => <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'CLOSED' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{item.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}</span> },
    { key: 'actions', header: '', render: (item: CashRegister) => <button onClick={() => openDetail(item)} className="text-blue-600 hover:text-blue-800 text-sm">Ver detalle</button> },
  ];

  const detailEntries: CashRegisterEntry[] = detail?.entries || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><History size={24} /> Historial de Cajas</h1>
      </div>
      <div className="mb-4 flex gap-3 items-center">
        <div><label className="block text-xs text-gray-500 mb-1">Desde</label><input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Hasta</label><input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm" /></div>
        {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }} className="mt-4 text-sm text-gray-500 hover:text-gray-700">Limpiar</button>}
      </div>
      <DataTable columns={columns} data={registers} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`Caja - ${detail?.date || ''}`}>
        <div className="space-y-4">
          <div className="flex gap-2 items-center text-sm">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${detail?.status === 'CLOSED' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{detail?.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}</span>
            {detail?.notes && <span className="text-gray-500">Notas: {detail.notes}</span>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Categoria</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Descripcion</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {detailEntries.map((e) => (
                  <tr key={e.id} className={e.isDeleted ? 'opacity-40 line-through' : ''}>
                    <td className="px-3 py-2"><span className={`text-xs ${e.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>{e.type === 'INCOME' ? 'Ingreso' : 'Egreso'}</span></td>
                    <td className="px-3 py-2 text-xs">{categoryLabels[e.category] || e.category}</td>
                    <td className="px-3 py-2 text-xs">{e.description}</td>
                    <td className={`px-3 py-2 text-right ${e.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>S/ {e.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-lg">
            <div>Apertura: <span className="font-medium">S/ {(detail?.openingBalance || 0).toFixed(2)}</span></div>
            <div>Cierre: <span className="font-medium">S/ {(detail?.closingBalance || 0).toFixed(2)}</span></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

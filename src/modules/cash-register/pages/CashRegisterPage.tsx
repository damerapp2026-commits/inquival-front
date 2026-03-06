import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCashRegisterToday, useOpenCashRegister, useAddCashEntry, useEditCashEntry, useDeleteCashEntry, useCloseCashRegister } from '../hooks/useCashRegister';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { Modal } from '../../../shared/components/Modal';
import { Wallet, TrendingUp, TrendingDown, Edit2, Trash2, Lock, History } from 'lucide-react';
import type { CashRegisterEntry } from '../../../shared/types';

export function CashRegisterPage() {
  const { data: register, isLoading } = useCashRegisterToday();
  const openCashRegister = useOpenCashRegister();
  const addEntry = useAddCashEntry();
  const editEntry = useEditCashEntry();
  const deleteEntryMutation = useDeleteCashEntry();
  const closeRegister = useCloseCashRegister();

  const [openingAmount, setOpeningAmount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CashRegisterEntry | null>(null);

  const { data: paymentMethods = [] } = usePaymentMethods();
  const [addForm, setAddForm] = useState({ type: 'INCOME' as string, category: 'OTHER' as string, description: '', amount: 0, hasBoleta: false, paymentMethodName: '' });
  const [editForm, setEditForm] = useState({ amount: 0, reason: '', hasBoleta: false });
  const [deleteReason, setDeleteReason] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const isClosed = register?.status === 'CLOSED';
  const entries: CashRegisterEntry[] = register?.entries || [];
  const activeEntries = entries.filter(e => !e.isDeleted);
  const totalIncome = activeEntries.filter(e => e.type === 'INCOME').reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = activeEntries.filter(e => e.type === 'EXPENSE').reduce((sum, e) => sum + e.amount, 0);
  const netBalance = (register?.openingBalance || 0) + totalIncome - totalExpense;

  const openAddIncome = () => { setAddForm({ type: 'INCOME', category: 'OTHER', description: '', amount: 0, hasBoleta: false, paymentMethodName: '' }); setShowAddModal(true); };
  const openAddExpense = () => { setAddForm({ type: 'EXPENSE', category: 'OTHER', description: '', amount: 0, hasBoleta: false, paymentMethodName: 'Efectivo' }); setShowAddModal(true); };
  const openEdit = (entry: CashRegisterEntry) => { setSelectedEntry(entry); setEditForm({ amount: entry.amount, reason: '', hasBoleta: entry.hasBoleta }); setShowEditModal(true); };
  const openDelete = (entry: CashRegisterEntry) => { setSelectedEntry(entry); setDeleteReason(''); setShowDeleteModal(true); };

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    await openCashRegister.mutateAsync({ openingBalance: openingAmount });
  };
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const desc = addForm.paymentMethodName
      ? `${addForm.description} [${addForm.paymentMethodName}]`
      : addForm.description;
    const { paymentMethodName, ...rest } = addForm;
    await addEntry.mutateAsync({ registerId: register.id, data: { ...rest, description: desc } });
    setShowAddModal(false);
  };
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editEntry.mutateAsync({ registerId: register.id, entryId: selectedEntry!.id, data: editForm });
    setShowEditModal(false);
  };
  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    await deleteEntryMutation.mutateAsync({ registerId: register.id, entryId: selectedEntry!.id, data: { reason: deleteReason } });
    setShowDeleteModal(false);
  };
  const handleClose = async () => {
    await closeRegister.mutateAsync({ registerId: register.id, data: { notes: closeNotes } });
    setShowCloseModal(false);
  };

  const categoryLabels: Record<string, string> = { SALE: 'Venta', CREDIT_PAYMENT: 'Pago Credito', PURCHASE: 'Compra', ADJUSTMENT: 'Ajuste', OTHER: 'Otro' };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  // Estado: Sin caja abierta
  if (!register) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 p-4 rounded-full">
              <Wallet size={48} className="text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No hay caja abierta</h2>
          <p className="text-sm text-gray-500 mb-6">Ingresa el monto inicial para abrir la caja del dia</p>
          <form onSubmit={handleOpen} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto inicial (S/)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingAmount || ''}
                onChange={(e) => setOpeningAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border rounded-lg text-center text-lg"
                placeholder="0.00"
              />
            </div>
            <button
              type="submit"
              disabled={openCashRegister.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
            >
              <Wallet size={20} />
              {openCashRegister.isPending ? 'Abriendo...' : 'Abrir Caja'}
            </button>
          </form>
          <Link to="/cash-register/history" className="inline-flex items-center gap-2 mt-4 text-sm text-gray-500 hover:text-gray-700">
            <History size={16} /> Ver historial de cajas
          </Link>
        </div>
      </div>
    );
  }

  // Estado: Caja abierta o cerrada
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Wallet size={24} /> Caja del Día</h1>
        <div className="flex flex-wrap gap-2">
          {!isClosed && <button onClick={openAddIncome} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><TrendingUp size={18} /> Ingreso</button>}
          {!isClosed && <button onClick={openAddExpense} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"><TrendingDown size={18} /> Egreso</button>}
          {!isClosed && <button onClick={() => { setCloseNotes(''); setShowCloseModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"><Lock size={18} /> Cerrar Caja</button>}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <span className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Hoy</span>
        <Link to="/cash-register/history" className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"><History size={16} /> Historial de Cajas</Link>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <span className="text-sm text-gray-500">Fecha: <span className="font-medium text-gray-800">{register?.date}</span></span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${isClosed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{isClosed ? 'CERRADA' : 'ABIERTA'}</span>
      </div>

      <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg"><div className="text-sm text-gray-500">Balance Apertura</div><div className="text-lg font-bold">S/ {(register?.openingBalance || 0).toFixed(2)}</div></div>
        <div className="bg-green-50 p-4 rounded-lg"><div className="text-sm text-green-600">Total Ingresos</div><div className="text-lg font-bold text-green-600">+ S/ {totalIncome.toFixed(2)}</div></div>
        <div className="bg-red-50 p-4 rounded-lg"><div className="text-sm text-red-600">Total Egresos</div><div className="text-lg font-bold text-red-600">- S/ {totalExpense.toFixed(2)}</div></div>
        <div className="bg-blue-50 p-4 rounded-lg"><div className="text-sm text-blue-600">Balance Neto</div><div className="text-lg font-bold text-blue-600">S/ {netBalance.toFixed(2)}</div></div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripcion</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Boleta</th>
              {!isClosed && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...entries].reverse().map((entry) => (
              <tr key={entry.id} className={entry.isDeleted ? 'bg-red-50 opacity-50' : entry.type === 'INCOME' ? 'hover:bg-green-50' : 'hover:bg-red-50'}>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${entry.type === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {entry.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{categoryLabels[entry.category] || entry.category}</td>
                <td className="px-4 py-3 text-sm">
                  {entry.description.replace(/\s*\[.*?\]\s*$/, '')}
                  {entry.isDeleted && <span className="ml-2 text-red-500 text-xs">(Eliminado: {entry.deleteReason})</span>}
                  {entry.editHistory?.length > 0 && <span className="ml-2 text-blue-500 text-xs">(Editado {entry.editHistory.length}x)</span>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {(() => {
                    const match = entry.description.match(/\[(.+?)\]$/);
                    return match ? <span className="text-blue-600 font-medium">{match[1]}</span> : <span className="text-gray-400">-</span>;
                  })()}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${entry.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                  {entry.type === 'INCOME' ? '+' : '-'} S/ {entry.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center text-sm">{entry.hasBoleta ? 'Si' : 'No'}</td>
                {!isClosed && (
                  <td className="px-4 py-3 text-center">
                    {!entry.isDeleted && (
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => openEdit(entry)} className="text-blue-600 hover:text-blue-800"><Edit2 size={14} /></button>
                        <button onClick={() => openDelete(entry)} className="text-red-600 hover:text-red-800"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={isClosed ? 6 : 7} className="px-4 py-8 text-center text-gray-400">No hay entradas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={addForm.type === 'INCOME' ? 'Nuevo Ingreso' : 'Nuevo Egreso'}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${addForm.type === 'INCOME' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {addForm.type === 'INCOME' ? <><TrendingUp size={16} /> Registrando un ingreso</> : <><TrendingDown size={16} /> Registrando un egreso</>}
          </div>
          {addForm.type === 'INCOME' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-gray-400">Cargando métodos de pago...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((pm: { id: string; name: string }) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setAddForm({ ...addForm, paymentMethodName: pm.name })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        addForm.paymentMethodName === pm.name
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {pm.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
              <input type="number" min="0.01" step="0.01" value={addForm.amount || ''} onChange={(e) => setAddForm({ ...addForm, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" checked={addForm.hasBoleta} onChange={(e) => setAddForm({ ...addForm, hasBoleta: e.target.checked })} className="w-4 h-4 text-green-600 rounded" />
                <span className="text-sm font-medium text-gray-700">Con Boleta</span>
              </label>
            </div>
          </div>
          <button type="submit" className={`w-full py-2 text-white rounded-lg ${addForm.type === 'INCOME' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {addForm.type === 'INCOME' ? 'Registrar Ingreso' : 'Registrar Egreso'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Entrada">
        <form onSubmit={handleEdit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Monto anterior: S/ {selectedEntry?.amount.toFixed(2)}</label></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Monto</label>
            <input type="number" min="0.01" step="0.01" value={editForm.amount || ''} onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.hasBoleta} onChange={(e) => setEditForm({ ...editForm, hasBoleta: e.target.checked })} className="w-4 h-4 text-green-600 rounded" />
              <span className="text-sm font-medium text-gray-700">Con Boleta</span>
            </label>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Razon del cambio</label>
            <textarea value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} required />
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar Cambio</button>
        </form>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar Entrada">
        <form onSubmit={handleDelete} className="space-y-4">
          <p className="text-sm text-gray-600">Esta accion marcara la entrada como eliminada. No se puede deshacer.</p>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Razon de eliminacion</label>
            <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={2} required />
          </div>
          <button type="submit" className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Eliminar</button>
        </form>
      </Modal>

      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Cerrar Caja">
        {(() => {
          const methodBreakdown: Record<string, { income: number; expense: number }> = {};
          activeEntries.forEach(entry => {
            const match = entry.description.match(/\[(.+?)\]$/);
            const method = match ? match[1] : 'Sin método';
            if (!methodBreakdown[method]) methodBreakdown[method] = { income: 0, expense: 0 };
            if (entry.type === 'INCOME') methodBreakdown[method].income += entry.amount;
            else methodBreakdown[method].expense += entry.amount;
          });
          const methods = Object.entries(methodBreakdown).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense));

          return (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Al cerrar la caja no se podran agregar, editar ni eliminar entradas.</p>

              {/* Resumen general */}
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <div>Balance Apertura: S/ {(register?.openingBalance || 0).toFixed(2)}</div>
                <div className="text-green-600">+ Ingresos: S/ {totalIncome.toFixed(2)}</div>
                <div className="text-red-600">- Egresos: S/ {totalExpense.toFixed(2)}</div>
                <div className="font-bold mt-1 pt-1 border-t">Balance Cierre: S/ {netBalance.toFixed(2)}</div>
              </div>

              {/* Desglose por método de pago */}
              {methods.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Desglose por método de pago</label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Método</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-green-600">Ingresos</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-red-600">Egresos</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Neto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {methods.map(([method, totals]) => (
                          <tr key={method}>
                            <td className="px-3 py-2 font-medium">{method}</td>
                            <td className="px-3 py-2 text-right text-green-600">{totals.income > 0 ? `+ S/ ${totals.income.toFixed(2)}` : '-'}</td>
                            <td className="px-3 py-2 text-right text-red-600">{totals.expense > 0 ? `- S/ ${totals.expense.toFixed(2)}` : '-'}</td>
                            <td className="px-3 py-2 text-right font-medium">S/ {(totals.income - totals.expense).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={2} />
              </div>
              <button onClick={handleClose} className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Confirmar Cierre</button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

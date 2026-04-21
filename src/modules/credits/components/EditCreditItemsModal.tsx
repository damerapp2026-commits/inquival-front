import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { useCreditById, useEditCreditItems } from '../hooks/useCredits';
import { AlertCircle, ShoppingBag, Save } from 'lucide-react';
import type { CreditAccount } from '../../../shared/types';

interface EditableItem {
  productId: string;
  productName: string;
  companyId: string;
  companyName: string;
  priceTier: string;
  quantity: number;
  unitPrice: number;
  originalQuantity: number;
  originalUnitPrice: number;
}

interface EditableSale {
  saleId: string;
  date: Date;
  items: EditableItem[];
}

interface Props {
  credit: CreditAccount | null;
  onClose: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function EditCreditItemsModal({ credit, onClose }: Props) {
  const { data: freshCredit, isLoading } = useCreditById(credit?.id || '');
  const editItems = useEditCreditItems();
  const [sales, setSales] = useState<EditableSale[]>([]);

  const sourceCredit: CreditAccount | null = freshCredit || credit;

  useEffect(() => {
    if (!sourceCredit?.saleDetails) {
      setSales([]);
      return;
    }
    const mapped: EditableSale[] = sourceCredit.saleDetails.map((sale: any) => ({
      saleId: sale.saleId,
      date: sale.date,
      items: (sale.items || []).map((i: any) => ({
        productId: i.productId || i.product || '',
        productName: i.productName,
        companyId: i.companyId || i.company || '',
        companyName: i.companyName,
        priceTier: i.priceTier || '',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        originalQuantity: i.quantity,
        originalUnitPrice: i.unitPrice,
      })),
    }));
    setSales(mapped);
  }, [sourceCredit?.id, sourceCredit?.saleDetails?.length]);

  const totals = useMemo(() => {
    const saleTotals = sales.map((s) => ({
      saleId: s.saleId,
      total: round2(s.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)),
    }));
    const newCreditTotal = round2(saleTotals.reduce((s, x) => s + x.total, 0));
    return { saleTotals, newCreditTotal };
  }, [sales]);

  const paid = sourceCredit?.paidAmount || 0;
  const belowPaid = totals.newCreditTotal < paid;
  const hasAnyChange = sales.some((s) =>
    s.items.some((i) => i.quantity !== i.originalQuantity || i.unitPrice !== i.originalUnitPrice),
  );
  const hasInvalidItem = sales.some((s) => s.items.some((i) => i.quantity <= 0 || i.unitPrice < 0));

  const updateItem = (saleIdx: number, itemIdx: number, field: 'quantity' | 'unitPrice', value: number) => {
    setSales((prev) =>
      prev.map((s, si) =>
        si !== saleIdx
          ? s
          : {
              ...s,
              items: s.items.map((i, ii) => (ii !== itemIdx ? i : { ...i, [field]: value })),
            },
      ),
    );
  };

  const handleSave = async () => {
    if (!sourceCredit?.id) return;
    if (belowPaid) return;
    if (hasInvalidItem) return;
    if (!hasAnyChange) {
      onClose();
      return;
    }

    const changedSales = sales
      .map((s) => {
        const changed = s.items.some(
          (i) => i.quantity !== i.originalQuantity || i.unitPrice !== i.originalUnitPrice,
        );
        if (!changed) return null;
        return {
          saleId: s.saleId,
          items: s.items.map((i) => ({
            productId: i.productId,
            companyId: i.companyId,
            priceTier: i.priceTier || 'DEFAULT',
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
          })),
        };
      })
      .filter(Boolean);

    if (changedSales.length === 0) {
      onClose();
      return;
    }

    try {
      await editItems.mutateAsync({
        creditId: sourceCredit.id,
        data: { sales: changedSales },
      });
      onClose();
    } catch {
      // toast shown in hook
    }
  };

  return (
    <Modal isOpen={!!credit} onClose={onClose} title={`Editar productos — ${sourceCredit?.name || 'Crédito'}`} size="xl">
      {isLoading && !sourceCredit?.saleDetails ? (
        <div className="py-8 text-center text-gray-500 text-sm">Cargando productos…</div>
      ) : sales.length === 0 ? (
        <div className="py-10 text-center">
          <ShoppingBag size={40} className="mx-auto text-gray-300 mb-3" />
          <div className="text-gray-500 text-sm">
            No hay productos cargados para este crédito. Refresca la página si acabas de crearlo.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Pagado</div>
              <div className="text-lg font-semibold text-primary-700">S/ {paid.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total actual</div>
              <div className="text-lg font-semibold text-gray-800">S/ {(sourceCredit?.totalAmount || 0).toFixed(2)}</div>
            </div>
            <div className={`rounded-lg p-3 ${belowPaid ? 'bg-red-50' : 'bg-primary-50'}`}>
              <div className={`text-xs uppercase tracking-wide ${belowPaid ? 'text-red-700' : 'text-primary-700'}`}>Nuevo total</div>
              <div className={`text-lg font-bold ${belowPaid ? 'text-red-700' : 'text-primary-700'}`}>S/ {totals.newCreditTotal.toFixed(2)}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-xs text-orange-700 uppercase tracking-wide">Nuevo pendiente</div>
              <div className="text-lg font-bold text-orange-700">S/ {Math.max(0, round2(totals.newCreditTotal - paid)).toFixed(2)}</div>
            </div>
          </div>

          {belowPaid && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <AlertCircle size={14} />
              El nuevo total quedaría por debajo del monto ya pagado (S/ {paid.toFixed(2)}). Ajusta los items.
            </div>
          )}

          <div className="space-y-4 max-h-[55vh] overflow-y-auto scrollbar-thin pr-1">
            {sales.map((sale, sIdx) => {
              const saleTotal = totals.saleTotals.find((t) => t.saleId === sale.saleId)?.total || 0;
              return (
                <div key={sale.saleId} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-gray-600">
                      <ShoppingBag size={13} />
                      <span className="font-medium">Venta {sIdx + 1}</span>
                      <span className="text-gray-400">·</span>
                      <span>{new Date(sale.date).toLocaleDateString('es-PE')}</span>
                    </div>
                    <div className="font-semibold text-gray-800">S/ {saleTotal.toFixed(2)}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white border-b border-gray-200">
                        <tr className="text-left text-xs text-gray-500">
                          <th className="px-3 py-2 font-medium">Producto</th>
                          <th className="px-3 py-2 font-medium">Empresa</th>
                          <th className="px-3 py-2 font-medium w-28">Cantidad</th>
                          <th className="px-3 py-2 font-medium w-32">P. Unit.</th>
                          <th className="px-3 py-2 font-medium text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sale.items.map((item, iIdx) => {
                          const subtotal = round2(item.quantity * item.unitPrice);
                          const changed =
                            item.quantity !== item.originalQuantity || item.unitPrice !== item.originalUnitPrice;
                          const invalid = item.quantity <= 0 || item.unitPrice < 0;
                          return (
                            <tr key={iIdx} className={changed ? 'bg-yellow-50/40' : ''}>
                              <td className="px-3 py-2 font-medium text-gray-800">{item.productName}</td>
                              <td className="px-3 py-2 text-gray-500">{item.companyName}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  value={item.quantity || ''}
                                  onChange={(e) => updateItem(sIdx, iIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                  className={`w-24 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 ${
                                    invalid ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-primary-200'
                                  }`}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">S/</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.unitPrice || ''}
                                    onChange={(e) => updateItem(sIdx, iIdx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    className={`w-28 pl-7 pr-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 ${
                                      invalid ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-primary-200'
                                    }`}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-gray-800">S/ {subtotal.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={editItems.isPending || belowPaid || hasInvalidItem || !hasAnyChange}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                editItems.isPending || belowPaid || hasInvalidItem || !hasAnyChange
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              <Save size={14} />
              {editItems.isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

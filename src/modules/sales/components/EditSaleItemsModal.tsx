import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../../shared/components/Modal';
import { useUpdateSaleItems, useUpdateSaleDate } from '../hooks/useSales';
import { getTodayDateString, toLocalDateString } from '../../../shared/utils/date.util';
import type { Sale, Product, Company, PriceTier, PaymentMethod } from '../../../shared/types';

interface EditSaleItemsModalProps {
  sale: Sale | null;
  onClose: () => void;
  onUpdated?: (updated: Sale) => void;
  products: Product[];
  companies: Company[];
  priceTiers: PriceTier[];
  paymentMethods: PaymentMethod[];
  stockByCompanyMap: Record<string, Map<string, number>>;
}

interface DraftItem {
  productId: string;
  companyId: string;
  priceTier: string;
  quantity: number;
  unitPrice: number;
}

interface DraftPayment {
  paymentMethodId: string;
  amount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function EditSaleItemsModal({
  sale,
  onClose,
  onUpdated,
  products,
  companies,
  priceTiers,
  paymentMethods,
  stockByCompanyMap,
}: EditSaleItemsModalProps) {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [reason, setReason] = useState('');
  const [payments, setPayments] = useState<DraftPayment[]>([]);
  const [dateValue, setDateValue] = useState('');
  const [dateReason, setDateReason] = useState('');
  const updateMutation = useUpdateSaleItems();
  const updateDateMutation = useUpdateSaleDate();

  useEffect(() => {
    if (sale) {
      setItems(sale.items.map((i) => ({
        productId: i.productId,
        companyId: i.companyId,
        priceTier: i.priceTier,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })));
      setPayments((sale.payments || []).map((p) => ({
        paymentMethodId: p.paymentMethodId || '',
        amount: p.amount,
      })));
      setReason('');
      setDateValue(toLocalDateString(sale.date));
      setDateReason('');
    }
  }, [sale?.id]);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const companyById = useMemo(() => {
    const map = new Map<string, Company>();
    companies.forEach((c) => map.set(c.id, c));
    return map;
  }, [companies]);

  const tierNameById = useMemo(() => {
    const map: Record<string, string> = {};
    priceTiers.forEach((t) => { map[t.id] = t.name; });
    return map;
  }, [priceTiers]);

  const activeMethods = useMemo(() => paymentMethods.filter((m) => m.isActive), [paymentMethods]);

  const newTotal = useMemo(
    () => round2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)),
    [items],
  );

  // Cuando hay un solo pago (no mixto), su monto debe seguir al total nuevo automáticamente.
  useEffect(() => {
    if (!sale || sale.isCredit) return;
    setPayments((prev) => {
      if (prev.length !== 1) return prev;
      if (round2(prev[0].amount) === newTotal) return prev;
      return [{ ...prev[0], amount: newTotal }];
    });
  }, [newTotal, sale?.id, sale?.isCredit]);

  if (!sale) return null;

  const previousTotal = sale.total;
  const diff = round2(newTotal - previousTotal);
  const paymentsSum = round2(payments.reduce((s, p) => s + (p.amount || 0), 0));
  const paymentsMatch = paymentsSum === newTotal;
  const canEditPayments = !sale.isCredit;

  const originalPayments = sale.payments || [];
  const paymentsChanged = canEditPayments && (
    payments.length !== originalPayments.length ||
    payments.some((p, idx) => {
      const orig = originalPayments[idx];
      return !orig
        || (p.paymentMethodId || '') !== (orig.paymentMethodId || '')
        || round2(p.amount) !== round2(orig.amount);
    })
  );

  const updateItem = (idx: number, field: 'quantity' | 'unitPrice', value: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: Number.isFinite(value) && value >= 0 ? value : 0 };
      return next;
    });
  };

  const updatePayment = (idx: number, field: 'paymentMethodId' | 'amount', value: string | number) => {
    setPayments((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: field === 'amount' ? (Number.isFinite(value as number) && (value as number) >= 0 ? (value as number) : 0) : (value as string) };
      return next;
    });
  };

  const addPayment = () => {
    setPayments((prev) => [...prev, { paymentMethodId: '', amount: round2(Math.max(0, newTotal - paymentsSum)) }]);
  };

  const removePayment = (idx: number) => {
    setPayments((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  const stockAvailableFor = (item: DraftItem, originalQty: number): number | null => {
    const companyMap = stockByCompanyMap[item.companyId];
    if (!companyMap) return null;
    const baseAvailable = companyMap.get(item.productId) ?? 0;
    return round2(baseAvailable + originalQty);
  };

  const validate = (): string | null => {
    if (reason.trim().length < 5) return 'El motivo debe tener al menos 5 caracteres';
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      if (!(it.quantity > 0)) return `La cantidad del item ${idx + 1} debe ser mayor a 0`;
      if (it.unitPrice < 0) return `El precio del item ${idx + 1} no puede ser negativo`;
      const original = sale.items[idx];
      const available = stockAvailableFor(it, original.quantity);
      if (available !== null && it.quantity > available) {
        const productName = productById.get(it.productId)?.name || 'Producto';
        return `${productName}: stock insuficiente (disponible ${available}, solicitado ${it.quantity})`;
      }
    }
    if (canEditPayments) {
      if (payments.length === 0) return 'Agrega al menos un pago';
      for (let i = 0; i < payments.length; i++) {
        const p = payments[i];
        if (!p.paymentMethodId) return `Selecciona el método de pago en la fila ${i + 1}`;
        if (!(p.amount > 0)) return `El monto del pago ${i + 1} debe ser mayor a 0`;
      }
      if (!paymentsMatch) return `La suma de pagos (S/ ${paymentsSum.toFixed(2)}) debe ser igual al total nuevo (S/ ${newTotal.toFixed(2)})`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    try {
      const updated = await updateMutation.mutateAsync({
        id: sale.id,
        reason: reason.trim(),
        items: items.map((i) => ({
          productId: i.productId,
          companyId: i.companyId,
          priceTier: i.priceTier,
          quantity: round2(i.quantity),
          unitPrice: round2(i.unitPrice),
        })),
        payments: paymentsChanged ? payments.map((p) => ({ paymentMethodId: p.paymentMethodId, amount: round2(p.amount) })) : undefined,
      });
      onUpdated?.(updated);
      onClose();
    } catch {
      // toast ya disparado por el hook
    }
  };

  const currentDateValue = toLocalDateString(sale.date);
  const dateChanged = dateValue !== currentDateValue;
  const todayLocal = getTodayDateString();

  const handleDateSubmit = async () => {
    if (!dateValue) {
      toast.error('Selecciona una fecha');
      return;
    }
    if (dateValue > todayLocal) {
      toast.error('La fecha de la venta no puede ser futura');
      return;
    }
    if (dateReason.trim().length < 5) {
      toast.error('El motivo debe tener al menos 5 caracteres');
      return;
    }
    try {
      const updated = await updateDateMutation.mutateAsync({
        id: sale.id,
        date: dateValue,
        reason: dateReason.trim(),
      });
      onUpdated?.(updated);
    } catch {
      // toast ya disparado por el hook
    }
  };

  return (
    <Modal isOpen={!!sale} onClose={onClose} title={`Editar venta ${sale.saleNumber || ''}`} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Ajusta precio, cantidad y opcionalmente la distribución de pagos. Stock y caja se actualizan automáticamente; en ventas a crédito el adelanto en caja no se modifica.
        </div>

        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="text-sm font-semibold text-gray-800">Fecha de la venta</div>
          <div className="text-xs text-gray-500">
            Si la venta se digitó hoy pero corresponde a otro día, cámbiala aquí. El ingreso de caja se moverá a la caja de esa fecha (se crea cerrada si no existe).
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nueva fecha</label>
              <input
                type="date"
                value={dateValue}
                max={todayLocal}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="flex-[2]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo del cambio de fecha</label>
              <input
                type="text"
                value={dateReason}
                onChange={(e) => setDateReason(e.target.value)}
                minLength={5}
                placeholder="Ej: la venta corresponde al 08/06, se digitó tarde"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleDateSubmit}
              disabled={!dateChanged || updateDateMutation.isPending}
              className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              {updateDateMutation.isPending ? 'Guardando...' : 'Cambiar fecha'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2 text-right">Precio unit.</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it, idx) => {
                const original = sale.items[idx];
                const product = productById.get(it.productId);
                const company = companyById.get(it.companyId);
                const subtotal = round2(it.quantity * it.unitPrice);
                const available = stockAvailableFor(it, original.quantity);
                const overStock = available !== null && it.quantity > available;
                return (
                  <tr key={`${it.productId}-${it.companyId}-${it.priceTier}-${idx}`} className={overStock ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{product?.name || it.productId}</div>
                      {available !== null && (
                        <div className="text-xs text-gray-500">Disponible: {available}{overStock && <span className="text-red-600 font-semibold"> · excede stock</span>}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{company?.name || it.companyId}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{tierNameById[it.priceTier] || it.priceTier}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min={0.01}
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                        className="w-24 px-2 py-1 border rounded-md text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={it.unitPrice}
                        onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value))}
                        className="w-28 px-2 py-1 border rounded-md text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">S/ {subtotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={5} className="px-3 py-2 text-right text-xs uppercase text-gray-500">Total original</td>
                <td className="px-3 py-2 text-right text-gray-700">S/ {previousTotal.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-50">
                <td colSpan={5} className="px-3 py-2 text-right text-xs uppercase text-gray-500">Total nuevo</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-900">S/ {newTotal.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-50">
                <td colSpan={5} className="px-3 py-2 text-right text-xs uppercase text-gray-500">Diferencia</td>
                <td className={`px-3 py-2 text-right font-semibold ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                  {diff > 0 ? '+' : ''}S/ {diff.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <div className="mb-3">
            <div className="text-sm font-semibold text-gray-800">Método de pago</div>
            <div className="text-xs text-gray-500">
              {sale.isCredit
                ? 'Venta a crédito: el adelanto en caja no es editable desde aquí.'
                : 'Cambia el método o divide el cobro entre Yape, Efectivo, Transferencia, etc.'}
            </div>
          </div>

          {!canEditPayments && (
            <ul className="text-sm text-gray-700 space-y-1">
              {(sale.payments || []).length === 0 && <li className="text-gray-500 text-xs">Sin pagos registrados (venta a crédito sin adelanto).</li>}
              {(sale.payments || []).map((p, idx) => (
                <li key={`${p.paymentMethodId}-${idx}`} className="flex justify-between">
                  <span>{p.paymentMethodName || 'Método'}</span>
                  <span className="font-medium">S/ {p.amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}

          {canEditPayments && (
            <div className="space-y-2">
              {payments.map((p, idx) => {
                const isSingle = payments.length === 1;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={p.paymentMethodId}
                      onChange={(e) => updatePayment(idx, 'paymentMethodId', e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">— Método —</option>
                      {activeMethods.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min={0.01}
                      value={p.amount}
                      readOnly={isSingle}
                      title={isSingle ? 'En pago único el monto se ajusta al total automáticamente. Para repartir, usa "Agregar pago (mixto)".' : undefined}
                      onChange={(e) => updatePayment(idx, 'amount', parseFloat(e.target.value))}
                      className={`w-32 px-2 py-2 border rounded-lg text-right text-sm ${isSingle ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => removePayment(idx)}
                      disabled={payments.length === 1}
                      className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-300 px-2"
                    >
                      Quitar
                    </button>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={addPayment} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  + Agregar pago (mixto)
                </button>
                <div className={`text-xs font-semibold ${paymentsMatch ? 'text-green-700' : 'text-red-600'}`}>
                  Suma: S/ {paymentsSum.toFixed(2)} {paymentsMatch ? '✓' : `(falta S/ ${(newTotal - paymentsSum).toFixed(2)})`}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de la edición</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            minLength={5}
            placeholder="Ej: corrección de precio mal ingresado, método de pago corregido..."
            className="w-full px-3 py-2 border rounded-lg text-sm"
            required
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-semibold disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

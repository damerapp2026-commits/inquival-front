import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../../shared/components/Modal';
import { useUpdateSaleItems } from '../hooks/useSales';
import type { Sale, Product, Company, PriceTier } from '../../../shared/types';

interface EditSaleItemsModalProps {
  sale: Sale | null;
  onClose: () => void;
  onUpdated?: (updated: Sale) => void;
  products: Product[];
  companies: Company[];
  priceTiers: PriceTier[];
  stockByCompanyMap: Record<string, Map<string, number>>;
}

interface DraftItem {
  productId: string;
  companyId: string;
  priceTier: string;
  quantity: number;
  unitPrice: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function EditSaleItemsModal({
  sale,
  onClose,
  onUpdated,
  products,
  companies,
  priceTiers,
  stockByCompanyMap,
}: EditSaleItemsModalProps) {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [reason, setReason] = useState('');
  const updateMutation = useUpdateSaleItems();

  useEffect(() => {
    if (sale) {
      setItems(sale.items.map((i) => ({
        productId: i.productId,
        companyId: i.companyId,
        priceTier: i.priceTier,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })));
      setReason('');
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

  if (!sale) return null;

  const previousTotal = sale.total;
  const newTotal = round2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const diff = round2(newTotal - previousTotal);

  const updateItem = (idx: number, field: 'quantity' | 'unitPrice', value: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: Number.isFinite(value) && value >= 0 ? value : 0 };
      return next;
    });
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
      });
      onUpdated?.(updated);
      onClose();
    } catch {
      // toast ya disparado por el hook
    }
  };

  return (
    <Modal isOpen={!!sale} onClose={onClose} title={`Editar venta ${sale.saleNumber || ''}`} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Solo se permite ajustar precio y cantidad. El stock se ajusta automáticamente; la caja también, salvo en ventas a crédito (allí el entry corresponde al adelanto y no se modifica).
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de la edición</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            minLength={5}
            placeholder="Ej: corrección de precio mal ingresado, cantidad ajustada por error de tipeo..."
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

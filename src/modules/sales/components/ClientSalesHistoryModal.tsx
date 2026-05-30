import { useMemo } from 'react';
import { Eye } from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { Modal } from '../../../shared/components/Modal';
import { formatDateEs } from '../../../shared/utils/date.util';
import type { Sale, Client } from '../../../shared/types';

function saleSym(s: { currency?: string }): string { return s.currency === 'USD' ? '$' : 'S/'; }
function saleDispTotal(s: { currency?: string; total: number; totalUsd?: number }): number {
  return s.currency === 'USD' && s.totalUsd != null ? s.totalUsd : s.total;
}

interface Props {
  clientId: string;
  client?: Client;
  onClose: () => void;
  onViewSale: (sale: Sale) => void;
}

export function ClientSalesHistoryModal({ clientId, client, onClose, onViewSale }: Props) {
  const { data, isLoading } = useSales({ clientId, limit: 200, excludeCancelled: 'true' });
  const sales: Sale[] = data?.data || [];

  const totals = useMemo(() => {
    const totalAmount = sales.reduce((s, x) => s + (x.total || 0), 0);
    return { count: sales.length, totalAmount };
  }, [sales]);

  const voucherLabel = (v: string) => {
    if (v === 'BOLETA') return <span className="text-primary-700 font-medium">Boleta</span>;
    if (v === 'FACTURA') return <span className="text-blue-700 font-medium">Factura</span>;
    return <span className="text-gray-400">—</span>;
  };

  return (
    <Modal isOpen onClose={onClose} title={`Ventas de ${client?.name || 'cliente'}`} size="xl">
      <div className="space-y-3">
        {client && (
          <div className="text-xs text-gray-500">
            {client.documentNumber && <>Doc: {client.documentNumber} · </>}
            {client.phone && <>Tel: {client.phone}</>}
          </div>
        )}
        <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-primary-700">{totals.count} venta(s) registrada(s)</span>
          <span className="text-lg font-bold text-primary-700">Total: S/ {totals.totalAmount.toFixed(2)}</span>
        </div>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-gray-500">Cargando...</div>
        ) : sales.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">Este cliente aún no tiene ventas registradas.</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">N°</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Comprobante</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Items</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Pago</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">
                      {sale.saleNumber || `NV-${sale.id.slice(-8).toUpperCase()}`}
                    </td>
                    <td className="px-3 py-2">{formatDateEs(sale.date)}</td>
                    <td className="px-3 py-2">{voucherLabel(sale.voucherType)}</td>
                    <td className="px-3 py-2 text-right">{sale.items.length}</td>
                    <td className="px-3 py-2 text-right font-medium">{saleSym(sale)} {saleDispTotal(sale).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {sale.isCredit
                        ? <span className="text-orange-600 font-medium">Crédito</span>
                        : <span className="text-primary-700">{sale.payments?.map(p => p.paymentMethodName).join(' + ') || 'Efectivo'}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onViewSale(sale)}
                        className="text-primary-600 hover:text-primary-800 inline-flex items-center gap-1 text-xs font-medium"
                      >
                        <Eye size={14} /> Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

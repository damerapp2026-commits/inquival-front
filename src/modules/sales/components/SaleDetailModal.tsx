import React, { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Receipt, X, FileText, XCircle, Loader2 } from 'lucide-react';
import { useSaleById, useCancelSale, useUpdateVoucher } from '../hooks/useSales';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { useClients } from '../../clients/hooks/useClients';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { useUsers } from '../../users/hooks/useUsers';
import { useAuth } from '../../../app/providers/AuthProvider';
import { stockService } from '../../stock/services/stockService';
import { Modal } from '../../../shared/components/Modal';
import { VoucherPreviewModal, type VoucherSnapshot } from './VoucherPreviewModal';
import { EditSaleItemsModal } from './EditSaleItemsModal';
import type { Sale, SalePayment, Company, Product, Client, PriceTier, Stock } from '../../../shared/types';

interface SaleDetailModalProps {
  saleId: string | null;
  onClose: () => void;
  userRole?: string;
}

export function SaleDetailModal({ saleId, onClose, userRole }: SaleDetailModalProps) {
  const { data: sale, isLoading } = useSaleById(saleId);
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 10000 });
  const { data: clientsData } = useClients({ limit: 200 });
  const { data: priceTiers } = usePriceTiers();
  const { data: paymentMethodsData } = usePaymentMethods();
  const { data: users } = useUsers({ limit: 200 });
  const { user: currentUser } = useAuth();
  const cancelSale = useCancelSale();
  const updateVoucher = useUpdateVoucher();

  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [voucherPreview, setVoucherPreview] = useState<VoucherSnapshot | null>(null);

  const products: Product[] = Array.isArray(productsData) ? productsData : (productsData?.data || []);
  const clients: Client[] = Array.isArray(clientsData) ? clientsData : (clientsData?.data || []);
  const tiers: PriceTier[] = Array.isArray(priceTiers) ? priceTiers : [];
  const paymentMethods = Array.isArray(paymentMethodsData) ? paymentMethodsData : (paymentMethodsData?.data || []);
  const activeCompanies: Company[] = (Array.isArray(companies) ? companies : []).filter((c: Company) => c.isActive);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const companyMap = useMemo(() => new Map(activeCompanies.map((c) => [c.id, c])), [activeCompanies]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const sellerNameById = useMemo(() => {
    const raw: any = users;
    const list: any[] = Array.isArray(raw) ? raw : raw?.data || [];
    const m: Record<string, string> = {};
    list.forEach((u: any) => { m[u.id] = u.fullName || u.username || u.id; });
    if (currentUser?.id && !m[currentUser.id]) {
      m[currentUser.id] = currentUser.fullName || currentUser.username || currentUser.id;
    }
    return m;
  }, [users, currentUser]);

  // Stock por empresa — sólo se carga cuando el usuario pide editar items.
  const stockQueries = useQueries({
    queries: activeCompanies.map((c) => ({
      queryKey: ['stock', c.id],
      queryFn: () => stockService.getByCompany(c.id, { limit: 9999 }),
      enabled: editing,
      staleTime: 60_000,
    })),
  });
  const stockByCompanyMap = useMemo(() => {
    const result: Record<string, Map<string, number>> = {};
    activeCompanies.forEach((c, i) => {
      const data = stockQueries[i]?.data;
      const items: Stock[] = Array.isArray(data) ? data : (data?.data || []);
      const map = new Map<string, number>();
      items.forEach((s: Stock) => { if (s.productId) map.set(s.productId, s.quantity); });
      result[c.id] = map;
    });
    return result;
  }, [activeCompanies, stockQueries]);

  const getClientName = (id?: string) => id ? (clientMap.get(id)?.name || 'N/A') : 'Sin cliente';
  const getSellerName = (s: Sale) => s.sellerName
    || (s.sellerId ? sellerNameById[s.sellerId] : '')
    || (s.createdBy ? sellerNameById[s.createdBy] : '')
    || 'Sin asignar';
  const getSaleBaseAmount = (s: Sale) => {
    const base = s.items.reduce((sum: number, item: any) => {
      const product = productMap.get(item.productId);
      const taxType = (product as any)?.taxType || 'GRAVADO';
      const b = taxType === 'GRAVADO' ? (item.subtotal / 1.18) : item.subtotal;
      return sum + b;
    }, 0);
    return Math.round(base * 100) / 100;
  };
  const getSaleIgv = (s: Sale) => Math.round((s.total - getSaleBaseAmount(s)) * 100) / 100;

  if (!saleId) return null;

  if (isLoading || !sale) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-card-hover w-full max-w-md mx-4 p-12 flex items-center justify-center text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Cargando venta...
        </div>
      </div>
    );
  }

  const baseImponible = getSaleBaseAmount(sale);
  const igv = getSaleIgv(sale);
  const paymentLabel = sale.isCredit
    ? 'Crédito'
    : sale.payments && sale.payments.length > 0
      ? sale.payments.map((p: SalePayment) => p.paymentMethodName).join(' + ')
      : 'Efectivo';
  const voucherLabel = sale.voucherType === 'BOLETA' ? 'Boleta' : sale.voucherType === 'FACTURA' ? 'Factura' : 'Nota de venta';
  const client = sale.clientId ? clientMap.get(sale.clientId) : undefined;
  const sellerName = getSellerName(sale);

  const openVoucherPreview = () => {
    setVoucherPreview({
      id: sale.id,
      total: sale.total,
      voucherType: sale.voucherType,
      date: new Date(sale.date),
      items: sale.items.map((it: any) => ({
        name: productMap.get(it.productId)?.name || it.productName || it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.subtotal,
      })),
      payments: (sale.payments || []).map((p: SalePayment) => ({ methodName: p.paymentMethodName, amount: p.amount })),
      sellerName,
      clientName: client?.name || sale.clientName,
      clientDocument: client?.documentNumber,
      clientPhone: client?.phone,
      igv,
      baseImponible,
      voucherNumber: sale.saleNumber,
    });
  };

  return (
    <>
      {/* Main detail modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-card-hover w-full max-w-xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                <Receipt size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Detalle de venta</h2>
                <p className="text-xs text-gray-500 font-mono">{sale.saleNumber || `NV-${sale.id.slice(-8).toUpperCase()}`}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
            {/* Total cobrado */}
            <div className={`rounded-xl p-4 border ${sale.isCancelled ? 'bg-red-50 border-red-100' : 'bg-primary-50/60 border-primary-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${sale.isCancelled ? 'text-red-600' : 'text-primary-700'}`}>Total cobrado</span>
                  <div className={`text-3xl font-bold mt-1 ${sale.isCancelled ? 'text-gray-500 line-through' : 'text-gray-900'}`}>S/ {sale.total.toFixed(2)}</div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${sale.isCancelled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {sale.isCancelled ? 'Anulada' : 'Completada'}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {new Date(sale.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                {' · '}
                {new Date(sale.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {sale.isCancelled && sale.cancelReason && (
                <p className="text-xs text-red-600 mt-2">Razón: {sale.cancelReason}</p>
              )}
            </div>

            {/* Comprobante + Método de pago */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-xl p-3">
                <span className="block text-xs text-gray-500 mb-1.5">Comprobante</span>
                {sale.isCancelled ? (
                  <div className="text-sm font-medium text-gray-900">{voucherLabel}</div>
                ) : (
                  <div className="flex gap-1">
                    {([['NONE', 'No'], ['BOLETA', 'Boleta'], ['FACTURA', 'Factura']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          sale.voucherType === val
                            ? val === 'BOLETA'
                              ? 'bg-primary-600 text-white'
                              : val === 'FACTURA'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled={updateVoucher.isPending}
                        onClick={() => {
                          if (sale.voucherType !== val) {
                            updateVoucher.mutate({ id: sale.id, voucherType: val });
                          }
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="border border-gray-200 rounded-xl p-3">
                <span className="block text-xs text-gray-500 mb-1.5">Método de pago</span>
                <div className={`text-sm font-medium ${sale.isCredit ? 'text-orange-600' : 'text-gray-900'}`}>{paymentLabel}</div>
              </div>
            </div>

            {/* Cliente + Vendedor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-xl p-3">
                <span className="block text-xs text-gray-500 mb-0.5">Cliente</span>
                <div className={`text-sm font-medium truncate ${sale.clientId ? 'text-gray-900' : 'text-gray-400 italic'}`}>{getClientName(sale.clientId)}</div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3">
                <span className="block text-xs text-gray-500 mb-0.5">Vendedor</span>
                <div className="text-sm font-medium text-gray-900 truncate">{sellerName}</div>
              </div>
            </div>

            {/* Desglose de pagos (si hay >1) */}
            {!sale.isCredit && sale.payments && sale.payments.length > 1 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Desglose de pagos</span>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {sale.payments.map((payment: SalePayment, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-medium text-gray-700">{payment.paymentMethodName}</td>
                        <td className="px-4 py-2 text-right text-primary-600 font-medium">S/ {payment.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Productos */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Productos · {sale.items.length}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left font-medium">Producto</th>
                    <th className="px-2 py-2 text-right font-medium">Cant.</th>
                    <th className="px-2 py-2 text-right font-medium">P. Unit.</th>
                    <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sale.items.map((item: any, idx: number) => {
                    const product = productMap.get(item.productId);
                    const company = companyMap.get(item.companyId);
                    const tier = tiers.find((t: PriceTier) => t.id === item.priceTier);
                    return (
                      <tr key={idx}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">{product?.name || item.productName || item.productId}</div>
                          <div className="text-xs text-gray-400">{[company?.name, tier?.name].filter(Boolean).join(' · ') || ''}</div>
                        </td>
                        <td className="px-2 py-2.5 text-right text-gray-700">{item.quantity}</td>
                        <td className="px-2 py-2.5 text-right text-gray-500">S/ {item.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">S/ {item.subtotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Subtotal / IGV / Total */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">S/ {baseImponible.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">IGV</span>
                <span className="text-gray-900">S/ {igv.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-base font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-primary-600">S/ {sale.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              type="button"
              onClick={openVoucherPreview}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <FileText size={16} /> Ver comprobante
            </button>
            {!sale.isCancelled && userRole === 'ADMIN' && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors text-sm font-semibold"
              >
                Editar items
              </button>
            )}
            {!sale.isCancelled && (
              <button
                type="button"
                onClick={() => { setCancelling(true); setCancelReason(''); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-semibold"
              >
                <XCircle size={16} /> Anular
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modal: editar items (lazy stock load) */}
      <EditSaleItemsModal
        sale={editing ? sale : null}
        onClose={() => setEditing(false)}
        products={products}
        companies={activeCompanies}
        priceTiers={tiers}
        paymentMethods={paymentMethods}
        stockByCompanyMap={stockByCompanyMap}
      />

      {/* Sub-modal: anular */}
      <Modal isOpen={cancelling} onClose={() => setCancelling(false)} title="Anular Venta">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await cancelSale.mutateAsync({ id: sale.id, reason: cancelReason });
            setCancelling(false);
            onClose();
          }}
          className="space-y-4"
        >
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-sm text-red-700">Esta acción <strong>anulará la venta</strong> por S/ {sale.total.toFixed(2)}:</p>
            <ul className="text-xs text-red-600 mt-2 space-y-1 list-disc list-inside">
              <li>Se devolverá el stock de todos los productos</li>
              {!sale.isCredit && <li>Se eliminarán las entradas de caja asociadas</li>}
              {sale.isCredit && <li>Se anulará la cuenta por cobrar</li>}
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Razón de la anulación</label>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Ej: Error en el registro, cliente desistió..." required />
          </div>
          <button type="submit" disabled={cancelSale.isPending} className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50">
            {cancelSale.isPending ? 'Anulando...' : 'Confirmar Anulación'}
          </button>
        </form>
      </Modal>

      {/* Sub-modal: vista previa del comprobante */}
      <VoucherPreviewModal sale={voucherPreview} onClose={() => setVoucherPreview(null)} />
    </>
  );
}

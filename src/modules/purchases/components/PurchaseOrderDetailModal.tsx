import { Building2, CalendarDays, CreditCard, Download, MapPin, Package, UserRound } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import type { Company, FiscalEntity, Product, PurchaseOrder, PurchaseOrderStatus } from '../../../shared/types';
import { formatDateEs } from '../../../shared/utils/date.util';
import { getPurchaseOrderDetails } from '../utils/purchaseOrderDetails';

interface PurchaseOrderDetailModalProps {
  order: PurchaseOrder | null;
  products: Product[];
  companies: Company[];
  fiscalEntity?: FiscalEntity;
  onClose: () => void;
  onDownload: (order: PurchaseOrder) => void | Promise<void>;
}

const STATUS_META: Record<PurchaseOrderStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Aprobada', className: 'bg-blue-100 text-blue-700' },
  CANCELLED: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
  CONVERTED: { label: 'Convertida', className: 'bg-primary-100 text-primary-700' },
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function DetailSection({ title, icon: Icon, children }: { title: string; icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <section className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 bg-slate-100 border-b border-gray-200 flex items-center gap-2">
        <Icon size={15} className="text-primary-700" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DetailItem({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-[11px] uppercase tracking-wide font-medium text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-800 break-words">{children || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

export function PurchaseOrderDetailModal({
  order,
  products,
  companies,
  fiscalEntity,
  onClose,
  onDownload,
}: PurchaseOrderDetailModalProps) {
  if (!order) return null;

  const productMap = new Map(products.map((product) => [product.id, product]));
  const companyMap = new Map(companies.map((company) => [company.id, company]));
  const details = getPurchaseOrderDetails(order);
  const currency = order.currency || (order.totalCostUsd != null ? 'USD' : 'PEN');
  const symbol = currency === 'USD' ? 'US$' : 'S/';
  const total = roundMoney(currency === 'USD' && order.totalCostUsd != null ? order.totalCostUsd : order.totalCost);
  const warehouses = [...new Set(order.items.map((item) => item.companyId || order.companyId).filter(Boolean))]
    .map((id) => companyMap.get(id))
    .filter((company): company is Company => !!company);
  const warehouseNames = warehouses.map((company) => company.name).join(', ') || '—';
  const warehouseAddresses = warehouses.map((company) => company.address).filter(Boolean).join(' / ');

  let taxableGross = 0;
  let nonTaxableGross = 0;
  order.items.forEach((item) => {
    const product = productMap.get(item.productId);
    const unitPrice = Number(item.unitPriceConIgv ?? item.unitCost ?? item.unitPriceSinIgv ?? 0);
    const lineTotal = item.quantity * unitPrice;
    if (!product?.taxType || product.taxType === 'GRAVADO') taxableGross += lineTotal;
    else nonTaxableGross += lineTotal;
  });
  const calculatedGross = taxableGross + nonTaxableGross;
  const effectiveTaxableGross = calculatedGross > 0 && Math.abs(calculatedGross - total) > 0.02
    ? taxableGross * (total / calculatedGross)
    : taxableGross;
  const subtotal = roundMoney((effectiveTaxableGross / 1.18) + (total - effectiveTaxableGross));
  const igv = roundMoney(total - subtotal);
  const status = STATUS_META[order.status];
  const paymentFormLabel = details.paymentForm.charAt(0) + details.paymentForm.slice(1).toLowerCase();

  return (
    <Modal isOpen={!!order} onClose={onClose} title={`Detalle de ${order.orderNumber}`} size="2xl">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xl font-bold text-primary-800">{order.orderNumber}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>{status.label}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Orden emitida el {formatDateEs(order.issueDate || order.createdAt, { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
          <button type="button" onClick={() => onDownload(order)} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 text-sm font-semibold">
            <Download size={16} /> Descargar PDF
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <DetailSection title="Proveedor" icon={UserRound}>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
              <DetailItem label="Razón social" wide>{order.supplier}</DetailItem>
              <DetailItem label="RUC">{order.supplierRuc || '—'}</DetailItem>
              <DetailItem label="Teléfono">{details.supplierPhone || '—'}</DetailItem>
              <DetailItem label="Persona de contacto" wide>{details.supplierContact || '—'}</DetailItem>
            </dl>
          </DetailSection>

          <DetailSection title="Fecha y moneda" icon={CalendarDays}>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
              <DetailItem label="Fecha de emisión">{formatDateEs(order.issueDate || order.createdAt)}</DetailItem>
              <DetailItem label="Vencimiento de cotización">{details.quotationValidUntil ? formatDateEs(details.quotationValidUntil) : '—'}</DetailItem>
              <DetailItem label="Moneda" wide>{currency === 'USD' ? 'USD — Dólares americanos' : 'PEN — Soles'}</DetailItem>
            </dl>
          </DetailSection>

          <DetailSection title="Punto de llegada" icon={MapPin}>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
              <DetailItem label="Entrega / destino" wide>{details.deliveryPlace || warehouseNames}</DetailItem>
              <DetailItem label="Almacén" wide>{warehouseNames}</DetailItem>
              <DetailItem label="Dirección" wide>{details.deliveryAddress || warehouseAddresses || '—'}</DetailItem>
              <DetailItem label="Transporte" wide>{details.transport || 'Directo (a cargo del proveedor)'}</DetailItem>
            </dl>
          </DetailSection>

          <DetailSection title="Condiciones de pago" icon={CreditCard}>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
              <DetailItem label="Forma de pago">{paymentFormLabel}</DetailItem>
              <DetailItem label="Condición">{order.paymentType === 'CREDITO' ? 'Crédito' : 'Contado'}</DetailItem>
              <DetailItem label="Plazo">{details.creditDays ? `${details.creditDays} días` : '—'}</DetailItem>
              <DetailItem label="Vencimiento">{order.dueDate ? formatDateEs(order.dueDate) : '—'}</DetailItem>
            </dl>
          </DetailSection>
        </div>

        <DetailSection title="Datos de facturación" icon={Building2}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
            <DetailItem label="Empresa receptora">{fiscalEntity?.legalName || '—'}</DetailItem>
            <DetailItem label="RUC de receptora">{fiscalEntity?.ruc || '—'}</DetailItem>
            <DetailItem label="Solicitado por">{details.requestedBy || '—'}</DetailItem>
            <DetailItem label="Aprobado por">{details.approvedBy || 'Pendiente de firma'}</DetailItem>
          </dl>
        </DetailSection>

        <DetailSection title={`Productos solicitados (${order.items.length})`} icon={Package}>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-center text-[11px] font-bold text-gray-500">Ítem</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-500">Descripción</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-500">Almacén</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold text-gray-500">Cant.</th>
                  <th className="px-3 py-2 text-center text-[11px] font-bold text-gray-500">U.M.</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold text-gray-500">P. unit.</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold text-gray-500">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.map((item, index) => {
                  const product = productMap.get(item.productId);
                  const company = companyMap.get(item.companyId || order.companyId);
                  const unitPrice = Number(item.unitPriceConIgv ?? item.unitCost ?? item.unitPriceSinIgv ?? 0);
                  return (
                    <tr key={`${item.productId}-${index}`}>
                      <td className="px-3 py-2.5 text-center text-gray-500">{String(index + 1).padStart(2, '0')}</td>
                      <td className="px-3 py-2.5 min-w-[220px]">
                        <div className="font-semibold text-gray-800">{product?.name || item.productId}</div>
                        {product?.activeIngredient && <div className="text-xs text-gray-500 mt-0.5">{product.activeIngredient}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{company?.name || '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{item.quantity.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center">{product?.unit || 'UND'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{symbol} {unitPrice.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{symbol} {(item.quantity * unitPrice).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col md:flex-row gap-4 md:justify-between md:items-start">
            <div className="text-xs text-gray-500 max-w-2xl">
              {details.observations ? <p><span className="font-semibold text-gray-700">Observaciones:</span> {details.observations}</p> : <p>Sin observaciones adicionales.</p>}
            </div>
            <dl className="w-full md:w-64 space-y-1.5 text-sm shrink-0">
              <div className="flex justify-between text-gray-600"><dt>Subtotal</dt><dd>{symbol} {subtotal.toFixed(2)}</dd></div>
              <div className="flex justify-between text-gray-600"><dt>IGV (18%)</dt><dd>{symbol} {igv.toFixed(2)}</dd></div>
              <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-base text-primary-800"><dt>Total estimado</dt><dd>{symbol} {total.toFixed(2)}</dd></div>
            </dl>
          </div>
        </DetailSection>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-bold uppercase tracking-wide mb-1.5">Notas importantes</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>La guía de remisión o factura debe incluir el número de esta orden.</li>
            <li>Los productos con vencimiento deben mantener más de un año de vida útil, salvo indicación distinta.</li>
            <li>La mercadería y sus precios deben coincidir con lo indicado en la orden.</li>
          </ol>
        </div>
      </div>
    </Modal>
  );
}

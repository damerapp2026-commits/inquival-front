import type { PurchaseOrder } from '../../../shared/types';
import { addDaysToDate as addCalendarDays } from '../../../shared/utils/date.util';

export type PurchaseOrderPaymentForm = 'CONTADO' | 'LETRA' | 'FACTURA';

export interface PurchaseOrderDetails {
  supplierContact: string;
  supplierPhone: string;
  quotationValidUntil: string;
  deliveryPlace: string;
  deliveryAddress: string;
  transport: string;
  transportAddress: string;
  paymentForm: PurchaseOrderPaymentForm;
  creditDays?: number;
  requestedBy: string;
  approvedBy: string;
  observations: string;
}

type StoredPurchaseOrderDetails = Omit<PurchaseOrderDetails, 'observations'>;

const META_START = '[OC_META]';
const META_END = '[/OC_META]';
const META_PATTERN = /\[OC_META\]([\s\S]*?)\[\/OC_META\]\s*/;

export const EMPTY_PURCHASE_ORDER_DETAILS: PurchaseOrderDetails = {
  supplierContact: '',
  supplierPhone: '',
  quotationValidUntil: '',
  deliveryPlace: '',
  deliveryAddress: '',
  transport: 'Directo (a cargo del proveedor)',
  transportAddress: '',
  paymentForm: 'CONTADO',
  creditDays: undefined,
  requestedBy: '',
  approvedBy: '',
  observations: '',
};

const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const asPaymentForm = (value: unknown): PurchaseOrderPaymentForm => (
  value === 'LETRA' || value === 'FACTURA' ? value : 'CONTADO'
);

const asPositiveNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export const PURCHASE_ORDER_CREDIT_DAYS = [30, 45, 60, 150] as const;

export const PURCHASE_ORDER_CONDITIONS = [
  'Toda guía de remisión o factura deberá incluir el número de esta orden de compra.',
  'Los productos solicitados deberán contar con más de un año de vida útil. La mercadería con una fecha de vencimiento menor a la indicada será devuelta.',
  'No se aceptará mercadería cuyos productos o precios no figuren en esta orden de compra.',
];

export function serializePurchaseOrderDetails(details: PurchaseOrderDetails): string | undefined {
  const stored: StoredPurchaseOrderDetails = {
    supplierContact: details.supplierContact.trim(),
    supplierPhone: details.supplierPhone.trim(),
    quotationValidUntil: details.quotationValidUntil,
    deliveryPlace: details.deliveryPlace.trim(),
    deliveryAddress: details.deliveryAddress.trim(),
    transport: details.transport.trim(),
    transportAddress: details.transportAddress.trim(),
    paymentForm: details.paymentForm,
    creditDays: asPositiveNumber(details.creditDays),
    requestedBy: details.requestedBy.trim(),
    approvedBy: details.approvedBy.trim(),
  };
  const observations = details.observations.trim();
  return `${META_START}${JSON.stringify(stored)}${META_END}${observations ? `\n${observations}` : ''}`;
}

export function getPurchaseOrderDetails(order: PurchaseOrder): PurchaseOrderDetails {
  let stored: Partial<StoredPurchaseOrderDetails> = {};
  const notes = order.notes || '';
  const match = notes.match(META_PATTERN);
  if (match?.[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed;
    } catch {
      stored = {};
    }
  }

  return {
    supplierContact: asString(order.supplierContact) || asString(stored.supplierContact),
    supplierPhone: asString(order.supplierPhone) || asString(stored.supplierPhone),
    quotationValidUntil: asString(order.quotationValidUntil) || asString(stored.quotationValidUntil),
    deliveryPlace: asString(order.deliveryPlace) || asString(stored.deliveryPlace),
    deliveryAddress: asString(order.deliveryAddress) || asString(stored.deliveryAddress),
    transport: asString(order.transport) || asString(stored.transport),
    transportAddress: asString(order.transportAddress) || asString(stored.transportAddress),
    paymentForm: asPaymentForm(order.paymentForm || stored.paymentForm),
    creditDays: asPositiveNumber(order.creditDays) || asPositiveNumber(stored.creditDays),
    requestedBy: asString(order.requestedBy) || asString(stored.requestedBy),
    approvedBy: asString(order.approvedBy) || asString(stored.approvedBy),
    observations: notes.replace(META_PATTERN, '').trim(),
  };
}

export function addDaysToDate(date: string, days: number): string {
  if (!date || !Number.isFinite(days)) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) return '';
  return addCalendarDays(date, days);
}

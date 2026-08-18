import type { PurchaseOrder } from '../../../shared/types';

export type PurchaseOrderPaymentForm = 'CONTADO' | 'LETRA' | 'FACTURA';

export interface PurchaseOrderDetails {
  supplierContact: string;
  supplierPhone: string;
  quotationValidUntil: string;
  deliveryPlace: string;
  deliveryAddress: string;
  transport: string;
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

export function serializePurchaseOrderDetails(details: PurchaseOrderDetails): string | undefined {
  const stored: StoredPurchaseOrderDetails = {
    supplierContact: details.supplierContact.trim(),
    supplierPhone: details.supplierPhone.trim(),
    quotationValidUntil: details.quotationValidUntil,
    deliveryPlace: details.deliveryPlace.trim(),
    deliveryAddress: details.deliveryAddress.trim(),
    transport: details.transport.trim(),
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
      stored = JSON.parse(match[1]) as Partial<StoredPurchaseOrderDetails>;
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
    paymentForm: asPaymentForm(order.paymentForm || stored.paymentForm),
    creditDays: asPositiveNumber(order.creditDays) || asPositiveNumber(stored.creditDays),
    requestedBy: asString(order.requestedBy) || asString(stored.requestedBy),
    approvedBy: asString(order.approvedBy) || asString(stored.approvedBy),
    observations: notes.replace(META_PATTERN, '').trim(),
  };
}

export function addDaysToDate(date: string, days: number): string {
  if (!date || !Number.isFinite(days)) return '';
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1, day + days);
  if (Number.isNaN(result.getTime())) return '';
  return [
    result.getFullYear(),
    String(result.getMonth() + 1).padStart(2, '0'),
    String(result.getDate()).padStart(2, '0'),
  ].join('-');
}

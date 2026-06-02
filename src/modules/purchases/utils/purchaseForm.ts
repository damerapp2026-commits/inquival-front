import type React from 'react';
import type { Purchase, PurchaseItem, Product } from '../../../shared/types';

export const IGV_RATE = 0.18;

export const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) => {
  (e.currentTarget as HTMLInputElement).blur();
};

// Muestra 2 decimales si el número ya es exacto a céntimos; si no, hasta 4.
export const fmtPrice = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return '0.00';
  const r2 = Math.round(n * 100) / 100;
  return Math.abs(n - r2) < 1e-9 ? n.toFixed(2) : n.toFixed(4);
};

export interface PurchaseFormItem {
  companyId: string;
  productId: string;
  quantity: number;
  lotNumber?: string;
  expirationDate?: string;
  unitPriceSinIgv: number;
  unitPriceConIgv: number;
  costoAdquisicion: number;
  costoEnSoles: number;
  markupPercent: number;
  precioVenta: number;
  precioVentaMode: 'markup' | 'direct';
}

export const emptyItem = (): PurchaseFormItem => ({
  companyId: '',
  productId: '',
  quantity: 0,
  lotNumber: '',
  expirationDate: '',
  unitPriceSinIgv: 0,
  unitPriceConIgv: 0,
  costoAdquisicion: 0,
  costoEnSoles: 0,
  markupPercent: 0,
  precioVenta: 0,
  precioVentaMode: 'markup',
});

export function recalcItem(
  item: PurchaseFormItem,
  currency: 'PEN' | 'USD' = 'PEN',
  exchangeRate: number | null = null,
  applyIgv: boolean = true,
): PurchaseFormItem {
  const unitPriceConIgv = applyIgv
    ? item.unitPriceSinIgv * (1 + IGV_RATE)
    : item.unitPriceSinIgv;
  const costoAdquisicion = unitPriceConIgv;
  const costoEnSoles = currency === 'USD'
    ? (exchangeRate ? unitPriceConIgv * exchangeRate : 0)
    : costoAdquisicion;

  let precioVenta = item.precioVenta;
  let markupPercent = item.markupPercent;

  if (item.precioVentaMode === 'markup') {
    precioVenta = costoAdquisicion > 0
      ? Math.round(costoAdquisicion * (1 + markupPercent / 100) * 100) / 100
      : 0;
  } else {
    markupPercent = costoAdquisicion > 0
      ? Math.round(((precioVenta / costoAdquisicion) - 1) * 10000) / 100
      : 0;
  }

  return { ...item, unitPriceConIgv, costoAdquisicion, costoEnSoles, precioVenta, markupPercent };
}

export const itemAppliesIgv = (productId: string, products: Product[]): boolean => {
  if (!productId) return true;
  const p = products.find((pr) => pr.id === productId);
  const taxType = (p as any)?.taxType;
  return !taxType || taxType === 'GRAVADO';
};

const dateInputStr = (d: any): string => {
  if (!d) return '';
  if (typeof d === 'string') {
    const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(d);
    if (dateOnly) return dateOnly[1];
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};

export interface PurchaseFormState {
  supplier: string;
  supplierRuc: string;
  supplierId: string;
  laboratoryId: string;
  paymentType: 'CONTADO' | 'CREDITO';
  paymentScheduleType: 'SINGLE_DATE' | 'INSTALLMENTS';
  dueDate: string;
  installments: { amount: number; dueDate: string }[];
  items: PurchaseFormItem[];
  purchaseDate: string;
  documentType: 'FACTURA' | 'BOLETA' | 'GUIA' | 'NOTA_CREDITO' | 'OTRO';
  documentSeries: string;
  documentNumber: string;
  issueDate: string;
}

export interface PurchaseInitial {
  state: PurchaseFormState;
  currency: 'PEN' | 'USD';
  exchangeRate: number | null;
  exchangeRateDate: string;
  originalTotal: number;
  originalTotalUsd?: number;
}

export function purchaseToFormState(purchase: Purchase, products: Product[]): PurchaseInitial {
  const currency: 'PEN' | 'USD' = purchase.totalCostUsd ? 'USD' : 'PEN';
  const exchangeRate = purchase.exchangeRate ?? null;
  const exchangeRateDate = (purchase as any).exchangeRateDate || '';

  const items: PurchaseFormItem[] = (purchase.items || []).map((pi: PurchaseItem) => {
    const applyIgv = itemAppliesIgv(pi.productId, products);
    const sinIgv = pi.unitPriceSinIgv ?? 0;
    const conIgv = pi.unitPriceConIgv ?? (applyIgv ? sinIgv * (1 + IGV_RATE) : sinIgv);
    const costoAdq = conIgv;
    const costoSoles = currency === 'USD'
      ? (exchangeRate ? conIgv * exchangeRate : (pi.unitCost ?? 0))
      : (pi.unitCost ?? costoAdq);

    const precioVenta = pi.precioVenta ?? 0;
    const markup = pi.markupPercent ?? (costoSoles > 0 && precioVenta > 0
      ? Math.round(((precioVenta / costoSoles) - 1) * 10000) / 100
      : 0);

    const item: PurchaseFormItem = {
      companyId: (pi as any).companyId || purchase.companyId,
      productId: pi.productId,
      quantity: pi.quantity,
      lotNumber: pi.lotNumber || '',
      expirationDate: dateInputStr(pi.expirationDate),
      unitPriceSinIgv: sinIgv,
      unitPriceConIgv: conIgv,
      costoAdquisicion: costoAdq,
      costoEnSoles: costoSoles,
      markupPercent: markup,
      precioVenta,
      precioVentaMode: 'direct',
    };
    return item;
  });

  const state: PurchaseFormState = {
    supplier: purchase.supplier || '',
    supplierRuc: purchase.supplierRuc || '',
    supplierId: purchase.supplierId || '',
    laboratoryId: (purchase as any).laboratoryId || '',
    paymentType: purchase.paymentType,
    paymentScheduleType: purchase.paymentScheduleType || 'SINGLE_DATE',
    dueDate: dateInputStr(purchase.dueDate),
    installments: (purchase.installments || []).map((i) => ({
      amount: i.amount,
      dueDate: dateInputStr(i.dueDate),
    })),
    items: items.length ? items : [emptyItem()],
    purchaseDate: dateInputStr(purchase.date),
    documentType: (purchase.documentType || 'FACTURA') as any,
    documentSeries: purchase.documentSeries || '',
    documentNumber: purchase.documentNumber || '',
    issueDate: dateInputStr(purchase.issueDate),
  };

  return {
    state,
    currency,
    exchangeRate,
    exchangeRateDate,
    originalTotal: purchase.totalCost,
    originalTotalUsd: purchase.totalCostUsd,
  };
}

export function buildInitialCreate(today: string): PurchaseInitial {
  return {
    state: {
      supplier: '',
      supplierRuc: '',
      supplierId: '',
      laboratoryId: '',
      paymentType: 'CONTADO',
      paymentScheduleType: 'SINGLE_DATE',
      dueDate: '',
      installments: [],
      items: [emptyItem()],
      purchaseDate: today,
      documentType: 'FACTURA',
      documentSeries: '',
      documentNumber: '',
      issueDate: today,
    },
    currency: 'USD',
    exchangeRate: null,
    exchangeRateDate: '',
    originalTotal: 0,
  };
}

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
  unitPriceSinIgvInput: string;
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
  unitPriceSinIgvInput: '',
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

  // El precio de venta del catálogo siempre está en soles, independientemente
  // de la moneda de la compra, por lo que el margen se calcula sobre el costo
  // convertido a soles (costoEnSoles == costoAdquisicion cuando la compra es en PEN).
  let precioVenta = item.precioVenta;
  let markupPercent = item.markupPercent;

  if (item.precioVentaMode === 'markup') {
    precioVenta = costoEnSoles > 0
      ? Math.round(costoEnSoles * (1 + markupPercent / 100) * 100) / 100
      : 0;
  } else {
    markupPercent = costoEnSoles > 0
      ? Math.round(((precioVenta / costoEnSoles) - 1) * 10000) / 100
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
  paymentType: 'CONTADO' | 'CREDITO' | 'BONIFICACION';
  paymentMethodId: string;
  addToStock: boolean;
  paymentScheduleType: 'SINGLE_DATE' | 'INSTALLMENTS';
  detraccion: boolean;
  detraccionDueDate: string;
  dueDate: string;
  installments: { amount: number; dueDate: string; status?: 'PENDING' | 'PAID' }[];
  items: PurchaseFormItem[];
  purchaseDate: string;
  documentType: 'FACTURA' | 'BOLETA' | 'GUIA' | 'NOTA_CREDITO' | 'OTRO';
  documentSeries: string;
  documentNumber: string;
  issueDate: string;
  grSeries: string;
  grNumber: string;
  grDate: string;
}

export interface PurchaseInitial {
  state: PurchaseFormState;
  currency: 'PEN' | 'USD';
  exchangeRate: number | null;
  exchangeRateDate: string;
  originalTotal: number;
  originalTotalUsd?: number;
  fiscalEntityId?: string;
}

export interface PurchaseCreateDraft extends PurchaseInitial {
  savedAt: string;
}

export const PURCHASE_CREATE_DRAFT_KEY = 'inquival:purchases:new:draft:v1';

const isCurrency = (value: unknown): value is 'PEN' | 'USD' => value === 'PEN' || value === 'USD';

export function readPurchaseCreateDraft(fallback: PurchaseInitial): PurchaseInitial | null {
  try {
    const raw = window.localStorage.getItem(PURCHASE_CREATE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PurchaseCreateDraft>;
    if (!parsed.state || !isCurrency(parsed.currency)) return null;

    return {
      state: {
        ...fallback.state,
        ...parsed.state,
        items: Array.isArray(parsed.state.items) && parsed.state.items.length
          ? parsed.state.items.map((item) => ({ ...emptyItem(), ...item }))
          : fallback.state.items,
        installments: Array.isArray(parsed.state.installments) ? parsed.state.installments : [],
      },
      currency: parsed.currency,
      exchangeRate: typeof parsed.exchangeRate === 'number' ? parsed.exchangeRate : null,
      exchangeRateDate: typeof parsed.exchangeRateDate === 'string' ? parsed.exchangeRateDate : '',
      originalTotal: 0,
    };
  } catch {
    return null;
  }
}

export function writePurchaseCreateDraft(initial: PurchaseInitial) {
  try {
    const draft: PurchaseCreateDraft = {
      ...initial,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(PURCHASE_CREATE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable in private mode; the form should keep working.
  }
}

export function clearPurchaseCreateDraft() {
  try {
    window.localStorage.removeItem(PURCHASE_CREATE_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function purchaseToFormState(purchase: Purchase, products: Product[]): PurchaseInitial {
  const currency: 'PEN' | 'USD' = purchase.totalCostUsd != null ? 'USD' : 'PEN';
  const exchangeRate = (() => {
    if (currency !== 'USD') return null;
    if (typeof purchase.exchangeRate === 'number' && purchase.exchangeRate > 0) return purchase.exchangeRate;
    if (purchase.totalCostUsd && purchase.totalCost > 0) {
      return Math.round((purchase.totalCost / purchase.totalCostUsd) * 10000) / 10000;
    }
    return 3.4;
  })();
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
      unitPriceSinIgvInput: sinIgv ? String(sinIgv) : '',
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
    paymentMethodId: (purchase as any).paymentMethodId || '',
    addToStock: purchase.addToStock !== false,
    paymentScheduleType: purchase.paymentScheduleType || 'SINGLE_DATE',
    detraccion: purchase.detraccion || false,
    detraccionDueDate: dateInputStr(purchase.detraccionDueDate),
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
    grSeries: purchase.grSeries || '',
    grNumber: purchase.grNumber || '',
    grDate: dateInputStr(purchase.grDate),
  };

  return {
    state,
    currency,
    exchangeRate,
    exchangeRateDate,
    originalTotal: purchase.totalCost,
    originalTotalUsd: purchase.totalCostUsd,
    fiscalEntityId: purchase.fiscalEntityId,
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
      paymentMethodId: '',
      addToStock: true,
      paymentScheduleType: 'SINGLE_DATE',
      detraccion: false,
      detraccionDueDate: '',
      dueDate: '',
      installments: [],
      items: [emptyItem()],
      purchaseDate: today,
      documentType: 'FACTURA',
      documentSeries: '',
      documentNumber: '',
      issueDate: today,
      grSeries: '',
      grNumber: '',
      grDate: '',
    },
    currency: 'USD',
    exchangeRate: null,
    exchangeRateDate: '',
    originalTotal: 0,
  };
}

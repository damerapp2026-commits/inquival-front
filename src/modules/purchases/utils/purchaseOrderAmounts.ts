import type { Product, PurchaseItem, PurchaseOrder } from '../../../shared/types';
import { IGV_RATE } from './purchaseForm';

export const roundOrderMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function purchaseOrderCurrency(order: Pick<PurchaseOrder, 'currency' | 'totalCostUsd'>): 'PEN' | 'USD' {
  return order.currency || (order.totalCostUsd != null ? 'USD' : 'PEN');
}

export function calculatePurchaseOrderAmounts(items: PurchaseItem[], products: Product[], recordedTotal?: number) {
  const productMap = new Map(products.map(product => [product.id, product]));
  let taxableCents = 0;
  let taxableBaseCents = 0;
  const lines = items.map(item => {
    const product = productMap.get(item.productId);
    const taxType = item.taxType || product?.taxType || 'GRAVADO';
    const taxable = taxType === 'GRAVADO';
    const unitPrice = Number(item.unitPriceConIgv ?? item.unitCost ?? ((item.unitPriceSinIgv || 0) * (taxable ? 1 + IGV_RATE : 1)));
    const total = roundOrderMoney(item.quantity * unitPrice);
    let subtotal = total;
    if (taxable) {
      taxableCents += Math.round(total * 100);
      const nextBaseCents = Math.round(taxableCents / (1 + IGV_RATE));
      // Allocate rounding cents per line while preserving the document's
      // existing tax breakdown over its combined taxable amount.
      subtotal = (nextBaseCents - taxableBaseCents) / 100;
      taxableBaseCents = nextBaseCents;
    }
    const unitPriceSinIgv = taxable ? unitPrice / (1 + IGV_RATE) : unitPrice;
    return { unitPrice, unitPriceSinIgv, total, subtotal, igv: roundOrderMoney(total - subtotal), taxType, taxable };
  });
  const sum = (values: number[]) => values.reduce((total, value) => total + Math.round(value * 100), 0) / 100;
  const linesTotal = sum(lines.map(line => line.total));
  const total = recordedTotal != null ? roundOrderMoney(recordedTotal) : linesTotal;
  let subtotal = sum(lines.map(line => line.subtotal));

  // Older orders can have a manually entered total. Preserve their recorded
  // amount and the existing proportional tax breakdown when reprinting them.
  if (recordedTotal != null && Math.abs(total - linesTotal) > 0.02 && linesTotal > 0) {
    const taxableGross = sum(lines.filter(line => line.taxable).map(line => line.total));
    const taxableTotal = roundOrderMoney(taxableGross * total / linesTotal);
    subtotal = roundOrderMoney(taxableTotal / (1 + IGV_RATE) + total - taxableTotal);
  }

  return { lines, subtotal, igv: roundOrderMoney(total - subtotal), total };
}

export function purchaseOrderAmounts(order: PurchaseOrder, products: Product[]) {
  const currency = purchaseOrderCurrency(order);
  const total = currency === 'USD' && order.totalCostUsd != null ? order.totalCostUsd : order.totalCost;
  return { ...calculatePurchaseOrderAmounts(order.items, products, total), currency };
}

import type { Sale, Product, ProductCommission } from '../../../shared/types';

export interface CommissionLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  commissionType: ProductCommission['type'] | null;
  commissionValue: number;
  commissionAmount: number;
}

function commissionForLine(
  productId: string,
  quantity: number,
  unitPrice: number,
  subtotal: number,
  workerId: string,
  products: Product[],
): { type: ProductCommission['type'] | null; value: number; amount: number } {
  const product = products.find((p) => p.id === productId);
  const entry = product?.commissions?.find((c) => c.workerId === workerId);
  if (!entry) return { type: null, value: 0, amount: 0 };
  if (entry.type === 'PERCENT') return { type: 'PERCENT', value: entry.value, amount: (subtotal * entry.value) / 100 };
  return { type: 'AMOUNT', value: entry.value, amount: quantity * entry.value };
}

export function commissionForSale(sale: Sale, products: Product[]): number {
  if (!sale.sellerId || sale.isCancelled) return 0;
  return sale.items.reduce((acc, item) => {
    const sub = item.subtotal || item.quantity * item.unitPrice;
    const { amount } = commissionForLine(item.productId, item.quantity, item.unitPrice, sub, sale.sellerId!, products);
    return acc + amount;
  }, 0);
}

export function commissionLines(sale: Sale, products: Product[]): CommissionLine[] {
  if (!sale.sellerId) return [];
  return sale.items.map((item) => {
    const sub = item.subtotal || item.quantity * item.unitPrice;
    const product = products.find((p) => p.id === item.productId);
    const { type, value, amount } = commissionForLine(item.productId, item.quantity, item.unitPrice, sub, sale.sellerId!, products);
    return {
      productId: item.productId,
      productName: product?.name || item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: sub,
      commissionType: type,
      commissionValue: value,
      commissionAmount: amount,
    };
  });
}

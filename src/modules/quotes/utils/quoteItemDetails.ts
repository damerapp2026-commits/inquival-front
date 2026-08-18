import type { Product, QuoteItem } from '../../../shared/types';

export function getQuoteItemProductName(item: QuoteItem, product?: Product): string {
  return product?.name || item.productName || item.name || item.product?.name || 'Producto no disponible';
}

export function getQuoteItemProductUnit(item: QuoteItem, product?: Product): string {
  return product?.unit || item.unit || item.product?.unit || '';
}

export function getQuoteItemTaxType(item: QuoteItem, product?: Product): string | undefined {
  return product?.taxType || item.taxType || item.product?.taxType;
}

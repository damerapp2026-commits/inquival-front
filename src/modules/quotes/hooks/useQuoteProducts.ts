import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { Product, QuoteItem } from '../../../shared/types';
import { productService } from '../../products/services/productService';

export function getQuoteItemProductName(item: QuoteItem, product?: Product): string {
  return product?.name || item.productName || item.name || item.product?.name || 'Producto no disponible';
}

export function getQuoteItemProductUnit(item: QuoteItem, product?: Product): string {
  return product?.unit || item.unit || item.product?.unit || '';
}

export function getQuoteItemTaxType(item: QuoteItem, product?: Product): string | undefined {
  return product?.taxType || item.taxType || item.product?.taxType;
}

export function useQuoteProducts(items: QuoteItem[], catalogProducts: Product[]) {
  const catalogById = useMemo(
    () => new Map(catalogProducts.map((product) => [product.id, product])),
    [catalogProducts],
  );
  const missingProductIds = useMemo(() => Array.from(new Set(
    items
      .map((item) => item.productId)
      .filter((productId) => productId && !catalogById.has(productId)),
  )), [items, catalogById]);
  const queries = useQueries({
    queries: missingProductIds.map((productId) => ({
      queryKey: ['product', productId],
      queryFn: () => productService.getById(productId),
      staleTime: 5 * 60_000,
      retry: false,
    })),
  });
  const products = useMemo(() => {
    const resolved = new Map(catalogById);
    queries.forEach((query, index) => {
      const product = query.data as Product | undefined;
      if (product) resolved.set(missingProductIds[index], product);
    });
    return Array.from(resolved.values());
  }, [catalogById, missingProductIds, queries]);
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  return {
    products,
    productById,
    isLoading: queries.some((query) => query.isPending),
  };
}

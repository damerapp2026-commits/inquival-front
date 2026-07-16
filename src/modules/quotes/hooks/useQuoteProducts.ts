import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const allProductsQuery = useQuery({
    queryKey: ['products', 'quote-resolver'],
    queryFn: () => productService.getAll({ limit: 10000, includeInactive: true }),
    enabled: missingProductIds.length > 0,
    staleTime: 5 * 60_000,
  });
  const products = useMemo(() => {
    const resolved = new Map(catalogById);
    const raw: any = allProductsQuery.data;
    const allProducts: Product[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
    allProducts.forEach((product) => resolved.set(product.id, product));
    return Array.from(resolved.values());
  }, [catalogById, allProductsQuery.data]);
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  return {
    products,
    productById,
    isLoading: missingProductIds.length > 0 && allProductsQuery.isPending,
  };
}

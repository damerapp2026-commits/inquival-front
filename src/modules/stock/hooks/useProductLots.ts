import { useQuery } from '@tanstack/react-query';
import { productLotService } from '../services/productLotService';

export function useProductLots(companyId: string, productId?: string) {
  return useQuery({
    queryKey: ['product-lots', companyId, productId],
    queryFn: () => productLotService.getByCompany(companyId, productId),
    enabled: !!companyId,
  });
}

export function useProductLotsByProduct(productId?: string, companyId?: string) {
  return useQuery({
    queryKey: ['product-lots-by-product', productId, companyId || null],
    queryFn: () => productLotService.getByProduct(productId!, companyId),
    enabled: !!productId,
  });
}

export function useExpiringLots(companyId?: string, days = 30) {
  return useQuery({
    queryKey: ['product-lots-expiring', companyId || 'all', days],
    queryFn: () => productLotService.getExpiring(companyId, days),
  });
}

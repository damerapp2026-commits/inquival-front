import { useQuery } from '@tanstack/react-query';
import { productLotService } from '../services/productLotService';

export function useProductLots(companyId: string, productId?: string) {
  return useQuery({
    queryKey: ['product-lots', companyId, productId],
    queryFn: () => productLotService.getByCompany(companyId, productId),
    enabled: !!companyId,
  });
}

export function useExpiringLots(companyId: string, days = 30) {
  return useQuery({
    queryKey: ['product-lots-expiring', companyId, days],
    queryFn: () => productLotService.getExpiring(companyId, days),
    enabled: !!companyId,
  });
}

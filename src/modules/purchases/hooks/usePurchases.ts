import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseService } from '../services/purchaseService';
import toast from 'react-hot-toast';

export function usePurchases(params?: any) {
  return useQuery({ queryKey: ['purchases', params], queryFn: () => purchaseService.getAll(params) });
}
export function useProductSuppliers(productId: string) {
  return useQuery({
    queryKey: ['product-suppliers', productId],
    queryFn: () => purchaseService.getProductSuppliers(productId),
    enabled: !!productId,
    staleTime: 30_000,
  });
}
export function useLastPrice(productId: string, supplierId: string) {
  return useQuery({
    queryKey: ['last-price', productId, supplierId],
    queryFn: () => purchaseService.getLastPrice(productId, supplierId),
    enabled: !!productId && !!supplierId,
    staleTime: 60_000,
  });
}
export function usePriceCatalog(opts?: { companyId?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['price-catalog', opts?.companyId || null],
    queryFn: () => purchaseService.getPriceCatalog(opts?.companyId),
    enabled: opts?.enabled !== false,
    staleTime: 60_000,
  });
}
export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: purchaseService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['stock'] }); qc.invalidateQueries({ queryKey: ['accounts-payable'] }); qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['cash-registers'] }); toast.success('Compra registrada'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}

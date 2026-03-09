import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseService } from '../services/purchaseService';
import toast from 'react-hot-toast';

export function usePurchases(params?: any) {
  return useQuery({ queryKey: ['purchases', params], queryFn: () => purchaseService.getAll(params) });
}
export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: purchaseService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['stock'] }); qc.invalidateQueries({ queryKey: ['accounts-payable'] }); toast.success('Compra registrada'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}

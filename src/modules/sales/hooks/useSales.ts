import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saleService } from '../services/saleService';
import toast from 'react-hot-toast';

export function useSales(params?: any) {
  return useQuery({ queryKey: ['sales', params], queryFn: () => saleService.getAll(params) });
}
export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: saleService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['stock'] }); toast.success('Venta registrada'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saleService } from '../services/saleService';
import toast from 'react-hot-toast';

export function useSales(params?: any) {
  return useQuery({ queryKey: ['sales', params], queryFn: () => saleService.getAll(params) });
}
export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: saleService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['stock'] }); qc.invalidateQueries({ queryKey: ['cash-register-today'] }); toast.success('Venta registrada'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}
export function useCancelSale() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: saleService.cancel, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['stock'] }); qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['credit-accounts'] }); toast.success('Venta anulada'); }, onError: (err: any) => toast.error(err.response?.data?.message || 'Error al anular') });
}

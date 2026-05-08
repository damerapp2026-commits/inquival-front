import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saleService } from '../services/saleService';
import toast from 'react-hot-toast';

export function useSales(params?: any) {
  return useQuery({ queryKey: ['sales', params], queryFn: () => saleService.getAll(params) });
}
export function useSaleById(id: string | null | undefined) {
  return useQuery({ queryKey: ['sale', id], queryFn: () => saleService.getById(id!), enabled: !!id });
}
export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: saleService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['stock'] }); qc.invalidateQueries({ queryKey: ['cash-register-today'] }); toast.success('Venta registrada'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}
export function useUpdateVoucher() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: saleService.updateVoucher, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); toast.success('Comprobante actualizado'); }, onError: (err: any) => toast.error(err.response?.data?.message || 'Error al actualizar') });
}
export function useCancelSale() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: saleService.cancel, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['stock'] }); qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['credit-accounts'] }); toast.success('Venta anulada'); }, onError: (err: any) => toast.error(err.response?.data?.message || 'Error al anular') });
}
export function useUpdateSaleItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saleService.updateItems,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['cash-register-today'] });
      toast.success('Venta actualizada');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error al editar la venta');
    },
  });
}

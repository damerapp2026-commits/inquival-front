import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockAdjustmentService } from '../services/stockAdjustmentService';
import toast from 'react-hot-toast';

export function useStockAdjustments(params?: any) {
  return useQuery({ queryKey: ['stock-adjustments', params], queryFn: () => stockAdjustmentService.getAll(params) });
}
export function useCreateStockAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stockAdjustmentService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-adjustments'] }); qc.invalidateQueries({ queryKey: ['stock'] }); toast.success('Ajuste registrado'); },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error al crear ajuste'),
  });
}

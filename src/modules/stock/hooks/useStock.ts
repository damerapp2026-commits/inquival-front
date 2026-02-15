import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockService } from '../services/stockService';
import toast from 'react-hot-toast';

export function useStock(companyId: string, params?: any) {
  return useQuery({ queryKey: ['stock', companyId, params], queryFn: () => stockService.getByCompany(companyId, params), enabled: !!companyId });
}
export function useStockAlerts(companyId: string, threshold?: number) {
  return useQuery({ queryKey: ['stock-alerts', companyId, threshold], queryFn: () => stockService.getAlerts(companyId, threshold), enabled: !!companyId });
}
export function useTransferStock() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: stockService.transfer, onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock'] }); toast.success('Transferencia realizada'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}

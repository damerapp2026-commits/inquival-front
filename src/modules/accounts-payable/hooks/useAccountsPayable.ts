import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountPayableService } from '../services/accountPayableService';
import toast from 'react-hot-toast';

export function useAccountsPayable(params?: any) {
  return useQuery({ queryKey: ['accounts-payable', params], queryFn: () => accountPayableService.getAll(params) });
}

export function useAccountPayableById(id: string | null) {
  return useQuery({ queryKey: ['accounts-payable', id], queryFn: () => accountPayableService.getById(id!), enabled: !!id });
}

export function useAPAlerts(days?: number) {
  return useQuery({ queryKey: ['accounts-payable-alerts', days], queryFn: () => accountPayableService.getAlerts(days) });
}

export function useRegisterAPPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ apId, data }: { apId: string; data: { amount: number; codigoTransferencia?: string; notes?: string } }) => accountPayableService.registerPayment(apId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts-payable'] }); qc.invalidateQueries({ queryKey: ['accounts-payable-alerts'] }); toast.success('Pago registrado'); },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || err.response?.data?.message || 'Error'),
  });
}

export function useUpdateNumeroUnico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ apId, data }: { apId: string; data: { numeroUnico: string; installmentId?: string } }) => accountPayableService.updateNumeroUnico(apId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts-payable'] }); toast.success('Número único actualizado'); },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || err.response?.data?.message || 'Error'),
  });
}

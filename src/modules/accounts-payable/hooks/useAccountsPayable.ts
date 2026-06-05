import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountPayableService, MigrateMisdatedAccountPayablesResult } from '../services/accountPayableService';
import toast from 'react-hot-toast';

export function useAccountsPayable(params?: any) {
  return useQuery({ queryKey: ['accounts-payable', params], queryFn: () => accountPayableService.getAll(params) });
}

export function useAccountPayableById(id: string | null) {
  return useQuery({ queryKey: ['accounts-payable', id], queryFn: () => accountPayableService.getById(id!), enabled: !!id });
}

export function useAccountPayableByPurchaseId(purchaseId: string | null) {
  return useQuery({
    queryKey: ['accounts-payable-by-purchase', purchaseId],
    queryFn: async () => {
      const result = await accountPayableService.getAll({ purchaseId, limit: 1, page: 1 });
      return (result as any)?.[0] ?? null;
    },
    enabled: !!purchaseId,
  });
}

export function useAPAlerts(days?: number) {
  return useQuery({ queryKey: ['accounts-payable-alerts', days], queryFn: () => accountPayableService.getAlerts(days) });
}

export function useRegisterAPPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ apId, data }: { apId: string; data: { amount: number; codigoTransferencia?: string; notes?: string; paymentDate?: string; paymentMethodId?: string } }) => accountPayableService.registerPayment(apId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts-payable'] });
      qc.invalidateQueries({ queryKey: ['accounts-payable-alerts'] });
      qc.invalidateQueries({ queryKey: ['cash-register-today'] });
      qc.invalidateQueries({ queryKey: ['cash-registers'] });
      qc.invalidateQueries({ queryKey: ['cash-register'] });
      toast.success('Pago registrado');
    },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || err.response?.data?.message || 'Error'),
  });
}

export function useMigrateMisdatedAP() {
  const qc = useQueryClient();
  return useMutation<MigrateMisdatedAccountPayablesResult, any, { dryRun: boolean; from?: string; to?: string }>({
    mutationFn: (data) => accountPayableService.migrateMisdated(data),
    onSuccess: (result) => {
      if (!result.dryRun) {
        qc.invalidateQueries({ queryKey: ['accounts-payable'] });
        qc.invalidateQueries({ queryKey: ['accounts-payable-alerts'] });
        toast.success(`Migración completada: ${result.migrated} cuenta(s) actualizadas`);
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error en la migración'),
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

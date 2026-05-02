import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentAgreementService } from '../services/paymentAgreementService';
import toast from 'react-hot-toast';

export function usePaymentAgreements(params?: any) {
  return useQuery({ queryKey: ['payment-agreements', params], queryFn: () => paymentAgreementService.getAll(params) });
}

export function usePaymentAgreementById(id: string | null) {
  return useQuery({ queryKey: ['payment-agreements', id], queryFn: () => paymentAgreementService.getById(id!), enabled: !!id });
}

export function useCreatePaymentAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => paymentAgreementService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-agreements'] });
      qc.invalidateQueries({ queryKey: ['accounts-payable'] });
      toast.success('Acuerdo de pago creado');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al crear acuerdo'),
  });
}

export function useRegisterAgreementPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; codigoTransferencia: string; notes?: string } }) =>
      paymentAgreementService.registerPayment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-agreements'] });
      qc.invalidateQueries({ queryKey: ['accounts-payable'] });
      toast.success('Pago registrado');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al registrar pago'),
  });
}

export function useCancelPaymentAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      paymentAgreementService.cancel(id, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-agreements'] });
      qc.invalidateQueries({ queryKey: ['accounts-payable'] });
      toast.success('Acuerdo anulado');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al anular acuerdo'),
  });
}

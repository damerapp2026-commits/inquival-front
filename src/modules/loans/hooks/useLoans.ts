import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loanService } from '../services/loanService';
import toast from 'react-hot-toast';

export function useLoans(params?: any) {
  return useQuery({ queryKey: ['loans', params], queryFn: () => loanService.getAll(params) });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: loanService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      toast.success('Préstamo registrado');
    },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error al registrar préstamo'),
  });
}

export function useReturnLoanItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, data }: { loanId: string; data: any }) => loanService.returnItems(loanId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      toast.success('Devolución registrada');
    },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error al registrar devolución'),
  });
}

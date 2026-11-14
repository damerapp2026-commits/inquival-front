import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { loanService } from '../services/loanService';
import toast from 'react-hot-toast';

const invalidateLoanInventory = (qc: QueryClient) => Promise.all(
  ['loans', 'stock', 'stock-alerts', 'stock-by-product-summary', 'kardex']
    .map(key => qc.invalidateQueries({ queryKey: [key] })),
);

function loanError(error: any, fallback: string) {
  const message = error.response?.data?.message;
  toast.error((Array.isArray(message) ? message[0] : message) || fallback);
}

export function useLoans(params?: any) {
  return useQuery({ queryKey: ['loans', params], queryFn: () => loanService.getAll(params) });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: loanService.create,
    onSuccess: async () => {
      await invalidateLoanInventory(qc);
      toast.success('Préstamo registrado');
    },
    onError: (error: any) => loanError(error, 'Error al registrar préstamo'),
  });
}

export function useReturnLoanItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, data }: { loanId: string; data: any }) => loanService.returnItems(loanId, data),
    onSuccess: async () => {
      await invalidateLoanInventory(qc);
      toast.success('Devolución registrada');
    },
    onError: (error: any) => loanError(error, 'Error al registrar devolución'),
  });
}

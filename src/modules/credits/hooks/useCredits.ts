import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { creditService } from '../services/creditService';
import toast from 'react-hot-toast';

export function useCredits(params?: any) {
  return useQuery({ queryKey: ['credits', params], queryFn: () => creditService.getAll(params) });
}
export function useCreditById(id: string) {
  return useQuery({ queryKey: ['credit', id], queryFn: () => creditService.getById(id), enabled: !!id });
}
export function useClientCredits(clientId: string, params?: any) {
  return useQuery({ queryKey: ['credits', 'client', clientId, params], queryFn: () => creditService.getByClient(clientId, params), enabled: !!clientId });
}
export function useRegisterPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creditId, data }: { creditId: string; data: any }) => creditService.registerPayment(creditId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credits'] }); qc.invalidateQueries({ queryKey: ['cash-register-today'] }); toast.success('Pago registrado'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al registrar pago'),
  });
}

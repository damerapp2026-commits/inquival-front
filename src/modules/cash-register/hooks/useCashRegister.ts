import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashRegisterService } from '../services/cashRegisterService';
import toast from 'react-hot-toast';

export function useCashRegisterToday() {
  return useQuery({ queryKey: ['cash-register-today'], queryFn: () => cashRegisterService.open() });
}
export function useCashRegisters(params?: any) {
  return useQuery({ queryKey: ['cash-registers', params], queryFn: () => cashRegisterService.getAll(params) });
}
export function useCashRegisterById(id: string) {
  return useQuery({ queryKey: ['cash-register', id], queryFn: () => cashRegisterService.getById(id), enabled: !!id });
}
export function useAddCashEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registerId, data }: { registerId: string; data: any }) => cashRegisterService.addEntry(registerId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['cash-registers'] }); toast.success('Entrada agregada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  });
}
export function useEditCashEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registerId, entryId, data }: { registerId: string; entryId: string; data: any }) => cashRegisterService.editEntry(registerId, entryId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['cash-registers'] }); toast.success('Entrada actualizada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  });
}
export function useDeleteCashEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registerId, entryId, data }: { registerId: string; entryId: string; data: any }) => cashRegisterService.deleteEntry(registerId, entryId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['cash-registers'] }); toast.success('Entrada eliminada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  });
}
export function useCloseCashRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registerId, data }: { registerId: string; data?: any }) => cashRegisterService.close(registerId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['cash-registers'] }); toast.success('Caja cerrada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  });
}

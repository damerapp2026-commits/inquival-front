import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import toast from 'react-hot-toast';

export function useClients(params?: any) {
  return useQuery({ queryKey: ['clients', params], queryFn: () => clientService.getAll(params) });
}
export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: clientService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Cliente creado'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}
export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => clientService.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Cliente actualizado'); } });
}

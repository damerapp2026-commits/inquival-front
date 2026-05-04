import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyService } from '../services/companyService';
import toast from 'react-hot-toast';

export function useCompanies() {
  return useQuery({ queryKey: ['companies'], queryFn: companyService.getAll });
}
export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: companyService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Almacén creado'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}
export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => companyService.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Almacén actualizado'); } });
}
export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: companyService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Almacén eliminado'); },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || err.response?.data?.message || 'No se pudo eliminar el almacén'),
  });
}

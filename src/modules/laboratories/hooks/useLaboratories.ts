import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { laboratoryService } from '../services/laboratoryService';
import toast from 'react-hot-toast';

export function useLaboratories() {
  return useQuery({ queryKey: ['laboratories'], queryFn: laboratoryService.getAll });
}
export function useCreateLaboratory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: laboratoryService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['laboratories'] }); toast.success('Laboratorio creado'); },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || err.response?.data?.message || 'Error al crear laboratorio'),
  });
}
export function useUpdateLaboratory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => laboratoryService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['laboratories'] }); toast.success('Laboratorio actualizado'); },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || err.response?.data?.message || 'Error al actualizar'),
  });
}
export function useDeleteLaboratory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => laboratoryService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['laboratories'] }); toast.success('Laboratorio eliminado'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al eliminar laboratorio'),
  });
}

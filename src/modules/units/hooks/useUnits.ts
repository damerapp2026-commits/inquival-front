import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { unitService } from '../services/unitService';
import toast from 'react-hot-toast';

export function useUnits() {
  return useQuery({ queryKey: ['units'], queryFn: unitService.getAll });
}
export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unitService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); toast.success('Unidad creada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al crear unidad'),
  });
}
export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => unitService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); toast.success('Unidad actualizada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al actualizar'),
  });
}
export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unitService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); toast.success('Unidad eliminada'); },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || err.response?.data?.message || 'No se pudo eliminar la unidad'),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryService } from '../services/categoryService';
import toast from 'react-hot-toast';

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: categoryService.getAll });
}
export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: categoryService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Categoría creada'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}
export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => categoryService.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Categoría actualizada'); } });
}

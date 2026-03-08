import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '../services/productService';
import toast from 'react-hot-toast';

export function useProducts(params?: any) {
  return useQuery({ queryKey: ['products', params], queryFn: () => productService.getAll(params) });
}
export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: productService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Producto creado'); }, onError: (err: any) => { const msg = err.response?.data?.message; toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error'); } });
}
export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => productService.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Producto actualizado'); } });
}
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: productService.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Producto eliminado'); } });
}

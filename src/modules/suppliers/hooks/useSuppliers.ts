import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supplierService } from '../services/supplierService';
import toast from 'react-hot-toast';

export function useSuppliers(params?: any) {
  return useQuery({ queryKey: ['suppliers', params], queryFn: () => supplierService.getAll(params) });
}

export function useSupplierByRuc() {
  return useMutation({
    mutationFn: supplierService.getByRuc,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supplierService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error al crear proveedor'),
  });
}

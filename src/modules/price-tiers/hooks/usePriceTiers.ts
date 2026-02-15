import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { priceTierService } from '../services/priceTierService';
import toast from 'react-hot-toast';

export function usePriceTiers(activeOnly = true) {
  return useQuery({ queryKey: ['price-tiers', activeOnly], queryFn: () => priceTierService.getAll(activeOnly) });
}
export function useCreatePriceTier() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: priceTierService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-tiers'] }); toast.success('Rango creado'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}
export function useUpdatePriceTier() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => priceTierService.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-tiers'] }); toast.success('Rango actualizado'); } });
}

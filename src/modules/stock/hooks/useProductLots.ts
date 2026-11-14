import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productLotService } from '../services/productLotService';
import toast from 'react-hot-toast';

export function useUpdateLotExpiration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expirationDate }: { id: string; expirationDate: string }) => productLotService.updateExpirationDate(id, expirationDate),
    onSuccess: async () => {
      await Promise.all(['product-lots', 'product-lots-by-product', 'product-lots-expiring', 'product-lots-all']
        .map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success('Fecha de vencimiento actualizada');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message;
      toast.error((Array.isArray(message) ? message[0] : message) || 'No se pudo actualizar el vencimiento');
    },
  });
}

export function useCreateLotFromStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productLotService.createFromStock,
    onSuccess: async () => {
      await Promise.all(['product-lots', 'product-lots-by-product', 'product-lots-expiring', 'product-lots-all', 'stock-by-product-summary']
        .map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success('Lote y vencimiento guardados');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message;
      toast.error((Array.isArray(message) ? message[0] : message) || 'No se pudo crear el lote');
    },
  });
}

export function useProductLots(companyId: string, productId?: string) {
  return useQuery({
    queryKey: ['product-lots', companyId, productId],
    queryFn: () => productLotService.getByCompany(companyId, productId),
    enabled: !!companyId,
  });
}

export function useProductLotsByProduct(productId?: string, companyId?: string) {
  return useQuery({
    queryKey: ['product-lots-by-product', productId, companyId || null],
    queryFn: () => productLotService.getByProduct(productId!, companyId),
    enabled: !!productId,
  });
}

export function useExpiringLots(companyId?: string, days = 30) {
  return useQuery({
    queryKey: ['product-lots-expiring', companyId || 'all', days],
    queryFn: () => productLotService.getExpiring(companyId, days),
  });
}

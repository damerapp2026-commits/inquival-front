import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseService } from '../services/purchaseService';
import toast from 'react-hot-toast';

export function usePurchases(params?: any) {
  return useQuery({ queryKey: ['purchases', params], queryFn: () => purchaseService.getAll(params) });
}
export function useProductSuppliers(productId: string) {
  return useQuery({
    queryKey: ['product-suppliers', productId],
    queryFn: () => purchaseService.getProductSuppliers(productId),
    enabled: !!productId,
    staleTime: 30_000,
  });
}
export function useLastPrice(productId: string, supplierId: string) {
  return useQuery({
    queryKey: ['last-price', productId, supplierId],
    queryFn: () => purchaseService.getLastPrice(productId, supplierId),
    enabled: !!productId && !!supplierId,
    staleTime: 60_000,
  });
}
export function usePriceCatalog(opts?: { companyId?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['price-catalog', opts?.companyId || null],
    queryFn: () => purchaseService.getPriceCatalog(opts?.companyId),
    enabled: opts?.enabled !== false,
    staleTime: 60_000,
  });
}
export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: purchaseService.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['stock'] }); qc.invalidateQueries({ queryKey: ['accounts-payable'] }); qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['cash-registers'] }); toast.success('Compra registrada'); }, onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error') });
}
export function useUpdatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof purchaseService.update>[1] }) =>
      purchaseService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      toast.success('Compra actualizada');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error al actualizar');
    },
  });
}
export function useUpdatePurchaseFull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof purchaseService.updateFull>[1] }) =>
      purchaseService.updateFull(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['accounts-payable'] });
      qc.invalidateQueries({ queryKey: ['cash-register-today'] });
      qc.invalidateQueries({ queryKey: ['cash-registers'] });
      qc.invalidateQueries({ queryKey: ['kardex'] });
      qc.invalidateQueries({ queryKey: ['price-catalog'] });
      qc.invalidateQueries({ queryKey: ['last-price'] });
      toast.success('Compra actualizada');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      const code = err.response?.data?.code;
      const codeMessages: Record<string, string> = {
        PURCHASE_HAS_APPLIED_PAYMENTS: 'Esta compra ya tiene pagos aplicados. Anula los pagos en Cuentas por Pagar antes de editarla.',
        PURCHASE_LOT_CONSUMED: 'El lote fue consumido en ventas posteriores. No se puede modificar.',
        PURCHASE_PERIOD_LOCKED: 'El periodo contable está cerrado. Registra una nota crédito en su lugar.',
        PURCHASE_VERSION_MISMATCH: 'La compra fue modificada por otro usuario. Recarga la página.',
      };
      const friendly = code && codeMessages[code];
      toast.error(friendly || (Array.isArray(msg) ? msg[0] : msg) || 'Error al actualizar la compra');
    },
  });
}
export function useUpdatePriceCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: Parameters<typeof purchaseService.updatePriceCatalog>[1] }) =>
      purchaseService.updatePriceCatalog(productId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-catalog'] }); },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error al guardar');
    },
  });
}

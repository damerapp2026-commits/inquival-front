import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseService } from '../services/purchaseService';
import toast from 'react-hot-toast';

export function usePurchases(params?: any, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['purchases', params],
    queryFn: () => purchaseService.getAll(params),
    enabled: opts?.enabled,
  });
}
export function usePurchaseById(id: string | undefined) {
  return useQuery({
    queryKey: ['purchase', id],
    queryFn: () => purchaseService.getById(id!),
    enabled: !!id,
  });
}
export function usePurchaseOrders(params?: any) {
  return useQuery({
    queryKey: ['purchase-orders', params],
    queryFn: () => purchaseService.orders.getAll(params),
  });
}
export function usePurchaseOrderById(id: string | undefined) {
  return useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => purchaseService.orders.getById(id!),
    enabled: !!id,
  });
}
export function useProductSuppliers(productId: string) {
  return useQuery({
    queryKey: ['product-suppliers', productId],
    queryFn: () => purchaseService.getProductSuppliers(productId),
    enabled: !!productId,
    staleTime: 0,
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
  return useMutation({
    mutationFn: purchaseService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['accounts-payable'] });
      qc.invalidateQueries({ queryKey: ['cash-register-today'] });
      qc.invalidateQueries({ queryKey: ['cash-registers'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['price-catalog'] });
      qc.invalidateQueries({ queryKey: ['last-price'] });
      qc.invalidateQueries({ queryKey: ['product-lots'] });
      toast.success('Compra registrada');
    },
    onError: (err: any) => toast.error(err.response?.data?.message?.[0] || 'Error'),
  });
}
export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purchaseService.orders.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Orden de compra creada');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error al crear orden');
    },
  });
}
export function useUpdatePurchaseOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purchaseService.orders.updateStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Orden actualizada');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al actualizar orden'),
  });
}
export function useConvertPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purchaseService.orders.convert,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['purchase-order', vars.id] });
      toast.success('Orden convertida en compra');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al convertir orden'),
  });
}
export function useDeletePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purchaseService.orders.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Orden eliminada');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error al eliminar orden');
    },
  });
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
export function useUpdatePurchaseMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof purchaseService.update>[1] }) =>
      purchaseService.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['purchase', id] });
      toast.success('Guía de remisión guardada');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error al guardar');
    },
  });
}
export function useUpdatePurchaseFiscalEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fiscalEntityId }: { id: string; fiscalEntityId: string }) =>
      purchaseService.update(id, { fiscalEntityId }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['purchase', id] });
      toast.success('Empresa de la compra actualizada');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error al cambiar la empresa');
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
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-lots'] });
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
export function useCancelPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      purchaseService.cancel(id, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['accounts-payable'] });
      qc.invalidateQueries({ queryKey: ['cash-register-today'] });
      qc.invalidateQueries({ queryKey: ['cash-registers'] });
      qc.invalidateQueries({ queryKey: ['kardex'] });
      qc.invalidateQueries({ queryKey: ['price-catalog'] });
      qc.invalidateQueries({ queryKey: ['last-price'] });
      qc.invalidateQueries({ queryKey: ['product-lots'] });
      toast.success('Compra eliminada');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      const code = err.response?.data?.code;
      const codeMessages: Record<string, string> = {
        PURCHASE_HAS_APPLIED_PAYMENTS: 'Esta compra ya tiene pagos aplicados en Cuentas por Pagar. Anula los pagos primero.',
        PURCHASE_LOT_CONSUMED: 'Uno de los lotes de esta compra ya fue consumido en ventas posteriores.',
        STOCK_WOULD_GO_NEGATIVE: 'El stock actual es insuficiente para revertir la compra. Las unidades ya fueron vendidas.',
        CASH_REGISTER_CLOSED: 'La caja del día de la compra está cerrada. Reábrela para poder eliminar.',
        PURCHASE_ALREADY_CANCELLED: 'La compra ya fue eliminada.',
      };
      const friendly = code && codeMessages[code];
      toast.error(friendly || (Array.isArray(msg) ? msg[0] : msg) || 'Error al eliminar la compra');
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

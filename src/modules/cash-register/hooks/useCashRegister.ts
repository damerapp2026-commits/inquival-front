import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashRegisterService, MigrateMisplacedSalesResult, MigrateMisplacedPurchasesResult, MigrateMisplacedCreditPaymentsResult, MigrateMisplacedAPPaymentsResult } from '../services/cashRegisterService';
import toast from 'react-hot-toast';

export function useCashRegisterToday() {
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  return useQuery({
    queryKey: ['cash-register-today', todayKey],
    queryFn: () => cashRegisterService.getToday(),
    refetchInterval: 5 * 60 * 1000,
  });
}
export function useOpenCashRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: any) => cashRegisterService.open(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-today'] }); toast.success('Caja abierta'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al abrir caja'),
  });
}
export function useCashRegisters(params?: any) {
  return useQuery({ queryKey: ['cash-registers', params], queryFn: () => cashRegisterService.getAll(params) });
}
export function useCashRegisterSummary(params?: any) {
  return useQuery({
    queryKey: ['cash-registers', 'summary', params],
    queryFn: () => cashRegisterService.getSummary(params),
    placeholderData: keepPreviousData,
  });
}
export function useCashRegisterById(id: string) {
  return useQuery({ queryKey: ['cash-register', id], queryFn: () => cashRegisterService.getById(id), enabled: !!id });
}
export function useAddCashEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registerId, data }: { registerId: string; data: any }) => cashRegisterService.addEntry(registerId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['cash-registers'] }); toast.success('Entrada agregada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  });
}
export function useEditCashEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registerId, entryId, data }: { registerId: string; entryId: string; data: any }) => cashRegisterService.editEntry(registerId, entryId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['cash-registers'] }); toast.success('Entrada actualizada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  });
}
export function useAssignCashEntryResponsible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registerId, entryId, responsibleId }: { registerId: string; entryId: string; responsibleId: string }) =>
      cashRegisterService.assignResponsible(registerId, entryId, responsibleId),
    onSuccess: (register, variables) => {
      qc.setQueryData(['cash-register', variables.registerId], register);
      qc.invalidateQueries({ queryKey: ['cash-register-today'] });
      qc.invalidateQueries({ queryKey: ['cash-registers'] });
      toast.success('Responsable actualizado');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'No se pudo actualizar el responsable'),
  });
}
export function useDeleteCashEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registerId, entryId, data }: { registerId: string; entryId: string; data: any }) => cashRegisterService.deleteEntry(registerId, entryId, data),
    onSuccess: () => {
      // Eliminar una entrada de caja puede disparar la cancelación de la venta original
      // (ver delete-entry.use-case.ts), lo que afecta ventas, stock, créditos y movimientos.
      // Invalidamos todos los queries relacionados para que las pantallas reflejen el cambio.
      qc.invalidateQueries({ queryKey: ['cash-register-today'] });
      qc.invalidateQueries({ queryKey: ['cash-registers'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['credit-accounts'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Entrada eliminada');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  });
}
export function useCloseCashRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registerId, data }: { registerId: string; data?: any }) => cashRegisterService.close(registerId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['cash-registers'] }); toast.success('Caja cerrada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  });
}
export function useMigrateMisplacedSales() {
  const qc = useQueryClient();
  return useMutation<MigrateMisplacedSalesResult, any, { dryRun: boolean; from?: string; to?: string }>({
    mutationFn: (data) => cashRegisterService.migrateMisplacedSales(data),
    onSuccess: (result) => {
      if (!result.dryRun) {
        qc.invalidateQueries({ queryKey: ['cash-register-today'] });
        qc.invalidateQueries({ queryKey: ['cash-registers'] });
        qc.invalidateQueries({ queryKey: ['cash-register'] });
        toast.success(`Migración completada: ${result.migrated} venta(s) movidas`);
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error en la migración'),
  });
}

export function useMigrateMisplacedPurchases() {
  const qc = useQueryClient();
  return useMutation<MigrateMisplacedPurchasesResult, any, { dryRun: boolean; from?: string; to?: string }>({
    mutationFn: (data) => cashRegisterService.migrateMisplacedPurchases(data),
    onSuccess: (result) => {
      if (!result.dryRun) {
        qc.invalidateQueries({ queryKey: ['cash-register-today'] });
        qc.invalidateQueries({ queryKey: ['cash-registers'] });
        qc.invalidateQueries({ queryKey: ['cash-register'] });
        toast.success(`Migración completada: ${result.migrated} compra(s) movidas`);
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error en la migración'),
  });
}

export function useMigrateMisplacedCreditPayments() {
  const qc = useQueryClient();
  return useMutation<MigrateMisplacedCreditPaymentsResult, any, { dryRun: boolean; from?: string; to?: string }>({
    mutationFn: (data) => cashRegisterService.migrateMisplacedCreditPayments(data),
    onSuccess: (result) => {
      if (!result.dryRun) {
        qc.invalidateQueries({ queryKey: ['cash-register-today'] });
        qc.invalidateQueries({ queryKey: ['cash-registers'] });
        qc.invalidateQueries({ queryKey: ['cash-register'] });
        qc.invalidateQueries({ queryKey: ['credit-accounts'] });
        toast.success(`Migración completada: ${result.migrated} abono(s) movidos`);
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error en la migración'),
  });
}

export function useMigrateMisplacedAPPayments() {
  const qc = useQueryClient();
  return useMutation<MigrateMisplacedAPPaymentsResult, any, { dryRun: boolean; from?: string; to?: string }>({
    mutationFn: (data) => cashRegisterService.migrateMisplacedAPPayments(data),
    onSuccess: (result) => {
      if (!result.dryRun) {
        qc.invalidateQueries({ queryKey: ['cash-register-today'] });
        qc.invalidateQueries({ queryKey: ['cash-registers'] });
        qc.invalidateQueries({ queryKey: ['cash-register'] });
        qc.invalidateQueries({ queryKey: ['accounts-payable'] });
        toast.success(`Migración completada: ${result.migrated} pago(s) movidos`);
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error en la migración'),
  });
}

export function useAdjustOpeningBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registerId, data }: { registerId: string; data: { openingBalance: number; reason: string } }) =>
      cashRegisterService.adjustOpening(registerId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-today'] }); qc.invalidateQueries({ queryKey: ['cash-registers'] }); toast.success('Apertura ajustada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  });
}

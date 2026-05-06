import { useMutation, useQuery } from '@tanstack/react-query';
import { lookupService } from '../services/lookupService';
import toast from 'react-hot-toast';

export function useDniLookup() {
  return useMutation({
    mutationFn: lookupService.searchByDni,
    onError: (err: any) => toast.error(err.response?.data?.message || 'DNI no encontrado'),
  });
}

export function useRucLookup() {
  return useMutation({
    mutationFn: lookupService.searchByRuc,
    onError: (err: any) => toast.error(err.response?.data?.message || 'RUC no encontrado'),
  });
}

export function useTipoCambio() {
  return useMutation({
    mutationFn: (date?: string) => lookupService.getTipoCambio(date),
    onError: (err: any) => toast.error(err.response?.data?.message || 'No se pudo obtener el tipo de cambio'),
  });
}

export function useTodayTipoCambio(enabled = true) {
  const today = new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: ['tipo-cambio', today],
    queryFn: () => lookupService.getTipoCambio(),
    enabled,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

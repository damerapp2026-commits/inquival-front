import { useMutation } from '@tanstack/react-query';
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

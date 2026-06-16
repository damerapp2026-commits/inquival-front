import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fiscalEntityService, type CreateFiscalEntityPayload, type UpdateFiscalEntityPayload } from '../services/fiscalEntityService';
import toast from 'react-hot-toast';

const QK = ['fiscal-entities'];

export function useFiscalEntities() {
  return useQuery({ queryKey: QK, queryFn: fiscalEntityService.findAll });
}

export function useCreateFiscalEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFiscalEntityPayload) => fiscalEntityService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success('Entidad fiscal creada');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Error al crear entidad fiscal');
    },
  });
}

export function useUpdateFiscalEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFiscalEntityPayload }) =>
      fiscalEntityService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success('Entidad fiscal actualizada');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Error al actualizar entidad fiscal');
    },
  });
}

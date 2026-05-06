import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { businessSettingsService } from '../services/businessSettingsService';
import { setCompanyInfo, COMPANY_INFO } from '../../../config/companyInfo';

export function useBusinessSettings() {
  const query = useQuery({
    queryKey: ['business-settings'],
    queryFn: businessSettingsService.get,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) setCompanyInfo(query.data);
  }, [query.data]);

  return query;
}

export function useUpdateBusinessSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: businessSettingsService.update,
    onSuccess: (data) => {
      qc.setQueryData(['business-settings'], data);
      setCompanyInfo(data);
      toast.success('Datos de la empresa actualizados');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error al actualizar');
    },
  });
}

export { COMPANY_INFO };

import { useQuery } from '@tanstack/react-query';
import { kardexService } from '../services/kardexService';

export function useKardex(params?: any) {
  return useQuery({
    queryKey: ['kardex', params],
    queryFn: () => kardexService.getMovements(params),
  });
}

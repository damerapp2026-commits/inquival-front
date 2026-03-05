import { api } from '../../../shared/services/api';

export const kardexService = {
  getMovements: (params?: any) => api.get('/stock-movements', { params }).then((r) => r.data.data),
};

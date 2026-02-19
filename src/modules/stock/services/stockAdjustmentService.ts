import { api } from '../../../shared/services/api';
export const stockAdjustmentService = {
  getAll: (params?: any) => api.get('/stock-adjustments', { params }).then((r) => r.data.data),
  create: (data: any) => api.post('/stock-adjustments', data).then((r) => r.data.data),
};

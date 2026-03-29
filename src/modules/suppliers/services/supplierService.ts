import { api } from '../../../shared/services/api';

export const supplierService = {
  getAll: (params?: any) => api.get('/suppliers', { params }).then((r) => r.data.data),
  getByRuc: (ruc: string) => api.get(`/suppliers/ruc/${ruc}`).then((r) => r.data.data),
  create: (data: any) => api.post('/suppliers', data).then((r) => r.data.data),
};

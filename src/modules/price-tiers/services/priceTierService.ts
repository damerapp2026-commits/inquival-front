import { api } from '../../../shared/services/api';
export const priceTierService = {
  getAll: (activeOnly = true) => api.get('/price-tiers', { params: { activeOnly } }).then((r) => r.data.data),
  create: (data: any) => api.post('/price-tiers', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/price-tiers/${id}`, data).then((r) => r.data.data),
};

import { api } from '../../../shared/services/api';
export const clientService = {
  getAll: (params?: any) => api.get('/clients', { params }).then((r) => r.data.data),
  create: (data: any) => api.post('/clients', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data).then((r) => r.data.data),
};

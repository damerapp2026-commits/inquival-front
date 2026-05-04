import { api } from '../../../shared/services/api';
export const unitService = {
  getAll: () => api.get('/units').then((r) => r.data.data),
  create: (data: any) => api.post('/units', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/units/${id}`, data).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/units/${id}`).then((r) => r.data.data),
};

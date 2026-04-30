import { api } from '../../../shared/services/api';
export const laboratoryService = {
  getAll: () => api.get('/laboratories').then((r) => r.data.data),
  create: (data: any) => api.post('/laboratories', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/laboratories/${id}`, data).then((r) => r.data.data),
};

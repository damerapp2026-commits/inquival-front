import { api } from '../../../shared/services/api';
export const laboratoryService = {
  getAll: () => api.get('/laboratories').then((r) => {
    const d = r.data;
    return Array.isArray(d) ? d : (d?.data ?? []);
  }),
  create: (data: any) => api.post('/laboratories', data).then((r) => r.data.data ?? r.data),
  update: (id: string, data: any) => api.put(`/laboratories/${id}`, data).then((r) => r.data.data ?? r.data),
  remove: (id: string) => api.delete(`/laboratories/${id}`),
};

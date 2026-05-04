import { api } from '../../../shared/services/api';
export const companyService = {
  getAll: () => api.get('/companies').then((r) => r.data.data),
  create: (data: any) => api.post('/companies', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/companies/${id}`, data).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/companies/${id}`).then((r) => r.data.data),
};

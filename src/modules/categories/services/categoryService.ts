import { api } from '../../../shared/services/api';
export const categoryService = {
  getAll: () => api.get('/categories').then((r) => r.data.data),
  create: (data: any) => api.post('/categories', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/categories/${id}`, data).then((r) => r.data.data),
};

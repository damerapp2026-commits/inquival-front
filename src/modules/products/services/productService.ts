import { api } from '../../../shared/services/api';
export const productService = {
  getAll: (params?: any) => api.get('/products', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/products/${id}`).then((r) => r.data.data),
  create: (data: any) => api.post('/products', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/products/${id}`).then((r) => r.data.data),
};

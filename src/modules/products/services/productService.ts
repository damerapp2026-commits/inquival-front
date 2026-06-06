import { api } from '../../../shared/services/api';
export const productService = {
  getAll: (params?: any) => api.get('/products', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/products/${id}`).then((r) => r.data.data),
  create: (data: any) => api.post('/products', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/products/${id}`).then((r) => r.data.data),
  getCountsByCategory: (): Promise<Record<string, number>> => api.get('/products/counts-by-category').then((r) => r.data.data),
  uploadImage: (file: File): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/products/upload-image', fd, {
      headers: { 'Content-Type': undefined as any },
    }).then((r) => r.data.data);
  },
};

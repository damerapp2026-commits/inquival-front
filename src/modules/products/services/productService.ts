import { api } from '../../../shared/services/api';
import type { PaginatedResponse, Product } from '../../../shared/types';

export const productService = {
  getAll: (params?: any) => api.get('/products', { params }).then((r) => r.data.data),
  getAllPages: async (params?: any): Promise<PaginatedResponse<Product>> => {
    const firstPage: PaginatedResponse<Product> = await productService.getAll({ ...params, page: 1 });
    const products = [...firstPage.data];
    const seenIds = new Set(products.map((product) => product.id));
    let page = 1;
    while (products.length < firstPage.total) {
      const nextPage: PaginatedResponse<Product> = await productService.getAll({ ...params, page: ++page });
      if (!nextPage.data.length || nextPage.data.some((product) => seenIds.has(product.id))) {
        throw new Error('No se pudieron cargar todos los productos');
      }
      nextPage.data.forEach((product) => seenIds.add(product.id));
      products.push(...nextPage.data);
    }
    return { ...firstPage, data: products };
  },
  getById: (id: string) => api.get(`/products/${id}`).then((r) => r.data.data),
  create: (data: any) => api.post('/products', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/products/${id}`).then((r) => r.data.data),
  getCountsByCategory: (): Promise<Record<string, number>> => api.get('/products/counts-by-category').then((r) => r.data.data),
  updateImage: (id: string, imageUrl: string) =>
    api.patch(`/products/${id}/image`, { imageUrl }).then((r) => r.data.data),
  uploadImage: (file: File): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/products/upload-image', fd, {
      headers: { 'Content-Type': undefined as any },
    }).then((r) => r.data.data);
  },
};

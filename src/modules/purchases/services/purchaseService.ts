import { api } from '../../../shared/services/api';
export const purchaseService = {
  getAll: (params?: any) => api.get('/purchases', { params }).then((r) => r.data.data),
  create: (data: any) => api.post('/purchases', data).then((r) => r.data.data),
  getProductSuppliers: (productId: string) =>
    api.get(`/purchases/by-product/${productId}/suppliers`).then((r) => r.data.data),
};

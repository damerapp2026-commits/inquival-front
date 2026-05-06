import { api } from '../../../shared/services/api';
export const purchaseService = {
  getAll: (params?: any) => api.get('/purchases', { params }).then((r) => r.data.data),
  create: (data: any) => api.post('/purchases', data).then((r) => r.data.data),
  getProductSuppliers: (productId: string) =>
    api.get(`/purchases/by-product/${productId}/suppliers`).then((r) => r.data.data),
  getLastPrice: (productId: string, supplierId: string) =>
    api.get('/purchases/last-price', { params: { productId, supplierId } }).then((r) => r.data.data),
  getPriceCatalog: (companyId?: string) =>
    api.get('/purchases/price-catalog', { params: companyId ? { companyId } : undefined }).then((r) => r.data.data),
  updatePriceCatalog: (
    productId: string,
    data: {
      unitPriceSinIgvUsd?: number;
      unitPriceSinIgvPen?: number;
      unitPriceConIgvUsd?: number;
      unitPriceConIgvPen?: number;
      precioMinorista?: number;
      markupPercent?: number;
    },
  ) => api.patch(`/purchases/price-catalog/${productId}`, data).then((r) => r.data.data),
};

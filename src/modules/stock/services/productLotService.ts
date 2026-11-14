import { api } from '../../../shared/services/api';
import type { ProductLot } from '../../../shared/types';

export interface CreateLotFromStockPayload {
  productId: string;
  companyId: string;
  lotNumber: string;
  expirationDate: string;
  quantity: number;
}

export const productLotService = {
  createFromStock: (payload: CreateLotFromStockPayload): Promise<ProductLot> =>
    api.post('/product-lots/from-stock', payload).then(r => r.data.data),
  updateExpirationDate: (id: string, expirationDate: string): Promise<ProductLot> =>
    api.patch(`/product-lots/${id}/expiration-date`, { expirationDate }).then(r => r.data.data),
  getByCompany: (companyId: string, productId?: string): Promise<ProductLot[]> =>
    api.get('/product-lots', { params: { companyId, ...(productId ? { productId } : {}) } }).then((r) => r.data.data),
  getExpiring: (companyId?: string, days = 30): Promise<ProductLot[]> =>
    api.get('/product-lots/expiring', { params: { ...(companyId ? { companyId } : {}), days } }).then((r) => r.data.data),
  getByProduct: (productId: string, companyId?: string): Promise<ProductLot[]> =>
    api.get('/product-lots', { params: { productId, ...(companyId ? { companyId } : {}) } }).then((r) => r.data.data),
};

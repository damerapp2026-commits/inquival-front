import { api } from '../../../shared/services/api';
import type { ProductLot } from '../../../shared/types';

export const productLotService = {
  getByCompany: (companyId: string, productId?: string): Promise<ProductLot[]> =>
    api.get('/product-lots', { params: { companyId, ...(productId ? { productId } : {}) } }).then((r) => r.data.data),
  getExpiring: (companyId: string, days = 30): Promise<ProductLot[]> =>
    api.get('/product-lots/expiring', { params: { companyId, days } }).then((r) => r.data.data),
};

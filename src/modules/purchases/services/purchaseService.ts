import { api } from '../../../shared/services/api';

export interface UpdatePurchaseFullPayload {
  reason: string;
  updatedAt?: string;
  supplier?: string;
  supplierId?: string | null;
  supplierRuc?: string | null;
  documentType?: string | null;
  documentSeries?: string | null;
  documentNumber?: string | null;
  issueDate?: string | null;
  date?: string;
  currency?: 'PEN' | 'USD';
  exchangeRate?: number | null;
  exchangeRateDate?: string;
  totalCost?: number;
  totalCostUsd?: number;
  paymentType?: 'CONTADO' | 'CREDITO';
  paymentMethodId?: string;
  paymentScheduleType?: 'SINGLE_DATE' | 'INSTALLMENTS';
  dueDate?: string;
  installments?: { amount: number; dueDate: string }[];
  items?: Array<{
    companyId: string;
    productId: string;
    quantity: number;
    unitCost: number;
    unitPriceSinIgv: number;
    unitPriceConIgv: number;
    precioVenta?: number;
    markupPercent?: number;
    lotNumber?: string;
    expirationDate?: string;
  }>;
}

export const purchaseService = {
  getAll: (params?: any) => api.get('/purchases', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/purchases/${id}`).then((r) => r.data.data),
  create: (data: any) => api.post('/purchases', data).then((r) => r.data.data),
  update: (
    id: string,
    data: {
      supplier?: string;
      supplierId?: string | null;
      supplierRuc?: string | null;
      documentType?: string | null;
      documentSeries?: string | null;
      documentNumber?: string | null;
      issueDate?: string | null;
      grSeries?: string;
      grNumber?: string;
      grDate?: string;
    },
  ) => api.patch(`/purchases/${id}`, data).then((r) => r.data.data),
  updateFull: (id: string, data: UpdatePurchaseFullPayload) =>
    api.patch(`/purchases/${id}/full`, data).then((r) => r.data.data),
  cancel: (id: string, data: { reason: string }) =>
    api.delete(`/purchases/${id}`, { data }).then((r) => r.data.data),
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

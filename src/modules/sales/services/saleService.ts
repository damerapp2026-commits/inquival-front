import { api } from '../../../shared/services/api';

export interface UpdateSaleItemsPayload {
  id: string;
  items: { productId: string; companyId: string; priceTier: string; quantity: number; unitPrice: number }[];
  payments?: { paymentMethodId: string; amount: number }[];
  reason: string;
}

export interface VoucherPdfResult {
  pdfUrl: string;
  whatsappUrl: string | null;
  generatedAt: string;
  cached: boolean;
}

export const saleService = {
  getAll: (params?: any) => api.get('/sales', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/sales/${id}`).then((r) => r.data.data),
  create: (data: any) => api.post('/sales', data).then((r) => r.data.data),
  updateVoucher: ({ id, voucherType }: { id: string; voucherType: string }) => api.patch(`/sales/${id}/voucher`, { voucherType }).then((r) => r.data.data),
  updateItems: ({ id, items, payments, reason }: UpdateSaleItemsPayload) => api.patch(`/sales/${id}/items`, { items, payments, reason }).then((r) => r.data.data),
  updateDate: ({ id, date, reason }: { id: string; date: string; reason: string }) => api.patch(`/sales/${id}/date`, { date, reason }).then((r) => r.data.data),
  cancel: ({ id, reason }: { id: string; reason: string }) => api.delete(`/sales/${id}`, { data: { reason } }).then((r) => r.data.data),
  getVoucherPdf: (id: string, opts: { force?: boolean } = {}): Promise<VoucherPdfResult> =>
    api.get(`/sales/${id}/voucher-pdf`, { params: opts.force ? { force: 'true' } : undefined }).then((r) => r.data.data),
};

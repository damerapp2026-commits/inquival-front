import { api } from '../../../shared/services/api';
export const saleService = {
  getAll: (params?: any) => api.get('/sales', { params }).then((r) => r.data.data),
  create: (data: any) => api.post('/sales', data).then((r) => r.data.data),
  updateVoucher: ({ id, voucherType }: { id: string; voucherType: string }) => api.patch(`/sales/${id}/voucher`, { voucherType }).then((r) => r.data.data),
  cancel: ({ id, reason }: { id: string; reason: string }) => api.delete(`/sales/${id}`, { data: { reason } }).then((r) => r.data.data),
};

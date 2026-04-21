import { api } from '../../../shared/services/api';

export const accountPayableService = {
  getAll: (params?: any) => api.get('/accounts-payable', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/accounts-payable/${id}`).then((r) => r.data.data),
  getAlerts: (days?: number) => api.get('/accounts-payable/alerts', { params: { days } }).then((r) => r.data.data),
  registerPayment: (id: string, data: { amount: number; notes?: string }) => api.post(`/accounts-payable/${id}/payments`, data).then((r) => r.data.data),
  updateNumeroUnico: (id: string, data: { numeroUnico: string; installmentId?: string }) => api.patch(`/accounts-payable/${id}/numero-unico`, data).then((r) => r.data.data),
};

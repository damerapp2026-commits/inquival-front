import { api } from '../../../shared/services/api';
export const creditService = {
  getAll: (params?: any) => api.get('/credits', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/credits/${id}`).then((r) => r.data.data),
  getByClient: (clientId: string, params?: any) => api.get(`/credits/client/${clientId}`, { params }).then((r) => r.data.data),
  getOpenByClient: (clientId: string) => api.get(`/credits/client/${clientId}/open`).then((r) => r.data.data),
  registerPayment: (id: string, data: any) => api.post(`/credits/${id}/payments`, data).then((r) => r.data.data),
  registerBatchPayment: (data: any) => api.post('/credits/payments/batch', data).then((r) => r.data.data),
  edit: (id: string, data: any) => api.patch(`/credits/${id}`, data).then((r) => r.data.data),
  editItems: (id: string, data: any) => api.patch(`/credits/${id}/items`, data).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/credits/${id}`).then((r) => r.data.data),
};

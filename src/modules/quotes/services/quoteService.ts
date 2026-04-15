import { api } from '../../../shared/services/api';

export const quoteService = {
  getAll: (params?: any) => api.get('/quotes', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/quotes/${id}`).then((r) => r.data.data),
  create: (data: any) => api.post('/quotes', data).then((r) => r.data.data),
  setStatus: ({ id, status }: { id: string; status: string }) =>
    api.patch(`/quotes/${id}/status`, { status }).then((r) => r.data.data),
  convert: ({ id, payload }: { id: string; payload: any }) =>
    api.post(`/quotes/${id}/convert`, payload).then((r) => r.data.data),
};

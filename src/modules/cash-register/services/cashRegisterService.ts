import { api } from '../../../shared/services/api';
export const cashRegisterService = {
  open: (data?: any) => api.post('/cash-registers/open', data || {}).then((r) => r.data.data),
  getToday: () => api.get('/cash-registers/today').then((r) => r.data.data),
  getAll: (params?: any) => api.get('/cash-registers', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/cash-registers/${id}`).then((r) => r.data.data),
  getByDate: (date: string) => api.get('/cash-registers/by-date', { params: { date } }).then((r) => r.data.data),
  addEntry: (id: string, data: any) => api.post(`/cash-registers/${id}/entries`, data).then((r) => r.data.data),
  editEntry: (id: string, entryId: string, data: any) => api.patch(`/cash-registers/${id}/entries/${entryId}`, data).then((r) => r.data.data),
  deleteEntry: (id: string, entryId: string, data: any) => api.delete(`/cash-registers/${id}/entries/${entryId}`, { data }).then((r) => r.data.data),
  close: (id: string, data?: any) => api.post(`/cash-registers/${id}/close`, data || {}).then((r) => r.data.data),
  adjustOpening: (id: string, data: { openingBalance: number; reason: string }) =>
    api.patch(`/cash-registers/${id}/opening-balance`, data).then((r) => r.data.data),
};

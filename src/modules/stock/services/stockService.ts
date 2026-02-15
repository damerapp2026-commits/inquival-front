import { api } from '../../../shared/services/api';
export const stockService = {
  getByCompany: (companyId: string, params?: any) => api.get(`/stock/company/${companyId}`, { params }).then((r) => r.data.data),
  transfer: (data: any) => api.post('/stock/transfer', data).then((r) => r.data.data),
  getAlerts: (companyId: string, threshold?: number) => api.get(`/stock/alerts/${companyId}`, { params: { threshold } }).then((r) => r.data.data),
};

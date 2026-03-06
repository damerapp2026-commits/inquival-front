import { api } from '../../../shared/services/api';

export const loanService = {
  getAll: (params?: any) => api.get('/loans', { params }).then((r) => r.data.data),
  create: (data: any) => api.post('/loans', data).then((r) => r.data.data),
  returnItems: (loanId: string, data: any) => api.post(`/loans/${loanId}/returns`, data).then((r) => r.data.data),
};

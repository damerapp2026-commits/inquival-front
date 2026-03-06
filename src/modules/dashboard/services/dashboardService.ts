import { api } from '../../../shared/services/api';
export const dashboardService = {
  getSummary: (period?: string) => api.get('/dashboard/summary', { params: { period } }).then((r) => r.data.data),
  getProfitability: () => api.get('/dashboard/profitability').then((r) => r.data.data),
  getCreditsSummary: () => api.get('/dashboard/credits-summary').then((r) => r.data.data),
  getSalesChart: () => api.get('/dashboard/sales-chart').then((r) => r.data.data),
};

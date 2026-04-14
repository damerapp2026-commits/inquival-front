import { api } from '../../../shared/services/api';
export const dashboardService = {
  getSummary: (period?: string) => api.get('/dashboard/summary', { params: { period } }).then((r) => r.data.data),
  getProfitability: () => api.get('/dashboard/profitability').then((r) => r.data.data),
  getCreditsSummary: () => api.get('/dashboard/credits-summary').then((r) => r.data.data),
  getSalesChart: (startDate?: string, endDate?: string) =>
    api.get('/dashboard/sales-chart', { params: { startDate, endDate } }).then((r) => r.data.data),
  getCategorySalesChart: (startDate?: string, endDate?: string) =>
    api.get('/dashboard/category-sales-chart', { params: { startDate, endDate } }).then((r) => r.data.data),
  getCategorySales: (startDate?: string, endDate?: string) =>
    api.get('/dashboard/category-sales', { params: { startDate, endDate } }).then((r) => r.data.data),
  getTopSuppliers: (startDate?: string, endDate?: string) =>
    api.get('/dashboard/top-suppliers', { params: { startDate, endDate } }).then((r) => r.data.data),
};

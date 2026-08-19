import { api } from '../../../shared/services/api';

export interface DashboardSummary {
  period: string;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalIncomePen: number;
  totalIncomeUsd: number;
  totalIncomeUsdPen: number;
  totalExpense: number;
  totalExpensePen: number;
  totalExpenseUsd: number;
  totalExpenseUsdPen: number;
  netProfit: number;
  registersCount: number;
}

export type DashboardPeriodQuery = {
  period?: string;
  startDate?: string;
  endDate?: string;
};

export const dashboardService = {
  getSummary: (query?: DashboardPeriodQuery): Promise<DashboardSummary> =>
    api.get('/dashboard/summary', { params: query }).then((r) => r.data.data),
  getProfitability: (startDate?: string, endDate?: string) =>
    api.get('/dashboard/profitability', { params: { startDate, endDate } }).then((r) => r.data.data),
  getCreditsSummary: (query?: DashboardPeriodQuery) =>
    api.get('/dashboard/credits-summary', { params: query }).then((r) => r.data.data),
  getPayablesSummary: (query?: DashboardPeriodQuery) =>
    api.get('/dashboard/payables-summary', { params: query }).then((r) => r.data.data),
  getSalesChart: (startDate?: string, endDate?: string) =>
    api.get('/dashboard/sales-chart', { params: { startDate, endDate } }).then((r) => r.data.data),
  getCategorySalesChart: (startDate?: string, endDate?: string) =>
    api.get('/dashboard/category-sales-chart', { params: { startDate, endDate } }).then((r) => r.data.data),
  getCategorySales: (startDate?: string, endDate?: string) =>
    api.get('/dashboard/category-sales', { params: { startDate, endDate } }).then((r) => r.data.data),
  getTopSuppliers: (startDate?: string, endDate?: string) =>
    api.get('/dashboard/top-suppliers', { params: { startDate, endDate } }).then((r) => r.data.data),
  getExchangeRate: (days: number) =>
    api.get('/dashboard/exchange-rate', { params: { days } }).then((r) => r.data.data),
};

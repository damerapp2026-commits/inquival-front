import { useQuery } from '@tanstack/react-query';
import { dashboardService, type DashboardPeriodQuery } from '../services/dashboardService';

function hasCompleteCustomRange(query?: DashboardPeriodQuery) {
  if (query?.period !== 'custom') return true;
  return Boolean(query.startDate && query.endDate);
}

export function useDashboardSummary(query?: DashboardPeriodQuery) {
  return useQuery({
    queryKey: ['dashboard-summary', query],
    queryFn: () => dashboardService.getSummary(query),
    placeholderData: (previous) => previous,
    enabled: hasCompleteCustomRange(query),
  });
}
export function useProfitability(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['dashboard-profitability', startDate, endDate],
    queryFn: () => dashboardService.getProfitability(startDate, endDate),
  });
}
export function useCreditsSummary(query?: DashboardPeriodQuery) {
  return useQuery({
    queryKey: ['dashboard-credits-summary', query],
    queryFn: () => dashboardService.getCreditsSummary(query),
    placeholderData: (previous) => previous,
    enabled: hasCompleteCustomRange(query),
  });
}
export function usePayablesSummary(query?: DashboardPeriodQuery) {
  return useQuery({
    queryKey: ['dashboard-payables-summary', query],
    queryFn: () => dashboardService.getPayablesSummary(query),
    placeholderData: (previous) => previous,
    enabled: hasCompleteCustomRange(query),
  });
}
export function useSalesChart(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['dashboard-sales-chart', startDate, endDate],
    queryFn: () => dashboardService.getSalesChart(startDate, endDate),
  });
}
export function useCategorySalesChart(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['dashboard-category-sales-chart', startDate, endDate],
    queryFn: () => dashboardService.getCategorySalesChart(startDate, endDate),
  });
}
export function useCategorySales(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['dashboard-category-sales', startDate, endDate],
    queryFn: () => dashboardService.getCategorySales(startDate, endDate),
  });
}
export function useTopSuppliers(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['dashboard-top-suppliers', startDate, endDate],
    queryFn: () => dashboardService.getTopSuppliers(startDate, endDate),
  });
}
export function useExchangeRate(days: number) {
  return useQuery({
    queryKey: ['dashboard-exchange-rate', days],
    queryFn: () => dashboardService.getExchangeRate(days),
    staleTime: 30 * 60 * 1000, // 30 min — el tipo de cambio no cambia frecuentemente
  });
}

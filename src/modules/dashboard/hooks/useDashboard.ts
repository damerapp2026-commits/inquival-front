import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';

export function useDashboardSummary(period?: string) {
  return useQuery({ queryKey: ['dashboard-summary', period], queryFn: () => dashboardService.getSummary(period) });
}
export function useProfitability() {
  return useQuery({ queryKey: ['dashboard-profitability'], queryFn: () => dashboardService.getProfitability() });
}
export function useCreditsSummary() {
  return useQuery({ queryKey: ['dashboard-credits-summary'], queryFn: () => dashboardService.getCreditsSummary() });
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

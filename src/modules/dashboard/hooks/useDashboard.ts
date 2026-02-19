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

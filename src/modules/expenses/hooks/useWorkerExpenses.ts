import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workerExpenseService } from '../services/workerExpenseService';
import type { WorkerExpenseReportStatus } from '../../../shared/types';

export function useMyWorkerExpenseReport(month: number, year: number) {
  return useQuery({
    queryKey: ['worker-expenses', 'my-report', month, year],
    queryFn: () => workerExpenseService.getMyReport(month, year),
  });
}

export function useSaveWorkerExpenseEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workerExpenseService.saveEntries,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-expenses', 'my-report'] });
      toast.success('Gastos guardados');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al guardar gastos'),
  });
}

export function useSubmitWorkerExpenseReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workerExpenseService.submitReport,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-expenses'] });
      toast.success('Reporte enviado para revisión');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al enviar reporte'),
  });
}

export function useWorkerExpenseBudget(workerId: string | undefined) {
  return useQuery({
    queryKey: ['worker-expenses', 'budget', workerId],
    queryFn: () => workerExpenseService.getBudget(workerId!),
    enabled: !!workerId,
  });
}

export function useWorkerExpenseBudgets() {
  return useQuery({ queryKey: ['worker-expenses', 'budgets'], queryFn: workerExpenseService.getAllBudgets });
}

export function useSetWorkerExpenseBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workerExpenseService.setBudget,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-expenses', 'budget'] });
      qc.invalidateQueries({ queryKey: ['worker-expenses', 'budgets'] });
      toast.success('Tope de viáticos actualizado');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al actualizar tope'),
  });
}

export function useWorkerExpenseReports(params?: { workerId?: string; month?: number; year?: number; status?: WorkerExpenseReportStatus }) {
  return useQuery({
    queryKey: ['worker-expenses', 'reports', params],
    queryFn: () => workerExpenseService.getReports(params),
  });
}

export function useWorkerExpenseReport(id: string | undefined) {
  return useQuery({
    queryKey: ['worker-expenses', 'report', id],
    queryFn: () => workerExpenseService.getReportById(id!),
    enabled: !!id,
  });
}

export function useReviewWorkerExpenseReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workerExpenseService.reviewReport,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-expenses', 'reports'] });
      qc.invalidateQueries({ queryKey: ['worker-expenses', 'report'] });
      toast.success('Reporte revisado');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al revisar reporte'),
  });
}

import { api } from '../../../shared/services/api';
import type { WorkerExpenseBudget, WorkerExpenseEntry, WorkerExpenseReportStatus } from '../../../shared/types';

export const workerExpenseService = {
  getMyReport: (month: number, year: number) =>
    api.get('/worker-expenses/my-report', { params: { month, year } }).then((r) => r.data.data),

  saveEntries: ({ id, depositedAmount, entries }: { id: string; depositedAmount?: number; entries: WorkerExpenseEntry[] }) =>
    api.patch(`/worker-expenses/reports/${id}/entries`, { depositedAmount, entries }).then((r) => r.data.data),

  submitReport: (id: string) => api.post(`/worker-expenses/reports/${id}/submit`).then((r) => r.data.data),

  getBudget: (workerId: string) =>
    api.get(`/worker-expenses/budgets/${workerId}`).then((r) => r.data.data as WorkerExpenseBudget),

  getAllBudgets: () => api.get('/worker-expenses/budgets').then((r) => r.data.data as WorkerExpenseBudget[]),

  setBudget: ({ workerId, data }: { workerId: string; data: Partial<WorkerExpenseBudget> }) =>
    api.patch(`/worker-expenses/budgets/${workerId}`, data).then((r) => r.data.data),

  getReports: (params?: { workerId?: string; month?: number; year?: number; status?: WorkerExpenseReportStatus }) =>
    api.get('/worker-expenses/reports', { params }).then((r) => r.data.data),

  getReportById: (id: string) => api.get(`/worker-expenses/reports/${id}`).then((r) => r.data.data),

  reviewReport: ({ id, status, reviewNotes }: { id: string; status: 'APPROVED' | 'REJECTED'; reviewNotes?: string }) =>
    api.patch(`/worker-expenses/reports/${id}/review`, { status, reviewNotes }).then((r) => r.data.data),
};

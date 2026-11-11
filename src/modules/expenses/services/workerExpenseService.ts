import { api } from '../../../shared/services/api';
import type {
  WorkerExpenseBudget,
  WorkerExpenseEntry,
  WorkerExpenseReportStatus,
  WorkerExpenseReport,
} from '../../../shared/types';

export const workerExpenseService = {
  getMyReport: (month: number, year: number) =>
    api
      .get('/worker-expenses/my-report', { params: { month, year } })
      .then((r) => r.data.data as WorkerExpenseReport | null),

  createMyReport: (month: number, year: number) =>
    api
      .post('/worker-expenses/my-report', { month, year })
      .then((r) => r.data.data as WorkerExpenseReport),

  saveEntries: ({
    id,
    version,
    entries,
  }: {
    id: string;
    version: number;
    entries: WorkerExpenseEntry[];
  }) =>
    api
      .patch(`/worker-expenses/reports/${id}/entries`, { version, entries })
      .then((r) => r.data.data as WorkerExpenseReport),

  submitReport: ({
    id,
    version,
    entries,
  }: {
    id: string;
    version: number;
    entries: WorkerExpenseEntry[];
  }) =>
    api
      .post(`/worker-expenses/reports/${id}/submit`, { version, entries })
      .then((r) => r.data.data as WorkerExpenseReport),

  setAdvance: ({
    id,
    version,
    depositedAmount,
    note,
  }: {
    id: string;
    version: number;
    depositedAmount: number;
    note: string;
  }) =>
    api
      .patch(`/worker-expenses/reports/${id}/advance`, { version, depositedAmount, note })
      .then((r) => r.data.data as WorkerExpenseReport),

  getBudget: (workerId: string) =>
    api.get(`/worker-expenses/budgets/${workerId}`).then((r) => r.data.data as WorkerExpenseBudget),

  getAllBudgets: () =>
    api.get('/worker-expenses/budgets').then((r) => r.data.data as WorkerExpenseBudget[]),

  setBudget: ({ workerId, data }: { workerId: string; data: Partial<WorkerExpenseBudget> }) =>
    api.patch(`/worker-expenses/budgets/${workerId}`, data).then((r) => r.data.data),

  getReports: (params?: {
    workerId?: string;
    month?: number;
    year?: number;
    status?: WorkerExpenseReportStatus;
  }) => api.get('/worker-expenses/reports', { params }).then((r) => r.data.data),

  getReportById: (id: string) => api.get(`/worker-expenses/reports/${id}`).then((r) => r.data.data),

  reviewReport: ({
    id,
    version,
    status,
    reviewNotes,
  }: {
    id: string;
    version: number;
    status: 'APPROVED' | 'REJECTED';
    reviewNotes?: string;
  }) =>
    api
      .patch(`/worker-expenses/reports/${id}/review`, { version, status, reviewNotes })
      .then((r) => r.data.data),
};

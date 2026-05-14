import { api } from '../../../shared/services/api';
export const creditService = {
  getAll: (params?: any) => api.get('/credits', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/credits/${id}`).then((r) => r.data.data),
  getByClient: (clientId: string, params?: any) => api.get(`/credits/client/${clientId}`, { params }).then((r) => r.data.data),
  getOpenByClient: (clientId: string) => api.get(`/credits/client/${clientId}/open`).then((r) => r.data.data),
  createHistorical: (data: any) => api.post('/credits/historical', data).then((r) => r.data.data),
  registerPayment: (id: string, data: any) => api.post(`/credits/${id}/payments`, data).then((r) => r.data.data),
  registerBatchPayment: (data: any) => api.post('/credits/payments/batch', data).then((r) => r.data.data),
  editPayment: (creditId: string, paymentId: string, data: any) =>
    api.patch(`/credits/${creditId}/payments/${paymentId}`, data).then((r) => r.data.data),
  edit: (id: string, data: any) => api.patch(`/credits/${id}`, data).then((r) => r.data.data),
  editItems: (id: string, data: any) => api.patch(`/credits/${id}/items`, data).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/credits/${id}`).then((r) => r.data.data),
  migrateMisdated: (data: { dryRun: boolean; from?: string; to?: string }) =>
    api.post('/credits/admin/migrate-misdated', data).then((r) => r.data.data),
};

export interface MisdatedCreditRow {
  creditId: string;
  clientName?: string;
  currentDate: string;
  targetDate: string;
  saleId: string;
  saleNumber?: string;
  totalAmount: number;
}

export interface MigrateMisdatedCreditsResult {
  dryRun: boolean;
  scanned: number;
  misdated: MisdatedCreditRow[];
  migrated: number;
  errors: { creditId: string; reason: string }[];
}

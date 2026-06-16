import { api } from '../../../shared/services/api';

export const accountPayableService = {
  getAll: (params?: any) => api.get('/accounts-payable', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/accounts-payable/${id}`).then((r) => r.data.data),
  getAlerts: (days?: number) => api.get('/accounts-payable/alerts', { params: { days } }).then((r) => r.data.data),
  registerPayment: (
    id: string,
    data: {
      amount: number;
      paymentCurrency?: 'PEN' | 'USD';
      exchangeRate?: number;
      codigoTransferencia?: string;
      notes?: string;
      paymentDate?: string;
      paymentMethodId?: string;
    },
  ) => api.post(`/accounts-payable/${id}/payments`, data).then((r) => r.data.data),
  updateNumeroUnico: (id: string, data: { numeroUnico: string; installmentId?: string }) => api.patch(`/accounts-payable/${id}/numero-unico`, data).then((r) => r.data.data),
  migrateMisdated: (data: { dryRun: boolean; from?: string; to?: string }) =>
    api.post('/accounts-payable/admin/migrate-misdated', data).then((r) => r.data.data),
};

export interface MisdatedAccountPayableRow {
  accountPayableId: string;
  purchaseId: string;
  supplier: string;
  currentDate: string;
  targetDate: string;
  totalAmount: number;
  currency?: string;
  documentLabel?: string;
}

export interface MigrateMisdatedAccountPayablesResult {
  dryRun: boolean;
  scanned: number;
  misdated: MisdatedAccountPayableRow[];
  migrated: number;
  errors: { accountPayableId: string; reason: string }[];
}

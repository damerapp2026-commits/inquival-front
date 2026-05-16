import { api } from '../../../shared/services/api';
export const cashRegisterService = {
  open: (data?: any) => api.post('/cash-registers/open', data || {}).then((r) => r.data.data),
  getToday: () => api.get('/cash-registers/today').then((r) => r.data.data),
  getAll: (params?: any) => api.get('/cash-registers', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/cash-registers/${id}`).then((r) => r.data.data),
  getByDate: (date: string) => api.get('/cash-registers/by-date', { params: { date } }).then((r) => r.data.data),
  addEntry: (id: string, data: any) => api.post(`/cash-registers/${id}/entries`, data).then((r) => r.data.data),
  editEntry: (id: string, entryId: string, data: any) => api.patch(`/cash-registers/${id}/entries/${entryId}`, data).then((r) => r.data.data),
  deleteEntry: (id: string, entryId: string, data: any) => api.delete(`/cash-registers/${id}/entries/${entryId}`, { data }).then((r) => r.data.data),
  close: (id: string, data?: any) => api.post(`/cash-registers/${id}/close`, data || {}).then((r) => r.data.data),
  adjustOpening: (id: string, data: { openingBalance: number; reason: string }) =>
    api.patch(`/cash-registers/${id}/opening-balance`, data).then((r) => r.data.data),
  migrateMisplacedSales: (data: { dryRun: boolean; from?: string; to?: string }) =>
    api.post('/cash-registers/admin/migrate-misplaced-sales', data).then((r) => r.data.data),
  migrateMisplacedPurchases: (data: { dryRun: boolean; from?: string; to?: string }) =>
    api.post('/cash-registers/admin/migrate-misplaced-purchases', data).then((r) => r.data.data),
  migrateMisplacedCreditPayments: (data: { dryRun: boolean; from?: string; to?: string }) =>
    api.post('/cash-registers/admin/migrate-misplaced-credit-payments', data).then((r) => r.data.data),
  migrateMisplacedAPPayments: (data: { dryRun: boolean; from?: string; to?: string }) =>
    api.post('/cash-registers/admin/migrate-misplaced-ap-payments', data).then((r) => r.data.data),
};

export interface MisplacedSaleRow {
  saleId: string;
  saleNumber?: string;
  saleDate: string;
  currentRegisterDate: string;
  targetRegisterDate: string;
  entryId: string;
  amount: number;
  paymentMethodLabel?: string;
  clientName?: string;
}

export interface MigrateMisplacedSalesResult {
  dryRun: boolean;
  scanned: number;
  misplaced: MisplacedSaleRow[];
  migrated: number;
  registersAffected: string[];
  errors: { saleId: string; reason: string }[];
}

export interface MisplacedPurchaseRow {
  purchaseId: string;
  supplier?: string;
  purchaseDate: string;
  currentRegisterDate: string;
  targetRegisterDate: string;
  entryId: string;
  amount: number;
  documentLabel?: string;
}

export interface MigrateMisplacedPurchasesResult {
  dryRun: boolean;
  scanned: number;
  misplaced: MisplacedPurchaseRow[];
  migrated: number;
  registersAffected: string[];
  errors: { purchaseId: string; reason: string }[];
}

export interface MisplacedCreditPaymentRow {
  creditId: string;
  paymentId?: string;
  paymentDate: string;
  currentRegisterDate: string;
  targetRegisterDate: string;
  entryId: string;
  amount: number;
  clientName?: string;
  paymentMethodLabel?: string;
}

export interface MigrateMisplacedCreditPaymentsResult {
  dryRun: boolean;
  scanned: number;
  misplaced: MisplacedCreditPaymentRow[];
  migrated: number;
  registersAffected: string[];
  errors: { creditId: string; reason: string }[];
}

export interface MisplacedAPPaymentRow {
  accountPayableId: string;
  paymentId?: string;
  paymentDate: string;
  currentRegisterDate: string;
  targetRegisterDate: string;
  entryId: string;
  amount: number;
  supplier?: string;
  documentLabel?: string;
}

export interface MigrateMisplacedAPPaymentsResult {
  dryRun: boolean;
  scanned: number;
  misplaced: MisplacedAPPaymentRow[];
  migrated: number;
  registersAffected: string[];
  errors: { accountPayableId: string; reason: string }[];
}

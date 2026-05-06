import { api } from '../../../shared/services/api';
import type { CompanyInfo } from '../../../config/companyInfo';

export const businessSettingsService = {
  get: (): Promise<CompanyInfo> =>
    api.get('/business-settings').then((r) => r.data.data),
  update: (data: Partial<CompanyInfo>): Promise<CompanyInfo> =>
    api.put('/business-settings', data).then((r) => r.data.data),
};

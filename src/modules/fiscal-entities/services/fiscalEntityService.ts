import { api } from '../../../shared/services/api';
import type { FiscalEntity } from '../../../shared/types';

export interface CreateFiscalEntityPayload {
  legalName: string;
  ruc: string;
  address?: string;
  isDefault?: boolean;
}

export interface UpdateFiscalEntityPayload {
  legalName?: string;
  ruc?: string;
  address?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export const fiscalEntityService = {
  findAll: async (): Promise<FiscalEntity[]> => {
    const res = await api.get('/fiscal-entities');
    return res.data?.data ?? res.data;
  },
  create: async (payload: CreateFiscalEntityPayload): Promise<FiscalEntity> => {
    const res = await api.post('/fiscal-entities', payload);
    return res.data?.data ?? res.data;
  },
  update: async (id: string, payload: UpdateFiscalEntityPayload): Promise<FiscalEntity> => {
    const res = await api.put(`/fiscal-entities/${id}`, payload);
    return res.data?.data ?? res.data;
  },
};

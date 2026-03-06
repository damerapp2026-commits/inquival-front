import { api } from '../../../shared/services/api';

export const paymentMethodService = {
  getAll: () => api.get('/payment-methods').then((r) => r.data.data),
};

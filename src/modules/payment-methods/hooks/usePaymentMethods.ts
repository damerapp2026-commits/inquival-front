import { useQuery } from '@tanstack/react-query';
import { paymentMethodService } from '../services/paymentMethodService';

export function usePaymentMethods() {
  return useQuery({ queryKey: ['payment-methods'], queryFn: paymentMethodService.getAll });
}

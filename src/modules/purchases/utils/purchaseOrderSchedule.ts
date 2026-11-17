import { splitPurchaseInstallments } from './purchaseForm';
import { addDaysToDate } from './purchaseOrderDetails';

export interface OrderInstallment { amount: number; dueDate: string; }

export interface OrderInstallmentGenerator {
  count: number;
  intervalDays: number;
  firstDays: number;
}

export function generateOrderInstallments(total: number, issueDate: string, config: OrderInstallmentGenerator): OrderInstallment[] {
  const { count, intervalDays, firstDays } = config;
  if (!Number.isFinite(total) || total <= 0 || !Number.isInteger(count) || count < 1 || count > 36
    || !Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650
    || !Number.isInteger(firstDays) || firstDays < 0 || firstDays + (count - 1) * intervalDays > 3650
    || !issueDate || addDaysToDate(issueDate, 0) !== issueDate) return [];
  return splitPurchaseInstallments(total, count).map((amount, index) => ({
    amount,
    dueDate: addDaysToDate(issueDate, firstDays + index * intervalDays),
  }));
}

export function orderInstallmentsError(installments: OrderInstallment[], total: number, issueDate: string): string | undefined {
  if (!installments.length) return 'Genera o agrega las cuotas del crédito.';
  if (installments.some(i => !Number.isFinite(i.amount) || i.amount <= 0 || Math.abs(i.amount * 100 - Math.round(i.amount * 100)) > 1e-7)) {
    return 'Cada cuota debe tener un monto positivo con hasta dos decimales.';
  }
  if (installments.some(i => !i.dueDate || addDaysToDate(i.dueDate, 0) !== i.dueDate || i.dueDate < issueDate)) {
    return 'Cada cuota debe tener una fecha válida, igual o posterior a la fecha del pedido.';
  }
  if (installments.reduce((sum, i) => sum + Math.round(i.amount * 100), 0) !== Math.round(total * 100)) {
    return 'La suma de las cuotas debe coincidir con el total de la orden. Ajusta los montos o vuelve a generarlas.';
  }
}

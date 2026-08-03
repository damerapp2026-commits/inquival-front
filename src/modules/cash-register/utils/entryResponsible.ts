import type { CashRegisterEntry } from '../../../shared/types';

/**
 * En pagos de crédito, el responsable es quien recibió el dinero. Para los
 * movimientos anteriores a este campo se conserva createdBy como respaldo.
 */
export function entryResponsibleId(entry: CashRegisterEntry): string | undefined {
  if (entry.category === 'CREDIT_PAYMENT') {
    return entry.receivedBy || entry.createdBy;
  }
  return entry.createdBy;
}

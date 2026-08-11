import type { CashRegisterEntry } from '../../../shared/types';

/**
 * El responsable asignado manualmente tiene prioridad. Para movimientos
 * anteriores a este campo se conserva createdBy como respaldo.
 */
export function entryResponsibleId(entry: CashRegisterEntry): string | undefined {
  return entry.receivedBy || entry.createdBy;
}

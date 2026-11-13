import type { CreditAccount, Sale } from '../../../shared/types';
import { addDaysToDate, addMonthsToDate, getTodayDateString, toLocalDateString } from '../../../shared/utils/date.util';

export interface ClientStatementPeriod { from: string; to: string; }
export type StatementPeriodPreset = 'all' | 'month' | 'previousMonth' | 'custom';
export interface StatementPeriodSelection extends ClientStatementPeriod { preset: StatementPeriodPreset; }
export interface ClientStatementSelection { period: StatementPeriodSelection; creditIds?: string[]; }

export function statementPeriodSelection(preset: StatementPeriodPreset = 'all', today = getTodayDateString()): StatementPeriodSelection {
  const monthStart = `${today.slice(0, 7)}-01`;
  return preset === 'previousMonth'
    ? { preset, from: addMonthsToDate(monthStart, -1), to: addDaysToDate(monthStart, -1) }
    : { preset, from: monthStart, to: today };
}

export function selectedStatementPeriod(selection: StatementPeriodSelection): ClientStatementPeriod | undefined {
  return selection.preset === 'all' ? undefined : { from: selection.from, to: selection.to };
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function statementPeriodError(period?: ClientStatementPeriod): string | undefined {
  if (!period) return undefined;
  if (!validDate(period.from) || !validDate(period.to)) return 'Completa las fechas Desde y Hasta.';
  if (period.from > period.to) return 'La fecha Desde no puede ser posterior a Hasta.';
  return undefined;
}

export function isInStatementPeriod(value: string | undefined, period?: ClientStatementPeriod): boolean {
  if (!period) return true;
  const error = statementPeriodError(period);
  if (error) throw new Error(error);
  const day = value ? toLocalDateString(value) : '';
  return !!day && day >= period.from && day <= period.to;
}

export function filterStatementCredits(credits: CreditAccount[], period?: ClientStatementPeriod): CreditAccount[] {
  const error = statementPeriodError(period);
  if (error) throw new Error(error);
  return credits.filter(credit => isInStatementPeriod(credit.createdAt, period));
}

export function filterStatementSales(sales: Sale[], period?: ClientStatementPeriod): Sale[] {
  const error = statementPeriodError(period);
  if (error) throw new Error(error);
  return sales.filter(sale => !sale.isCancelled && isInStatementPeriod(sale.date, period));
}

export function selectClientStatementData(credits: CreditAccount[], sales: Sale[] | undefined, period?: ClientStatementPeriod, creditIds?: string[]) {
  const selectedIds = creditIds === undefined ? undefined : new Set(creditIds);
  const selectedCredits = filterStatementCredits(credits, period).filter(credit => !selectedIds || selectedIds.has(credit.id));
  const saleIds = new Set(selectedCredits.flatMap(credit => [
    ...(credit.saleIds || []), ...(credit.saleDetails || []).map(sale => sale.saleId),
  ]));
  const selectedSales = filterStatementSales(sales || [], period).filter(sale => selectedIds === undefined || saleIds.has(sale.id));
  return { credits: selectedCredits, sales: selectedSales };
}

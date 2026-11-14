import type { CreditAccount } from '../../../shared/types';
import { toLocalDateString } from '../../../shared/utils/date.util';
import { creditAccountText } from './creditReference';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

function dateTerms(value?: string): string[] {
  const day = value ? toLocalDateString(value) : '';
  if (!day) return [];
  const [year, month, date] = day.split('-');
  return [day, `${date}/${month}/${year}`, `${Number(date)}/${Number(month)}/${year}`, `${date}/${month}`, `${Number(date)}/${Number(month)}`];
}

export function statementAccountSearchText(credit: CreditAccount): string {
  const amounts = [credit.totalAmount, credit.paidAmount, credit.pendingAmount].flatMap(value => {
    if (!Number.isFinite(value)) return [];
    const fixed = value.toFixed(2);
    return [fixed, fixed.replace('.', ','), value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })];
  });
  return normalize([
    creditAccountText(credit), ...(credit.saleIds || []), ...dateTerms(credit.createdAt), ...dateTerms(credit.dueDate),
    ...(credit.saleDetails || []).flatMap(sale => dateTerms(sale.date)), ...amounts,
    credit.currency === 'USD' ? 'USD dólares US$' : 'PEN soles S/',
  ].join(' '));
}

export function statementAccountMatches(searchText: string, query: string): boolean {
  return normalize(query).trim().split(/\s+/).filter(Boolean).every(term => searchText.includes(term));
}

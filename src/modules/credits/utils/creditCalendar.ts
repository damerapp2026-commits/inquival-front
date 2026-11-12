import type { CreditAccount } from '../../../shared/types';
import { addDaysToDate, getTodayDateString, toLocalDateString } from '../../../shared/utils/date.util';
import { creditCurrency } from './money';

export interface CreditDueEntry {
  credit: CreditAccount;
  dueDate: string;
}

export function creditDueDate(value?: string): string {
  if (!value) return '';
  const date = toLocalDateString(value);
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date ? date : '';
}

export function pendingCreditTotals(credits: readonly CreditAccount[]) {
  const totals = { PEN: 0, USD: 0 };
  for (const credit of credits) {
    totals[creditCurrency(credit.currency)] += Math.round(credit.pendingAmount * 100);
  }
  return { PEN: totals.PEN / 100, USD: totals.USD / 100 };
}

export function buildCreditCalendar(credits: readonly CreditAccount[], today = getTodayDateString()) {
  const byDate: Record<string, CreditDueEntry[]> = {};
  const undated: CreditDueEntry[] = [];
  const pending = credits.filter(credit =>
    (credit.status === 'PENDING' || credit.status === 'PARTIAL') && credit.pendingAmount > 0,
  );
  const dated: CreditDueEntry[] = [];
  for (const credit of pending) {
    const entry = { credit, dueDate: creditDueDate(credit.dueDate) };
    if (!entry.dueDate) {
      undated.push(entry);
      continue;
    }
    (byDate[entry.dueDate] ||= []).push(entry);
    dated.push(entry);
  }

  const summarize = (items: CreditAccount[]) => ({ count: items.length, totals: pendingCreditTotals(items) });
  const nextWeek = addDaysToDate(today, 7);
  return {
    byDate,
    undated,
    dated: dated.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    summary: {
      overdue: summarize(dated.filter(entry => entry.dueDate < today).map(entry => entry.credit)),
      today: summarize(dated.filter(entry => entry.dueDate === today).map(entry => entry.credit)),
      upcoming: summarize(dated.filter(entry => entry.dueDate > today && entry.dueDate <= nextWeek).map(entry => entry.credit)),
      pending: summarize(pending),
    },
  };
}

/** Monday-first month grid, using UTC solely for calendar arithmetic. */
export function creditCalendarDays(month: string): (string | null)[] {
  const firstDay = new Date(`${month}-01T00:00:00.000Z`);
  const nextMonth = new Date(firstDay);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const days: (string | null)[] = Array((firstDay.getUTCDay() + 6) % 7).fill(null);
  for (let day = `${month}-01`; day < nextMonth.toISOString().slice(0, 10); day = addDaysToDate(day, 1)) {
    days.push(day);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

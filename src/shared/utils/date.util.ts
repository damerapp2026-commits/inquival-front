const TIMEZONE = 'America/Lima';

/** Returns current date in Peru timezone as YYYY-MM-DD string */
export function getTodayDateString(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Converts an ISO date string to its Peru-local YYYY-MM-DD representation,
 * for use as the value of an `<input type="date">`.
 *
 * Treats midnight-UTC datetimes ("YYYY-MM-DDT00:00:00.000Z") as the logical
 * date they represent, without shifting back a day in Lima.
 */
export function toLocalDateString(input: string | Date): string {
  const dt = new Date(input);
  if (isNaN(dt.getTime())) return '';
  const raw = input instanceof Date ? input.toISOString() : input;
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(raw);
  if (dateOnly) return dateOnly[1];
  const midnightUtc = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?Z$/.exec(raw);
  if (midnightUtc) return midnightUtc[1];
  return getTodayDateString(dt);
}

/** Calendar arithmetic; independent of the browser's timezone and DST. */
export function addDaysToDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function addMonthsToDate(date: string, months: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return value.toISOString().slice(0, 10);
}

/** Whole calendar days until a due/expiry date, relative to today in Peru. */
export function daysUntilDate(input: string | Date, today = getTodayDateString()): number {
  const day = toLocalDateString(input);
  return (Date.parse(`${day}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86400000;
}

/** Returns start and end dates of current month in Peru timezone */
export function getMonthRange(): { start: string; end: string } {
  const start = `${getTodayDateString().slice(0, 7)}-01`;
  return {
    start,
    end: addDaysToDate(addMonthsToDate(start, 1), -1),
  };
}

/**
 * Formats a date string for es-PE display without timezone-induced day shifts.
 *
 * Handles three input shapes:
 *  - "YYYY-MM-DD" date-only → rendered as that exact calendar day.
 *  - "YYYY-MM-DDT00:00:00(.000)Z" midnight-UTC datetime → treated as a logical
 *    date-only value, so it is NOT shifted back a day in Lima.
 *  - Any other valid ISO datetime → formatted in America/Lima timezone.
 */
export function formatDateEs(
  input: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!input) return '';

  const dt = new Date(input);
  if (isNaN(dt.getTime())) return '';
  const raw = input instanceof Date ? input.toISOString() : input;
  if (/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.0+)?Z)?$/.test(raw)) {
    return dt.toLocaleDateString('es-PE', { ...opts, timeZone: 'UTC' });
  }
  return formatInstantEs(dt, opts);
}

/** Actual timestamps (createdAt, lastUpdated, etc.) always represent an instant. */
export function formatInstantEs(
  input: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!input) return '';
  const dt = new Date(input);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('es-PE', { ...opts, timeZone: TIMEZONE });
}

const TIMEZONE = 'America/Lima';

/** Returns current date in Peru timezone as YYYY-MM-DD string */
export function getTodayDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/** Returns start and end dates of current month in Peru timezone */
export function getMonthRange(): { start: string; end: string } {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toLocaleDateString('en-CA'),
    end: end.toLocaleDateString('en-CA'),
  };
}

/**
 * Formats a date string for es-PE display without timezone-induced day shifts.
 *
 * Handles three input shapes:
 *  - "YYYY-MM-DD" date-only → rendered as that exact day (local midnight).
 *  - "YYYY-MM-DDT00:00:00(.000)Z" midnight-UTC datetime → treated as a logical
 *    date-only value, so it is NOT shifted back a day in Lima.
 *  - Any other valid ISO datetime → formatted in America/Lima timezone.
 */
export function formatDateEs(
  input: string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!input) return '';

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return d.toLocaleDateString('es-PE', opts);
  }

  const midnightUtc = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.0+)?Z$/.exec(input);
  if (midnightUtc) {
    const d = new Date(Number(midnightUtc[1]), Number(midnightUtc[2]) - 1, Number(midnightUtc[3]));
    return d.toLocaleDateString('es-PE', opts);
  }

  const dt = new Date(input);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('es-PE', { ...opts, timeZone: TIMEZONE });
}

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

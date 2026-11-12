const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, filename);
const { buildCreditCalendar, creditCalendarDays, creditDueDate, pendingCreditTotals } = require('../src/modules/credits/utils/creditCalendar.ts');

function credit(id, overrides = {}) {
  return {
    id, clientId: 'client', name: id, saleIds: [], totalAmount: 100,
    paidAmount: 0, pendingAmount: 100, status: 'PENDING', payments: [],
    createdAt: '2026-01-01T00:00:00Z', currency: 'PEN', ...overrides,
  };
}

test('places outstanding balances on their due dates, independently of sale and payment dates', () => {
  const credits = [
    credit('overdue', { dueDate: '2026-11-11', status: 'PARTIAL', paidAmount: 40, pendingAmount: 60, payments: [{ paymentDate: '2026-11-10', amount: 40 }] }),
    credit('today', { dueDate: '2026-11-12T00:00:00.000Z' }),
    credit('week', { dueDate: '2026-11-19T05:00:00.000Z', currency: 'USD', pendingAmount: 30 }),
    credit('later', { dueDate: '2026-11-20' }),
    credit('undated'),
    credit('invalid', { dueDate: 'not-a-date' }),
    credit('paid', { dueDate: '2026-11-12', status: 'PAID', pendingAmount: 100 }),
    credit('settled', { dueDate: '2026-11-12', status: 'PARTIAL', pendingAmount: 0 }),
    credit('negative', { dueDate: '2026-11-12', pendingAmount: -1 }),
  ];
  const original = structuredClone(credits);
  const result = buildCreditCalendar(credits, '2026-11-12');
  assert.deepEqual(result.dated.map(entry => entry.credit.id), ['overdue', 'today', 'week', 'later']);
  assert.deepEqual(result.byDate['2026-11-12'].map(entry => entry.credit.id), ['today']);
  assert.equal(result.byDate['2026-01-01'], undefined);
  assert.equal(result.byDate['2026-11-10'], undefined);
  assert.deepEqual(result.undated.map(entry => entry.credit.id), ['undated', 'invalid']);
  assert.deepEqual(result.summary.overdue, { count: 1, totals: { PEN: 60, USD: 0 } });
  assert.deepEqual(result.summary.today, { count: 1, totals: { PEN: 100, USD: 0 } });
  assert.deepEqual(result.summary.upcoming, { count: 1, totals: { PEN: 0, USD: 30 } });
  assert.deepEqual(result.summary.pending, { count: 6, totals: { PEN: 460, USD: 30 } });
  assert.deepEqual(credits, original);
});

test('keeps currencies separate and rounds money in cents', () => {
  assert.deepEqual(pendingCreditTotals([
    credit('one', { currency: undefined, pendingAmount: 0.1 }),
    credit('two', { pendingAmount: 0.2 }),
    credit('usd', { currency: 'USD', pendingAmount: 25.45 }),
  ]), { PEN: 0.3, USD: 25.45 });
  assert.deepEqual(buildCreditCalendar([], '2026-11-12').summary.pending, { count: 0, totals: { PEN: 0, USD: 0 } });
});

for (const timezone of ['America/Lima', 'UTC', 'Asia/Tokyo', 'America/New_York']) {
  test(`due dates and monthly grids do not shift in ${timezone}`, t => {
    const previous = process.env.TZ;
    process.env.TZ = timezone;
    t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; });
    for (const [input, expected] of [
      ['2026-11-12', '2026-11-12'],
      ['2026-11-12T00:00:00.000Z', '2026-11-12'],
      ['2026-11-12T05:00:00.000Z', '2026-11-12'],
      ['2026-11-13T04:59:59.999Z', '2026-11-12'],
      ['2026-11-12T00:00:00-05:00', '2026-11-12'],
      ['2028-02-29', '2028-02-29'],
      ['2026-02-31', ''],
      ['invalid', ''],
      [undefined, ''],
    ]) assert.equal(creditDueDate(input), expected);
    const november = creditCalendarDays('2026-11');
    assert.deepEqual(november.slice(0, 6), Array(6).fill(null));
    assert.equal(november[6], '2026-11-01');
    assert.equal(november.filter(Boolean).length, 30);
    assert.equal(november.length % 7, 0);
    assert.equal(creditCalendarDays('2028-02').filter(Boolean).at(-1), '2028-02-29');
    assert.equal(creditCalendarDays('2026-12').filter(Boolean).at(-1), '2026-12-31');
    const result = buildCreditCalendar([
      credit('month-end', { dueDate: '2026-12-31T00:00:00Z' }),
      credit('next-year', { dueDate: '2027-01-01T05:00:00Z' }),
    ], '2026-12-31');
    assert.equal(result.summary.today.count, 1);
    assert.equal(result.summary.upcoming.count, 1);
  });
}

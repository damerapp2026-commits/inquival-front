const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

// Load the real helpers without introducing a test runtime dependency.
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, filename);
const dates = require('../src/shared/utils/date.util.ts');
const { purchaseToFormState } = require('../src/modules/purchases/utils/purchaseForm.ts');
const numeric = { day: '2-digit', month: '2-digit', year: 'numeric' };

for (const timezone of ['America/Lima', 'UTC', 'Asia/Tokyo', 'America/New_York']) {
  test(`calendar dates and real timestamps in a ${timezone} browser`, t => {
    const previous = process.env.TZ;
    process.env.TZ = timezone;
    t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; });
    for (const [input, expected] of [
      ['2026-04-28', '28/04/2026'],
      ['2026-04-28T00:00:00.000Z', '28/04/2026'],
      ['2026-03-13T00:00:00Z', '13/03/2026'],
      ['2026-10-31T05:00:00.000Z', '31/10/2026'],
      ['2026-11-01T04:59:59.999Z', '31/10/2026'],
      ['2026-11-01T05:00:00.000Z', '01/11/2026'],
      ['2028-02-29T00:00:00.000Z', '29/02/2028'],
    ]) assert.equal(dates.formatDateEs(input, numeric), expected, input);
    assert.equal(dates.formatDateEs('invalid'), '');
    assert.equal(dates.toLocalDateString('invalid'), '');
    // Real timestamps at midnight UTC are 19:00 of the previous Peru day.
    assert.equal(dates.formatInstantEs('2026-11-01T00:00:00.000Z', numeric), '31/10/2026');
    assert.equal(dates.getTodayDateString(new Date('2027-01-01T04:59:59.999Z')), '2026-12-31');
    assert.equal(dates.getTodayDateString(new Date('2027-01-01T05:00:00.000Z')), '2027-01-01');
    assert.equal(dates.addDaysToDate('2028-02-28', 1), '2028-02-29');
    assert.equal(dates.addDaysToDate('2026-12-31', 1), '2027-01-01');
    assert.equal(dates.addMonthsToDate('2026-05-31', -3), '2026-02-28');
    assert.equal(dates.addDaysToDate('2026-03-07', 2), '2026-03-09');
    assert.equal(dates.daysUntilDate('2026-11-01T00:00:00.000Z', '2026-10-31'), 1);
    assert.equal(dates.daysUntilDate('2026-10-31T00:00:00.000Z', '2026-10-31'), 0);
    assert.equal(dates.daysUntilDate('2026-10-31T05:00:00.000Z', '2026-11-01'), -1);
  });
}

test('editing a late-night purchase preserves emission, receipt, due and expiry days', () => {
  const result = purchaseToFormState({
    id: 'purchase', companyId: 'company', supplier: 'Test', paymentType: 'CREDITO',
    totalCost: 10, date: '2026-11-01T04:59:59.999Z', issueDate: '2026-10-31T00:00:00.000Z',
    dueDate: '2026-11-30T00:00:00.000Z', grDate: '2026-11-01T04:59:59.999Z',
    items: [{ productId: 'product', quantity: 1, unitCost: 10, expirationDate: '2028-02-29T00:00:00.000Z' }],
  }, []);
  assert.equal(result.state.issueDate, '2026-10-31');
  assert.equal(result.state.purchaseDate, '2026-10-31');
  assert.equal(result.state.grDate, '2026-10-31');
  assert.equal(result.state.dueDate, '2026-11-30');
  assert.equal(result.state.items[0].expirationDate, '2028-02-29');
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, filename);
const { filterStatementCredits, isInStatementPeriod, selectClientStatementData, selectedStatementPeriod, statementPeriodError, statementPeriodSelection } = require('../src/modules/credits/utils/clientStatementPeriod.ts');
const { collectStatementPages } = require('../src/modules/credits/utils/statementPagination.ts');
const { buildClientStatementDocument } = require('../src/modules/credits/utils/clientStatementPdf.ts');
const fixture = require('./fixtures/client-statement.cjs');
const text = node => !node || typeof node !== 'object' ? [] : [...(typeof node.text === 'string' ? [node.text] : []), ...Object.values(node).flatMap(text)];

test('period chooses account creation dates and retains every payment and the current balance', () => {
  const period = { from: '2026-10-01', to: '2026-10-31' };
  const selected = filterStatementCredits(fixture.credits, period);
  assert.deepEqual(selected.map(credit => credit.id), ['grouped', 'historical']);
  assert.deepEqual(selected[0].payments.map(payment => payment.paymentDate), ['2026-11-09T00:00:00.000Z', '2026-11-03T00:00:00.000Z']);
  assert.equal(selected[0].pendingAmount, 700);
  const document = buildClientStatementDocument({ ...fixture, period });
  const content = text(document).join('\n');
  assert.match(content, /PERIODO SELECCIONADO/);
  assert.match(content, /01\/10\/2026 al 31\/10\/2026/);
  assert.match(content, /actualizados a la fecha de emisión/);
  assert.match(content, /Segundo abono/);
  assert.match(content, /S\/ 700.00/);
  assert.doesNotMatch(content, /Compra en dólares|NV-000143|Nutriente soluble importado/);
});

test('manual account selection includes only its linked sales and balances', () => {
  const before = JSON.stringify(fixture);
  const selected = selectClientStatementData(fixture.credits, fixture.sales, undefined, ['usd']);
  assert.deepEqual(selected.credits.map(credit => credit.id), ['usd']);
  assert.deepEqual(selected.sales.map(sale => sale.id), ['NV-000143']);
  const content = text(buildClientStatementDocument({ ...fixture, creditIds: ['usd'] })).join('\n');
  assert.match(content, /Compra en dólares/);
  assert.match(content, /US\$ 200.00/);
  assert.doesNotMatch(content, /Campaña de noviembre|Saldo anterior cancelado|NV-000127|Bioestimulante/);
  assert.equal(JSON.stringify(fixture), before);
});

test('empty, unknown or out-of-period selections never fall back to the complete record', () => {
  for (const options of [
    { creditIds: [] },
    { creditIds: ['not-a-client-account'] },
    { creditIds: ['usd'], period: { from: '2026-10-01', to: '2026-10-31' } },
  ]) {
    const selected = selectClientStatementData(fixture.credits, fixture.sales, options.period, options.creditIds);
    assert.deepEqual(selected, { credits: [], sales: [] });
    const content = text(buildClientStatementDocument({ ...fixture, ...options })).join('\n');
    assert.match(content, /No hay operaciones para mostrar/);
    assert.doesNotMatch(content, /Campaña de noviembre|Compra en dólares|NV-000127/);
  }
});

test('full-history mode keeps the original record and separates currencies', () => {
  const selected = selectClientStatementData(fixture.credits, fixture.sales);
  assert.deepEqual(selected.credits, fixture.credits);
  assert.deepEqual(selected.sales, fixture.sales);
  const content = text(buildClientStatementDocument(fixture)).join('\n');
  assert.match(content, /SOLES · PEN/);
  assert.match(content, /DÓLARES · USD/);
  assert.match(content, /Saldo anterior cancelado/);
});

test('range validation handles incomplete and reversed dates, including empty records', () => {
  for (const period of [{ from: '', to: '2026-11-01' }, { from: '2026-11-02', to: '2026-11-01' }, { from: '2026-02-31', to: '2026-03-01' }]) {
    assert.ok(statementPeriodError(period));
    assert.throws(() => filterStatementCredits([], period));
  }
  assert.equal(statementPeriodError(undefined), undefined);
  assert.equal(statementPeriodError({ from: '2026-11-01', to: '2026-11-01' }), undefined);
  assert.equal(selectedStatementPeriod(statementPeriodSelection('all')), undefined);
});

for (const timezone of ['America/Lima', 'UTC', 'Asia/Tokyo']) {
  test(`inclusive dates and month presets use Peru days in ${timezone}`, t => {
    const previous = process.env.TZ;
    process.env.TZ = timezone;
    t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; });
    const period = { from: '2026-11-01', to: '2026-11-30' };
    assert.equal(isInStatementPeriod('2026-11-01T00:00:00.000Z', period), true);
    assert.equal(isInStatementPeriod('2026-11-01T04:59:59.999Z', period), false);
    assert.equal(isInStatementPeriod('2026-11-01T05:00:00.000Z', period), true);
    assert.equal(isInStatementPeriod('2026-12-01T04:59:59.999Z', period), true);
    assert.equal(isInStatementPeriod('2026-12-01T05:00:00.000Z', period), false);
    assert.equal(isInStatementPeriod(undefined, period), false);
    assert.deepEqual(statementPeriodSelection('previousMonth', '2027-01-10'), { preset: 'previousMonth', from: '2026-12-01', to: '2026-12-31' });
    assert.deepEqual(statementPeriodSelection('previousMonth', '2028-03-10'), { preset: 'previousMonth', from: '2028-02-01', to: '2028-02-29' });
  });
}

test('exports load later pages, including older accounts past the initial 200 records', async () => {
  const data = Array.from({ length: 405 }, (_, index) => ({ id: `account-${index}` }));
  const reads = [];
  const result = await collectStatementPages(async (page, limit) => {
    reads.push(page);
    return { data: data.slice((page - 1) * limit, page * limit), total: data.length };
  });
  assert.deepEqual(reads, [1, 2, 3]);
  assert.deepEqual(result, data);
  assert.deepEqual(await collectStatementPages(async () => data.slice(0, 1)), data.slice(0, 1));
});

test('pagination errors are reported instead of silently exporting a partial account', async () => {
  await assert.rejects(() => collectStatementPages(async () => ({ data: [{ id: 'same' }], total: 2 })), /completar el historial/);
  await assert.rejects(() => collectStatementPages(async () => ({ data: [], total: 1 })), /completar el historial/);
  await assert.rejects(() => collectStatementPages(async () => ({ data: null, total: 1 })), /leer el historial/);
});

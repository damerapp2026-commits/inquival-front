const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { statementAccountSearchText, statementAccountMatches } = require('../src/modules/credits/utils/statementAccountSearch.ts');
const account = {
  id: 'account', clientId: 'client', name: 'Campaña agrícola', saleIds: ['sale'],
  saleDetails: [{ saleId: 'sale', saleNumber: 'NI01-00003439', date: '2024-06-20T05:00:00Z', items: [], total: 1228 }],
  createdAt: '2024-06-20T05:00:00Z', dueDate: '2024-07-20', totalAmount: 1228,
  paidAmount: 200, pendingAmount: 1028, currency: 'PEN', status: 'PARTIAL', payments: [],
};
test('identifies an account without knowing its name using its note, dates, total or balance', () => {
  const before = structuredClone(account), text = statementAccountSearchText(account);
  for (const query of ['NI01-00003439', 'ni01 3439', '20/06/2024', '20/6/2024', '2024-06-20', '20/06', '1228', '1,228.00', '1.228,00', '1228,00', '1028', '200.00', 'PEN 20/6/2024 1228', 'campana agricola', '20/7/2024']) {
    assert.equal(statementAccountMatches(text, query), true, query);
  }
  for (const query of ['NI01-00003438', '21/06/2024', '1229', 'USD', 'ni01 9999']) assert.equal(statementAccountMatches(text, query), false, query);
  assert.deepEqual(account, before);
});
test('supports anonymous and historical accounts, dollars, empty search and invalid legacy dates', () => {
  const anonymous = { ...account, name: undefined, currency: 'USD', createdAt: 'invalid', dueDate: undefined, saleIds: [], saleDetails: undefined };
  const text = statementAccountSearchText(anonymous);
  for (const query of ['', '   ', 'DOLARES 1,228.00', 'USD 1028']) assert.equal(statementAccountMatches(text, query), true, query);
  assert.equal(statementAccountMatches(text, '20/06/2024'), false);
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { DEFAULT_BRANCH_ID, setActiveBranchId } = require('../src/shared/utils/branchStorage.ts');
const { readPurchaseCreateDraft, writePurchaseCreateDraft, clearPurchaseCreateDraft, emptyItem } = require('../src/modules/purchases/utils/purchaseForm.ts');
const { COMPANY_INFO, setCompanyInfo } = require('../src/config/companyInfo.ts');

test('branch changes isolate unfinished purchases and bank details', async t => {
  const previousWindow = global.window;
  const storage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  };
  global.window = { sessionStorage: storage(), localStorage: storage() };
  t.after(() => { global.window = previousWindow; });
  const beta = '000000000000000000000002';
  const blank = { state: { supplier: '', items: [emptyItem()], installments: [] }, currency: 'PEN', exchangeRate: null, exchangeRateDate: '', originalTotal: 0 };

  await t.test('an existing Principal draft is unavailable in a new branch', () => {
    setActiveBranchId(DEFAULT_BRANCH_ID);
    writePurchaseCreateDraft({ ...blank, state: { ...blank.state, supplier: 'Proveedor Principal' } });
    assert.equal(readPurchaseCreateDraft(blank).state.supplier, 'Proveedor Principal');
    setActiveBranchId(beta);
    assert.equal(readPurchaseCreateDraft(blank), null);
  });
  await t.test('saving and clearing Beta leaves the Principal draft intact', () => {
    writePurchaseCreateDraft({ ...blank, state: { ...blank.state, supplier: 'Proveedor Beta' } });
    assert.equal(readPurchaseCreateDraft(blank).state.supplier, 'Proveedor Beta');
    setActiveBranchId(DEFAULT_BRANCH_ID);
    assert.equal(readPurchaseCreateDraft(blank).state.supplier, 'Proveedor Principal');
    setActiveBranchId(beta);
    clearPurchaseCreateDraft();
    assert.equal(readPurchaseCreateDraft(blank), null);
    setActiveBranchId(DEFAULT_BRANCH_ID);
    assert.equal(readPurchaseCreateDraft(blank).state.supplier, 'Proveedor Principal');
  });
  await t.test('a branch without bank settings never inherits another branch’s collection details', () => {
    setCompanyInfo({ legalName: 'Principal', bankAccounts: [{ bank: 'Banco Principal', currency: 'PEN', accountNumber: '123', holder: 'Principal' }] });
    setActiveBranchId(beta);
    setCompanyInfo({ legalName: 'Beta', bankAccounts: [] });
    assert.deepEqual(COMPANY_INFO.bankAccounts, []);
    assert.equal(COMPANY_INFO.detraccionAccount, undefined);
    assert.equal(COMPANY_INFO.salesEmail, '');
    assert.equal(COMPANY_INFO.legalName, 'Beta');
  });
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  module._compile(compiled.outputText, filename);
};
const { purchasePayableTotal, splitPurchaseInstallments, purchaseInitialPaymentAmount, buildInitialCreate } = require('../src/modules/purchases/utils/purchaseForm.ts');

test('720 with 1.5% generates two letters of 354.60; without detracción, two of 360', () => {
  assert.equal(purchasePayableTotal(720, true), 709.2);
  assert.deepEqual(splitPurchaseInstallments(purchasePayableTotal(720, true), 2), [354.6, 354.6]);
  assert.deepEqual(splitPurchaseInstallments(purchasePayableTotal(720, false), 2), [360, 360]);
});
test('uneven divisions conserve every cent of the net total', () => {
  for (const total of [1, 100.01, 720, 863.76, 1416.05]) {
    for (const count of [1, 2, 3, 6, 7, 36]) {
      const net = purchasePayableTotal(total, true), amounts = splitPurchaseInstallments(net, count);
      assert.equal(amounts.length, count);
      assert.equal(amounts.reduce((s, value) => s + Math.round(value * 100), 0), Math.round(net * 100));
      assert.ok(amounts.every(value => value >= 0.01));
      assert.ok(Math.round(Math.max(...amounts) * 100) - Math.round(Math.min(...amounts) * 100) <= 1);
    }
  }
});
test('half-cent detracción is rounded before subtracting; invalid letter counts cannot produce negative letters', () => {
  assert.equal(purchasePayableTotal(1, true), 0.98);
  assert.deepEqual(splitPurchaseInstallments(0.02, 3), []);
  assert.deepEqual(splitPurchaseInstallments(100, 0), []);
  assert.deepEqual(splitPurchaseInstallments(100, 1.5), []);
});

test('initial payments leave only the remaining debt for the letters, in either invoice currency', () => {
  for (const currency of ['PEN', 'USD']) {
    const paid = purchaseInitialPaymentAmount(600, currency, currency, currency === 'USD' ? 3.75 : null);
    assert.equal(paid, 600);
    assert.deepEqual(splitPurchaseInstallments(1000 - paid, 2), [200, 200]);
  }
  const paid = purchaseInitialPaymentAmount(600, 'PEN', 'PEN', null);
  assert.deepEqual(splitPurchaseInstallments(purchasePayableTotal(1000, true) - paid, 2), [192.5, 192.5]);
});

test('cross-currency advances convert into invoice currency and round to cents', () => {
  assert.equal(purchaseInitialPaymentAmount(2250, 'PEN', 'USD', 3.75), 600);
  assert.equal(purchaseInitialPaymentAmount(160, 'USD', 'PEN', 3.75), 600);
  assert.equal(purchaseInitialPaymentAmount(600, 'PEN', 'USD', 3.75), 160);
  assert.equal(purchaseInitialPaymentAmount(600, 'PEN', 'USD', 3.447), 174.06);
  for (const rate of [null, 0, -1, Infinity, NaN]) {
    assert.equal(purchaseInitialPaymentAmount(600, 'PEN', 'USD', rate), null);
    assert.equal(purchaseInitialPaymentAmount(600, 'USD', 'USD', rate), null);
  }
  assert.equal(purchaseInitialPaymentAmount(-1, 'PEN', 'PEN', null), null);
  assert.equal(buildInitialCreate('2026-11-13').state.initialPayment.enabled, false);
});

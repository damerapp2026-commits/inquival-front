const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { productReferenceCost, emptyItem, recalcItem } = require('../src/modules/purchases/utils/purchaseForm.ts');

test('purchase defaults use the current reference cost in its original currency', () => {
  assert.equal(productReferenceCost({ lastCostPrice: 4.95, lastCostCurrency: 'USD' }, 'USD', null), 4.95);
  assert.equal(productReferenceCost({ lastCostPrice: 41.1234, lastCostCurrency: 'PEN' }, 'PEN', null), 41.1234);
});

test('reference costs convert into the purchase currency without confusing cost and sale price', () => {
  const product = { lastCostPrice: 4.95, lastCostCurrency: 'USD', lastSalePrice: 40 };
  const cost = productReferenceCost(product, 'PEN', 3.6);
  assert.equal(cost, 17.82);
  const item = recalcItem({ ...emptyItem(), unitPriceSinIgv: cost, precioVenta: 40, precioVentaMode: 'direct' });
  assert.equal(item.unitPriceConIgv, 17.82 * 1.18);
  assert.equal(item.precioVenta, 40);
  assert.equal(productReferenceCost({ lastCostPrice: 50, lastCostCurrency: 'PEN' }, 'USD', 3.6), 13.8889);
});

test('missing conversion rates and invalid costs leave the purchase price unset', () => {
  for (const rate of [null, 0, -1, Infinity]) {
    assert.equal(productReferenceCost({ lastCostPrice: 4.95, lastCostCurrency: 'USD' }, 'PEN', rate), undefined);
  }
  for (const product of [undefined, {}, { lastCostPrice: -1 }, { lastCostPrice: NaN, lastCostCurrency: 'USD' }]) {
    assert.equal(productReferenceCost(product, 'USD', 3.6), undefined);
  }
  assert.equal(productReferenceCost({ lastCostPrice: 0, lastCostCurrency: 'USD' }, 'USD', null), 0);
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, filename);
const { calculatePurchaseOrderAmounts, purchaseOrderAmounts, purchaseOrderCurrency } = require('../src/modules/purchases/utils/purchaseOrderAmounts.ts');
const { serializePurchaseOrderDetails, getPurchaseOrderDetails, EMPTY_PURCHASE_ORDER_DETAILS, addDaysToDate } = require('../src/modules/purchases/utils/purchaseOrderDetails.ts');
const { buildPurchaseOrderPdfDefinition } = require('../src/modules/purchases/utils/purchaseOrderPdf.ts');
const { recalcItem, emptyItem } = require('../src/modules/purchases/utils/purchaseForm.ts');
const fixture = require('./fixtures/purchase-order.cjs');

function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(nodes)];
}

test('reference order shows included IGV without adding tax to its 1240-dollar total', () => {
  const result = purchaseOrderAmounts(fixture.order, fixture.products);
  assert.equal(result.currency, 'USD');
  assert.equal(result.total, 1240);
  assert.equal(result.subtotal, 1050.85);
  assert.equal(result.igv, 189.15);
  assert.deepEqual(result.lines.map(line => line.total), [640, 600]);
  assert.equal(Math.round(result.subtotal * 100) + Math.round(result.igv * 100), Math.round(result.total * 100));
  assert.equal(result.lines.reduce((sum, line) => sum + Math.round(line.igv * 100), 0), Math.round(result.igv * 100));
});

test('mixed taxable and exempt lines keep their tax treatment and conserve cents', () => {
  const products = [{ id: 'taxable', taxType: 'GRAVADO' }, { id: 'exempt', taxType: 'EXONERADO' }, { id: 'unaffected', taxType: 'INAFECTO' }];
  const result = calculatePurchaseOrderAmounts([
    { productId: 'taxable', quantity: 1, unitPriceConIgv: 118 },
    { productId: 'exempt', quantity: 2, unitPriceConIgv: 25 },
    { productId: 'unaffected', quantity: 1, unitCost: 10 },
    { productId: 'taxable', quantity: 1, unitPriceConIgv: 0.1, taxType: 'EXONERADO' },
  ], products);
  assert.equal(result.total, 178.1);
  assert.equal(result.subtotal, 160.1);
  assert.equal(result.igv, 18);
  assert.deepEqual(result.lines.map(line => line.igv), [18, 0, 0, 0]);
  assert.equal(calculatePurchaseOrderAmounts([{ productId: 'taxable', quantity: 1, unitPriceSinIgv: 100 }], products).total, 118);
  assert.equal(purchaseOrderCurrency({ currency: 'USD', totalCostUsd: 0 }), 'USD');
  assert.equal(purchaseOrderCurrency({ currency: 'PEN', totalCostUsd: 100 }), 'PEN');
  assert.equal(purchaseOrderAmounts({ ...fixture.order, totalCostUsd: 1300 }, fixture.products).total, 1300);
});

test('net unit prices retain enough precision to preserve the order amount when converting to a purchase', () => {
  const amounts = calculatePurchaseOrderAmounts(fixture.order.items, fixture.products);
  const convertedTotals = amounts.lines.map((line, index) => {
    const converted = recalcItem({ ...emptyItem(), unitPriceSinIgv: line.unitPriceSinIgv }, 'USD', 3.8, line.taxable);
    return Math.round(converted.unitPriceConIgv * fixture.order.items[index].quantity * 100) / 100;
  });
  assert.deepEqual(convertedTotals, [640, 600]);
});

test('contact, transport address, payment terms and signatures survive saving and reloading', () => {
  const details = { ...EMPTY_PURCHASE_ORDER_DETAILS, ...fixture.details, transport: 'Agencia de transporte', transportAddress: 'Av. Prueba 123', approvedBy: 'Jefe de compras', observations: 'Entregar por la mañana.' };
  const notes = serializePurchaseOrderDetails(details);
  assert.deepEqual(getPurchaseOrderDetails({ ...fixture.order, notes }), details);
  const recovered = getPurchaseOrderDetails({ ...fixture.order, notes, supplierContact: 'Contacto actualizado' });
  assert.equal(recovered.supplierContact, 'Contacto actualizado');
  assert.equal(recovered.transportAddress, details.transportAddress);
  for (const metadata of ['null', '[]', 'invalid']) {
    const legacy = getPurchaseOrderDetails({ ...fixture.order, notes: `[OC_META]${metadata}[/OC_META]\nNota anterior` });
    assert.equal(legacy.observations, 'Nota anterior');
    assert.equal(legacy.transportAddress, '');
  }
});

for (const timezone of ['America/Lima', 'Asia/Tokyo', 'America/New_York']) {
  test(`credit terms preserve calendar dates in ${timezone}`, t => {
    const previous = process.env.TZ;
    process.env.TZ = timezone;
    t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; });
    assert.equal(addDaysToDate('2026-11-12', 45), '2026-12-27');
    assert.equal(addDaysToDate('2026-12-31', 30), '2027-01-30');
    assert.equal(addDaysToDate('2028-02-28', 1), '2028-02-29');
    assert.equal(addDaysToDate('invalid', 30), '');
    assert.equal(addDaysToDate('2026-11-12', NaN), '');
  });
}

test('PDF follows the sketch: fiscal header, arrival address, tax column, amount in words and delivery terms', () => {
  const document = buildPurchaseOrderPdfDefinition(fixture);
  const all = nodes(document);
  const text = all.filter(node => typeof node.text === 'string').map(node => node.text).join('\n');
  assert.match(text, /EMPRESA RECEPTORA/);
  assert.match(text, /RUC: 20614419631/);
  assert.match(text, /Fecha de pedido/);
  assert.match(text, /PUNTO DE LLEGADA/);
  assert.match(text, /IGV\nINCLUIDO/);
  assert.match(text, /Son: mil doscientos cuarenta con 00\/100 dólares americanos/);
  assert.match(text, /45 días/);
  assert.match(text, /27\/12\/2026/);
  assert.match(text, /Carlos Cabrera/);
  assert.match(text, /fecha de vencimiento menor.*será devuelta/);
  assert.doesNotMatch(text, /Almacén 2|ALMACÉN|Fecha de emisión|OC_META/);
  const itemTable = all.find(node => node.table?.headerRows === 1);
  assert.equal(itemTable.table.widths.length, 7);
  assert.ok(itemTable.table.body.every(row => row.length === 7));
  const legacy = buildPurchaseOrderPdfDefinition({ ...fixture, order: { ...fixture.order, deliveryPlace: 'Almacén 2' } });
  assert.doesNotMatch(nodes(legacy).map(node => node.text || '').join('\n'), /Almacén 2/);
});

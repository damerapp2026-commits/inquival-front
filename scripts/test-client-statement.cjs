const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, filename);
const { buildClientStatementDocument } = require('../src/modules/credits/utils/clientStatementPdf.ts');
const fixture = require('./fixtures/client-statement.cjs');

function texts(node) {
  if (!node || typeof node !== 'object') return [];
  return [...(typeof node.text === 'string' ? [node.text] : []), ...Object.values(node).flatMap(texts)];
}
function rows(node) {
  if (!node || typeof node !== 'object') return [];
  return [...(node.table?.body || []), ...Object.values(node).flatMap(rows)];
}

test('three separate export formats contain their own sections and preserve account selection', () => {
  const modes = { summary: 'Resumen de cuenta', sales: 'Detalle de ventas', payments: 'Detalle de abonos' };
  const before = structuredClone(fixture);
  for (const [mode, expected] of Object.entries(modes)) {
    const doc = buildClientStatementDocument({ ...fixture, mode, creditIds: ['grouped'] });
    const content = texts(doc);
    assert.deepEqual(doc.content.filter(node => node.headlineLevel === 1).map(node => texts(node)[1]), [expected]);
    assert.ok(!content.some(text => text.includes('Compra en dólares')));
    assert.ok(!content.some(text => text.includes('Saldo anterior cancelado')));
    assert.equal(content.some(text => text.includes('Primer abono · recibido en tienda')), mode === 'payments');
    assert.equal(content.includes('Abono granulado · saco de 50 kg'), mode === 'sales');
    assert.equal(content.includes('Cuenta / Vencimiento'), mode === 'summary');
    assert.equal(content.includes('SALDO POR PAGAR'), mode === 'summary');
    if (mode === 'sales') assert.ok(!content.some(text => text.includes('Los abonos posteriores están')));
    if (mode === 'payments') {
      assert.equal(content.filter(text => text.includes('Primer abono · recibido en tienda')).length, 1);
      assert.ok(!content.includes('Producto / Presentación'));
      assert.ok(content.includes('S/ 500.00'));
      assert.ok(content.includes('S/ 600.00'));
    }
  }
  assert.deepEqual(fixture, before);
});

test('detailed PDF has one account summary, then sales, then payments without repeated balances', () => {
  const doc = buildClientStatementDocument(fixture);
  const headings = doc.content.filter(node => node.headlineLevel === 1);
  assert.deepEqual(headings.map(node => texts(node)[1]), ['Resumen de cuenta', 'Detalle de ventas', 'Resumen de abonos']);
  assert.deepEqual(headings.map(node => texts(node)[0]), ['01', '02', '03']);
  const salesIndex = doc.content.indexOf(headings[1]);
  const paymentsIndex = doc.content.indexOf(headings[2]);
  const firstSection = texts(doc.content.slice(0, salesIndex));
  const salesSection = texts(doc.content.slice(salesIndex, paymentsIndex));
  const paymentsSection = texts(doc.content.slice(paymentsIndex));
  assert.ok(firstSection.includes('Cuenta / Vencimiento'));
  assert.ok(firstSection.includes('S/ 700.00'));
  assert.ok(salesSection.includes('Abono granulado · saco de 50 kg'));
  assert.ok(salesSection.includes('Inicial: US$ 100.00'));
  assert.ok(!salesSection.some(text => text.includes('Primer abono · recibido en tienda')));
  assert.ok(paymentsSection.includes('Primer abono · recibido en tienda'));
  assert.ok(paymentsSection.includes('Segundo abono · operación de ejemplo 002'));
  for (const repeated of ['Monto al crédito', 'Abonos aplicados', 'Saldo por pagar', 'Cuenta / Vencimiento', 'Producto / Presentación']) {
    assert.ok(!paymentsSection.includes(repeated), repeated);
  }
  const summary = buildClientStatementDocument({ ...fixture, mode: 'summary', sales: undefined });
  assert.deepEqual(summary.content.filter(node => node.headlineLevel === 1).map(node => texts(node)[1]), ['Resumen de cuenta']);
  for (const value of ['S/ 700.00', 'US$ 200.00', 'Cuenta / Vencimiento']) assert.ok(texts(summary).includes(value));
});

test('stored sale products stay in the sales section for credit-only exports', () => {
  const credit = { ...fixture.credits[0], saleDetails: [{ saleId: 'NV-000127', saleNumber: 'NV-000127', date: '2026-10-28', total: 1500, items: fixture.sales[0].items }] };
  const doc = buildClientStatementDocument({ ...fixture, credits: [credit], sales: undefined });
  const paymentStart = doc.content.findIndex(node => node.headlineLevel === 1 && texts(node).includes('Resumen de abonos'));
  const product = '3 × Abono granulado · saco de 50 kg · 1 × Fertilizante foliar · caja de 12 unidades';
  assert.ok(texts(doc.content.slice(0, paymentStart)).includes(product));
  assert.ok(!texts(doc.content.slice(paymentStart)).includes(product));
  assert.equal(texts(doc).filter(text => text.includes('Primer abono · recibido en tienda')).length, 1);
});

test('credit-only PDFs tolerate legacy sale IDs and sales without identifiers', () => {
  const credit = { ...fixture.credits[0], saleIds: [], saleDetails: [
    { id: '000000000000000000000123', date: '2026-10-28', items: [{ quantity: 1, productName: 'Producto de venta antigua' }] },
    { date: '2026-10-29', items: [{ quantity: 2, productName: 'Producto sin referencia' }] },
  ] };
  const content = texts(buildClientStatementDocument({ ...fixture, credits: [credit], sales: undefined })).join('\n');
  for (const value of ['Venta sin número (00000123)', 'Venta sin número', 'Producto de venta antigua', 'Producto sin referencia']) assert.ok(content.includes(value), value);
  assert.ok(!content.includes('NV-000123'));
});

test('balances keep PEN and USD separate and include historical accounts', () => {
  const doc = buildClientStatementDocument(fixture);
  const pen = doc.content.find(node => texts(node).includes('SOLES · PEN'));
  const usd = doc.content.find(node => texts(node).includes('DÓLARES · USD'));
  assert.ok(pen);
  assert.ok(usd);
  for (const expected of ['S/ 2,800.00', 'S/ 2,100.00', 'S/ 700.00']) assert.ok(texts(pen).includes(expected));
  for (const expected of ['US$ 300.00', 'US$ 100.00', 'US$ 200.00']) assert.ok(texts(usd).includes(expected));
  assert.ok(texts(pen).some(text => text.includes('S/ 700.00 vencidos')));
  assert.ok(texts(doc).some(text => text.includes('Saldo anterior cancelado')));
  assert.ok(texts(doc).some(text => text.includes('S/ 1,000.00 sin detalle individual registrado')));
});

test('a credit shared by two sales shows each payment only once and in calendar order', () => {
  const before = JSON.stringify(fixture);
  const doc = buildClientStatementDocument(fixture);
  const payments = rows(doc).filter(row => ['Transferencia', 'Efectivo'].includes(row[1]?.text));
  assert.equal(payments.length, 3);
  assert.deepEqual(payments.slice(0, 2).map(row => row[0].text), ['03/11/2026', '09/11/2026']);
  assert.equal(texts(doc).filter(text => text.includes('Primer abono · recibido en tienda')).length, 1);
  assert.equal(texts(doc).filter(text => text.includes('Segundo abono · operación de ejemplo 002')).length, 1);
  assert.equal(JSON.stringify(fixture), before, 'building a PDF must not reorder cached sales or payments');
});

test('USD purchases, down payments and payments received in PEN retain their currency', () => {
  const text = texts(buildClientStatementDocument(fixture)).join('\n');
  assert.ok(text.includes('US$ 400.00'));
  assert.ok(text.includes('Inicial: US$ 100.00'));
  assert.ok(!text.includes('Inicial: US$ 360.00'));
  assert.ok(text.includes('Recibido: S/ 360.00'));
  assert.ok(text.includes('Tipo de cambio: 3.6'));
  assert.ok(text.includes('Compras en soles: S/ 2,340.00'));
  assert.ok(text.includes('Compras en dólares: US$ 400.00'));
  const purchaseRows = rows(buildClientStatementDocument(fixture));
  const usdProduct = purchaseRows.find(row => row[0]?.text === 'Nutriente soluble importado · saco de 25 kg');
  assert.deepEqual(usdProduct.slice(1).map(cell => cell.text), ['2', 'US$ 200.00', 'US$ 400.00']);
  const penProduct = purchaseRows.find(row => row[0]?.text === 'Abono granulado · saco de 50 kg');
  assert.deepEqual(penProduct.slice(1).map(cell => cell.text), ['3', 'S/ 350.00', 'S/ 1,050.00']);
  const withMissingUsd = structuredClone(fixture);
  delete withMissingUsd.sales[3].totalUsd;
  delete withMissingUsd.sales[3].exchangeRate;
  assert.ok(texts(buildClientStatementDocument(withMissingUsd)).includes('USD sin importe registrado'));
});

test('summary preserves balances without repeating payment details; empty and paid statements stay clear', () => {
  const summary = texts(buildClientStatementDocument({ ...fixture, mode: 'summary', sales: undefined }));
  assert.ok(summary.includes('S/ 700.00'));
  assert.ok(summary.includes('US$ 200.00'));
  assert.ok(!summary.some(text => text.includes('Primer abono')));
  const empty = texts(buildClientStatementDocument({ ...fixture, credits: [], sales: [] }));
  assert.ok(empty.includes('No hay operaciones para mostrar.'));
  const paid = texts(buildClientStatementDocument({ ...fixture, credits: [fixture.credits[2]], sales: [] }));
  assert.ok(paid.some(text => text.startsWith('Pagado ·')));
  assert.ok(paid.includes('Sin saldo pendiente en estas cuentas'));
});

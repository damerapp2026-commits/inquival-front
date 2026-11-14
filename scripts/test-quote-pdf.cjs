const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, filename);
const { buildQuotePdfDefinition } = require('../src/modules/quotes/utils/quotePdf.ts');
const { setCompanyInfo } = require('../src/config/companyInfo.ts');
const fixture = require('./fixtures/quote.cjs');

function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(nodes)];
}
function text(document) {
  return nodes(document).filter(node => ['string', 'number'].includes(typeof node.text)).map(node => String(node.text)).join('\n');
}
function rows(document) {
  return nodes(document).filter(node => node.table).flatMap(node => node.table.body);
}
function build(overrides = {}) {
  setCompanyInfo(fixture.companyInfo);
  return buildQuotePdfDefinition({ ...fixture, ...overrides });
}

test('keeps the reference layout and prints customer data, full unit, currency, greeting and sales closing', () => {
  const document = build();
  const content = text(document);
  for (const value of [fixture.client.name, fixture.client.documentNumber, fixture.client.address, fixture.client.phone, fixture.client.email, 'Contacto de ejemplo', 'GALÓN', 'USD — Dólares americanos', 'CIENTO CINCUENTA Y NUEVE CON 30/100 DÓLARES AMERICANOS', 'Estimado(s) Sr(s):', 'Sin otro particular', fixture.companyInfo.salesEmail, 'CUENTA DE EJEMPLO']) {
    assert.ok(content.includes(value), value);
  }
  assert.doesNotMatch(content, /Información interna que no debe imprimirse/);
  const totals = rows(document);
  assert.equal(totals.find(row => row[0]?.text === 'OP. GRAVADAS')[2].text, '135.00');
  assert.equal(totals.find(row => row[0]?.text === 'I.G.V. 18%')[2].text, '24.30');
  assert.equal(totals.find(row => row[0]?.text === 'IMPORTE TOTAL')[2].text, '159.30');
  assert.ok(text(document.footer(1, 2)).includes('COT-00000011'));
  assert.ok(text(document.footer(1, 2)).includes('Página 1 de 2'));
});

test('soles remain consistent across the currency label, amount in words and totals', () => {
  const document = build({ quote: { ...fixture.quote, currency: 'PEN', paymentMethod: 'CONTADO' }, currency: 'USD' });
  const content = text(document);
  assert.match(content, /PEN — Soles/);
  assert.match(content, /CIENTO CINCUENTA Y NUEVE CON 30\/100 SOLES/);
  assert.doesNotMatch(content, /DÓLARES AMERICANOS/);
  assert.equal(rows(document).find(row => row[0]?.text === 'IMPORTE TOTAL')[1].text, 'S/');
  assert.ok(!rows(document).some(row => row[0]?.text === 'Plazo'));
});

test('credit terms and installment dates are clear and do not mutate the stored schedule', () => {
  const quote = { ...fixture.quote, creditDays: 60, paymentScheduleType: 'INSTALLMENTS', installments: [
    { amount: 79.65, dueDate: '2027-01-11T00:00:00.000Z' },
    { amount: 79.65, dueDate: '2026-12-12T05:00:00.000Z' },
  ] };
  const before = structuredClone(quote);
  const document = build({ quote });
  const allRows = rows(document);
  assert.equal(allRows.find(row => row[0]?.text === 'Plazo')[2].text, '60 días');
  assert.equal(allRows.find(row => row[0]?.text === 'Cuotas')[2].text, '2');
  const installments = nodes(document).find(node => node.table?.body[0]?.[0]?.text === 'CUOTA');
  assert.deepEqual(installments.table.body.slice(1).map(row => row[1].text), ['12/12/2026', '11/01/2027']);
  assert.deepEqual(quote, before);
});

test('saved exempt and unaffected products keep their tax treatment without a catalog record', () => {
  const quote = { ...fixture.quote, total: 188, items: [
    { ...fixture.quote.items[0], productId: 'taxable', productName: 'Producto gravado', unit: 'UNIDAD', unitPrice: 118, quantity: 1, subtotal: 118, taxType: 'GRAVADO' },
    { ...fixture.quote.items[0], productId: 'exempt', productName: 'Producto exonerado', unit: 'LITRO', unitPrice: 50, quantity: 1, subtotal: 50, taxType: 'EXONERADO' },
    { ...fixture.quote.items[0], productId: 'unaffected', productName: 'Producto inafecto', unit: 'UNIDAD', unitPrice: 20, quantity: 1, subtotal: 20, product: { taxType: 'INAFECTO' } },
  ] };
  const document = build({ quote, products: [] });
  const allRows = rows(document);
  assert.equal(allRows.find(row => row[0]?.text === 'OP. GRAVADAS')[2].text, '100.00');
  assert.equal(allRows.find(row => row[0]?.text === 'OP. EXONERADAS')[2].text, '50.00');
  assert.equal(allRows.find(row => row[0]?.text === 'OP. INAFECTAS')[2].text, '20.00');
  assert.equal(allRows.find(row => row[0]?.text === 'I.G.V. 18%')[2].text, '18.00');
  assert.match(text(document), /Producto exonerado/);
  assert.match(text(document), /UNIDAD/);
});

test('registered customer data and historical commercial notes remain available for older quotes', () => {
  const quote = { ...fixture.quote, clientName: undefined, clientDocumentNumber: undefined, clientAddress: undefined, clientPhone: undefined, clientEmail: undefined, paymentMethod: undefined, deliveryTime: undefined, deliveryPlace: undefined,
    notes: 'Forma de pago: CRÉDITO\nTiempo de entrega: 48 horas\nLugar de entrega: Local del cliente\nEntregar con aviso.\n\n[Interno] Información reservada' };
  const document = build({ quote });
  const content = text(document);
  for (const value of [fixture.client.name, fixture.client.documentNumber, fixture.client.address, fixture.client.phone, fixture.client.email, 'CRÉDITO', '48 horas', 'Local del cliente', 'Entregar con aviso.']) assert.ok(content.includes(value), value);
  assert.doesNotMatch(content, /Información reservada/);
});

for (const timezone of ['America/Lima', 'UTC', 'Asia/Tokyo']) {
  test(`quote and installment dates preserve Peru calendar days in ${timezone}`, t => {
    const previous = process.env.TZ;
    process.env.TZ = timezone;
    t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; });
    const content = text(build({ quote: { ...fixture.quote, issueDate: '2026-11-13T04:59:59.000Z', validUntil: '2026-11-27T00:00:00.000Z' } }));
    assert.match(content, /12\/11\/2026/);
    assert.match(content, /27\/11\/2026/);
    assert.doesNotMatch(content, /13\/11\/2026/);
  });
}

for (const issuer of [
  { legalName: 'EMPRESA A S.A.C.', ruc: '20111111111', address: 'Dirección de Empresa A' },
  { legalName: 'EMPRESA B S.A.C.', ruc: '20222222222', address: 'Dirección de Empresa B' },
]) test(`uses the quote's saved issuer instead of general settings: ${issuer.legalName}`, () => {
  const quote = { ...fixture.quote, fiscalEntityId: '000000000000000000000101', issuer };
  const content = text(build({ quote, fiscalEntity: { id: quote.fiscalEntityId, legalName: 'Nombre actualizado', ruc: '20999999999', address: 'Dirección actualizada' },
    company: { name: 'Almacén', ruc: '20888888888', address: 'Almacén de stock' } }));
  for (const value of [issuer.legalName, issuer.ruc, issuer.address]) assert.ok(content.includes(value), value);
  for (const value of [fixture.companyInfo.legalName, fixture.companyInfo.ruc, '20999999999', 'Almacén de stock']) assert.ok(!content.includes(value), value);
});
test('can print an ID-only quote from its matching issuer without substituting another company address', () => {
  const issuer = { id: '000000000000000000000101', legalName: 'EMPRESA SIN DIRECCIÓN', ruc: '20333333333', isActive: true };
  const content = text(build({ quote: { ...fixture.quote, fiscalEntityId: issuer.id }, fiscalEntity: issuer }));
  assert.match(content, /EMPRESA SIN DIRECCIÓN/); assert.match(content, /20333333333/);
  // The customer can share the branch address; check the issuer helper directly.
  const { getQuoteIssuer } = require('../src/modules/quotes/utils/quoteIssuer.ts');
  assert.equal(getQuoteIssuer({ fiscalEntityId: issuer.id }, issuer).address, undefined);
});

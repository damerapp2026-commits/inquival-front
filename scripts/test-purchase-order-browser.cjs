const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fixture = require('./fixtures/purchase-order.cjs');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5191';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);

async function setup(browser, mobile = false) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Tokyo', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'purchase-order-fixture'));
  const writes = [], errors = [], orders = [];
  await context.route('**/api/**', async route => {
    const request = route.request(), ep = new URL(request.url()).pathname.replace(/^\/api/, '');
    let data = [];
    if (request.method() !== 'GET') {
      writes.push({ endpoint: ep, method: request.method(), payload: request.postDataJSON() });
      if (request.method() !== 'POST' || ep !== '/purchases/orders') return route.abort();
      const payload = request.postDataJSON();
      data = { ...fixture.order, ...payload };
      orders.push(data);
    } else if (ep === '/auth/me') data = { id: 'admin', role: 'ADMIN', fullName: 'Administrador de prueba', isActive: true };
    else if (ep === '/business-settings') data = {};
    else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (ep === '/companies') data = fixture.companies;
    else if (ep === '/fiscal-entities') data = [fixture.fiscalEntity];
    else if (ep === '/products') data = { data: fixture.products, total: fixture.products.length };
    else if (ep === '/purchases/orders') data = { data: orders, total: orders.length };
    else if (ep === '/purchases/orders/example') data = orders[0];
    else if (['/purchases', '/suppliers', '/clients', '/sales', '/stock/lots/expiring'].includes(ep)) data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-11-12T15:00:00Z') });
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, writes, errors, orders };
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  try {
    const f = await setup(browser), { page } = f;
    await page.goto(`${base}/purchases/orders/new`);
    await page.getByText(`RUC: ${fixture.fiscalEntity.ruc}`, { exact: true }).waitFor();
    await page.getByLabel('Razón social', { exact: true }).fill(fixture.order.supplier);
    await page.getByLabel('RUC', { exact: true }).fill(fixture.order.supplierRuc);
    await page.getByLabel('Persona de contacto', { exact: true }).fill('Carlos Cabrera');
    await page.getByLabel('Teléfono', { exact: true }).fill('900000000');
    await page.getByLabel('Fecha de pedido', { exact: true }).fill('2026-11-12');
    await page.getByLabel('Vencimiento de cotización', { exact: true }).fill('2026-11-20');
    await page.getByRole('button', { name: 'US$ Dólares (USD)', exact: true }).click();
    await page.getByLabel('Referencia del punto de llegada', { exact: true }).fill('Local principal');
    await page.getByLabel('Dirección de entrega', { exact: true }).fill(fixture.details.deliveryAddress);
    await page.getByLabel('Transporte', { exact: true }).fill('Agencia de transporte');
    await page.getByLabel('Dirección del transportista', { exact: true }).fill('Av. Transportes 123');
    await page.getByLabel('Aprobado por', { exact: true }).fill('Jefe de compras');
    await page.getByRole('button', { name: 'Letra', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Crédito', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('combobox').selectOption('custom');
    await page.getByLabel('Plazo personalizado en días', { exact: true }).fill('20');
    await page.getByText('Vence: 02/12/2026', { exact: true }).waitFor();
    await page.getByRole('combobox').selectOption('45');
    await page.getByText('Vence: 27/12/2026', { exact: true }).waitFor();

    await page.getByPlaceholder('Almacén', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Almacén 2', exact: true }).click();
    await page.getByPlaceholder('Buscar producto', { exact: true }).first().fill('Hazal');
    await page.getByRole('button', { name: /Hazal x L/ }).click();
    await page.getByLabel('Cantidad', { exact: true }).first().fill('200');
    await page.getByLabel('P. unit. con IGV', { exact: true }).first().fill('3.2');
    await page.getByRole('button', { name: 'Agregar producto', exact: true }).click();
    await page.getByPlaceholder('Buscar producto', { exact: true }).nth(1).fill('A_plasto');
    await page.getByRole('button', { name: /A_plasto x L/ }).click();
    await page.getByLabel('Cantidad', { exact: true }).nth(1).fill('120');
    await page.getByLabel('P. unit. con IGV', { exact: true }).nth(1).fill('5');
    const totals = page.locator('dl').last();
    await totals.getByText('US$ 1,050.85', { exact: true }).waitFor();
    await totals.getByText('US$ 189.15', { exact: true }).waitFor();
    await totals.getByText('US$ 1,240.00', { exact: true }).waitFor();
    await page.getByText('Son: MIL DOSCIENTOS CUARENTA CON 00/100 DÓLARES AMERICANOS.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Guardar orden', exact: true }).click();
    await page.getByText('OC-00000001', { exact: true }).waitFor();
    assert.equal(f.writes.length, 1);
    const payload = f.writes[0].payload;
    assert.equal(payload.fiscalEntityId, fixture.fiscalEntity.id);
    assert.equal(payload.companyId, fixture.companies[0].id);
    assert.equal(payload.totalCostUsd, 1240);
    assert.equal(payload.paymentType, 'CREDITO');
    assert.equal(payload.dueDate, '2026-12-27');
    assert.deepEqual(payload.items.map(item => item.companyId), ['warehouse', 'warehouse']);
    assert.ok(payload.items.every(item => Math.abs(item.unitPriceSinIgv * 1.18 - item.unitPriceConIgv) < 1e-10));
    const metadata = JSON.parse(payload.notes.match(/\[OC_META\]([\s\S]*?)\[\/OC_META\]/)[1]);
    assert.equal(metadata.creditDays, 45);
    assert.equal(metadata.paymentForm, 'LETRA');
    assert.equal(metadata.supplierContact, 'Carlos Cabrera');
    assert.equal(metadata.transportAddress, 'Av. Transportes 123');
    assert.equal(metadata.approvedBy, 'Jefe de compras');
    console.log('PASS form fields, credit terms, included tax and complete saved metadata');

    await page.getByTitle('Ver detalle', { exact: true }).click();
    const detail = page.getByRole('heading', { name: 'Detalle de OC-00000001', exact: true }).locator('../..');
    await detail.getByRole('columnheader', { name: 'IGV incluido', exact: true }).waitFor();
    assert.equal(await detail.getByRole('columnheader', { name: 'Almacén', exact: true }).count(), 0);
    await detail.getByText('Av. Transportes 123', { exact: true }).waitFor();
    await detail.getByText('US$ 189.15', { exact: true }).waitFor();
    const downloadEvent = page.waitForEvent('download');
    await detail.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
    const download = await downloadEvent;
    assert.equal(await download.failure(), null);
    await download.saveAs(path.join('/tmp/inquival-ordenes-compra', 'orden-desde-aplicacion.pdf'));
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.errors, []);
    await f.context.close();
    console.log('PASS order detail and actual PDF download');

    const mobile = await setup(browser, true);
    await mobile.page.goto(`${base}/purchases/orders/new`);
    await mobile.page.getByRole('button', { name: 'Guardar orden', exact: true }).waitFor();
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'form must fit mobile width');
    assert.deepEqual(mobile.errors, []);
    assert.deepEqual(mobile.writes, []);
    await mobile.context.close();
    console.log('PASS mobile layout without writes');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

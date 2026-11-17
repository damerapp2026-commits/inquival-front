const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtemp, rm, mkdir } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fixture = require('./fixtures/purchase-order-hortus.cjs');
const legacy = require('./fixtures/purchase-order.cjs');

async function setup(browser, base, mobile, seededOrder) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Tokyo', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'purchase-order-fixture'));
  const writes = [], errors = [], lookups = [], orders = seededOrder ? [structuredClone(seededOrder)] : [];
  let failCreate = !seededOrder;
  await context.route('**/api/**', async route => {
    const request = route.request(), ep = new URL(request.url()).pathname.replace(/^\/api/, '');
    let data = [];
    if (request.method() !== 'GET') {
      const payload = request.postDataJSON(); writes.push({ endpoint: ep, method: request.method(), payload });
      assert.ok(ep === '/purchases/orders' || ep === `/purchases/orders/${fixture.order.id}`);
      if (request.method() === 'POST') {
        if (failCreate) { failCreate = false; return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: ['Error de prueba al guardar'] }) }); }
        data = { ...fixture.order, ...payload }; orders.push(data);
      } else {
        assert.equal(request.method(), 'PATCH');
        data = { ...orders[0], ...payload, status: 'PENDING', updatedAt: '2026-11-13T06:00:00Z' }; orders[0] = data;
      }
    } else if (ep === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isActive: true, isDefault: true }];
    else if (ep === '/auth/me') data = { id: 'admin', role: 'ADMIN', fullName: 'Administrador de prueba', isActive: true };
    else if (ep === '/business-settings') data = {};
    else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (ep === '/companies') data = fixture.companies;
    else if (ep === '/fiscal-entities') data = [fixture.fiscalEntity];
    else if (ep === '/products') data = { data: [...fixture.products, ...legacy.products], total: 4 };
    else if (ep === '/clients') data = { data: [{ id: 'contact', name: 'Juan Caceda', documentNumber: '12345678', phone: '993531796', isActive: true }], total: 1 };
    else if (ep === '/purchases/orders') data = { data: orders, total: orders.length };
    else if (ep === `/purchases/orders/${fixture.order.id}`) data = orders[0];
    else if (['/purchases', '/suppliers', '/sales', '/stock/lots/expiring'].includes(ep)) data = { data: [], total: 0 };
    else if (ep.startsWith('/lookup/ruc/')) {
      lookups.push(ep.split('/').pop());
      if (ep.endsWith('/20999999999')) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'RUC de prueba no encontrado' }) });
      data = { razonSocial: 'Transportes consultados por RUC S.A.C.', direccion: 'Av. Consultada 456', estado: 'ACTIVO' };
    }
    else if (ep === '/lookup/tipo-cambio') data = { compra: 3.7, venta: 3.8 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, writes, errors, orders, lookups };
}
async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-orders-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen(); const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    await mkdir('/tmp/inquival-ordenes-compra', { recursive: true });
    for (const mobile of [false, true]) {
      const currency = mobile ? 'PEN' : 'USD', symbol = mobile ? 'S/' : 'US$';
      const f = await setup(browser, base, mobile), { page } = f;
      await page.goto(`${base}/purchases/orders/new`);
      await page.getByText(`RUC: ${fixture.fiscalEntity.ruc}`, { exact: true }).waitFor();
      assert.equal(await page.getByText('Almacén destino', { exact: true }).count(), 0);
      await page.getByLabel('Razón social', { exact: true }).fill(fixture.order.supplier);
      await page.getByLabel('RUC', { exact: true }).fill(fixture.order.supplierRuc);
      await page.getByPlaceholder('Buscar contacto en clientes', { exact: true }).fill('Juan');
      await page.getByRole('button', { name: /Juan Caceda/ }).click();
      assert.equal(await page.getByLabel('Persona de contacto', { exact: true }).inputValue(), 'Juan Caceda');
      assert.equal(await page.getByLabel('Teléfono', { exact: true }).inputValue(), '993531796');
      await page.getByLabel('Fecha de pedido', { exact: true }).fill('2026-08-31');
      await page.getByLabel('Vencimiento de cotización', { exact: true }).fill('2026-08-31');
      if (!mobile) await page.getByRole('button', { name: 'US$ Dólares (USD)', exact: true }).click();
      await page.getByLabel('Referencia del punto de llegada', { exact: true }).fill(fixture.details.deliveryPlace);
      await page.getByLabel('Dirección de entrega', { exact: true }).fill(fixture.details.deliveryAddress);
      await page.getByLabel('RUC del transportista', { exact: true }).fill('123');
      await page.getByRole('button', { name: 'Buscar transportista por RUC', exact: true }).click();
      await page.getByText('Ingresa los 11 dígitos del RUC del transportista', { exact: true }).waitFor();
      assert.deepEqual(f.lookups, []);
      await page.getByLabel('RUC del transportista', { exact: true }).fill('20100047218');
      await page.getByRole('button', { name: 'Buscar transportista por RUC', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#transport-ruc')?.disabled === false);
      assert.equal(await page.getByLabel('Transporte', { exact: true }).inputValue(), 'Transportes consultados por RUC S.A.C.');
      assert.equal(await page.getByLabel('Dirección del transportista', { exact: true }).inputValue(), 'Av. Consultada 456');
      await page.getByLabel('RUC del transportista', { exact: true }).fill('20999999999');
      await page.getByRole('button', { name: 'Buscar transportista por RUC', exact: true }).click();
      await page.getByText('RUC de prueba no encontrado', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Transporte', { exact: true }).inputValue(), 'Transportes consultados por RUC S.A.C.');
      await page.getByLabel('RUC del transportista', { exact: true }).fill('20100047218');
      await page.getByLabel('Transporte', { exact: true }).fill('Transportista escrito libremente');
      await page.getByLabel('Dirección del transportista', { exact: true }).fill('Av. Agencia 123');
      await page.getByRole('button', { name: 'Letra', exact: true }).click();
      await page.getByLabel('Plazo de crédito', { exact: true }).selectOption('custom');
      await page.getByLabel('Plazo personalizado en días', { exact: true }).fill('120');
      await page.getByText('Vence: 29/12/2026', { exact: true }).waitFor();
      for (let index = 0; index < 3; index++) {
        if (index) await page.getByRole('button', { name: 'Agregar producto', exact: true }).click();
        const row = page.getByTestId('order-item').nth(index), item = fixture.order.items[index];
        if (item.productId) {
          await row.getByPlaceholder('Buscar producto', { exact: true }).fill(item.productName.split(' ')[0]);
          await page.getByRole('button', { name: new RegExp(item.productName) }).click();
        } else {
          await row.getByRole('button', { name: 'Escribir producto', exact: true }).click();
          await row.getByLabel('Nombre del producto', { exact: true }).fill(item.productName);
          await row.getByLabel('Unidad', { exact: true }).fill(item.unit);
          await row.getByLabel('Afectación IGV', { exact: true }).selectOption('EXONERADO');
        }
        await row.getByLabel('Cantidad', { exact: true }).fill(String(item.quantity));
        await row.getByLabel('P. unit. sin IGV', { exact: true }).fill(String(item.unitPriceSinIgv));
      }
      const totals = page.locator('dl').last();
      await totals.getByText(`${symbol} 4,740.00`, { exact: true }).waitFor();
      await totals.getByText(`${symbol} 540.00`, { exact: true }).waitFor();
      await totals.getByText(`${symbol} 5,280.00`, { exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'form fits viewport');
      await page.getByRole('button', { name: 'Letras / cuotas', exact: true }).click();
      await page.getByRole('button', { name: 'Guardar orden', exact: true }).click();
      assert.equal(f.writes.length, 0);
      await page.getByLabel('N° cuotas', { exact: true }).fill('3');
      const interval = mobile ? 20 : 15;
      await page.getByRole('button', { name: `Cada ${interval} días`, exact: true }).click();
      await page.getByRole('button', { name: 'Generar cuotas', exact: true }).click();
      const dates = mobile ? ['2026-09-20', '2026-10-10', '2026-10-30'] : ['2026-09-15', '2026-09-30', '2026-10-15'];
      for (let index = 0; index < 3; index++) {
        assert.equal(await page.getByLabel(`Vencimiento cuota ${index + 1}`, { exact: true }).inputValue(), dates[index]);
        assert.equal(await page.getByLabel(`Monto cuota ${index + 1}`, { exact: true }).inputValue(), '1760');
      }
      await page.getByLabel('Monto cuota 1', { exact: true }).fill('1759');
      await page.getByRole('button', { name: 'Guardar orden', exact: true }).click();
      assert.equal(f.writes.length, 0);
      await page.getByLabel('Monto cuota 1', { exact: true }).fill('1760');
      const editedDate = mobile ? '2026-10-11' : '2026-10-01';
      await page.getByLabel('Vencimiento cuota 2', { exact: true }).fill(editedDate);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'schedule fits viewport');
      await page.getByRole('button', { name: 'Guardar orden', exact: true }).click();
      await page.getByText('Error de prueba al guardar', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Nombre del producto', { exact: true }).inputValue(), fixture.order.items[2].productName);
      await page.getByRole('button', { name: 'Guardar orden', exact: true }).click();
      await page.getByText('OC-00000003', { exact: true }).waitFor();
      const payload = f.writes[1].payload;
      assert.equal(payload.companyId, undefined); assert.equal(payload.priceIncludesIgv, false);
      assert.equal(payload.currency, currency); assert.equal(payload[currency === 'USD' ? 'totalCostUsd' : 'totalCost'], 5280);
      assert.ok(payload.items.every(i => !i.companyId)); assert.equal(payload.items[2].productId, undefined);
      assert.equal(payload.items[2].productName, fixture.order.items[2].productName);
      const meta = JSON.parse(payload.notes.match(/\[OC_META\]([\s\S]*?)\[\/OC_META\]/)[1]);
      assert.equal(meta.supplierContact, 'Juan Caceda'); assert.equal(meta.supplierPhone, '993531796');
      assert.equal(payload.paymentScheduleType, 'INSTALLMENTS');
      assert.deepEqual(payload.installments.map(i => i.dueDate), [dates[0], editedDate, dates[2]]);
      assert.equal(payload.dueDate, dates[2]);
      assert.equal(meta.transportRuc, '20100047218');
      assert.equal(meta.transport, 'Transportista escrito libremente'); assert.equal(meta.transportAddress, 'Av. Agencia 123');
      await page.getByTitle('Ver detalle', { exact: true }).click();
      const detail = page.getByRole('heading', { name: 'Detalle de OC-00000003', exact: true }).locator('../..');
      await detail.getByRole('columnheader', { name: 'P. unit. sin IGV', exact: true }).waitFor();
      await detail.getByText(fixture.order.items[2].productName, { exact: true }).waitFor();
      await detail.getByText('20100047218', { exact: true }).waitFor();
      assert.equal(await detail.getByText('Almacenes destino', { exact: true }).count(), 0);
      if (!mobile) {
        const downloadEvent = page.waitForEvent('download');
        await detail.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
        const download = await downloadEvent; assert.equal(await download.failure(), null);
        await download.saveAs('/tmp/inquival-ordenes-compra/orden-hortus-nueva.pdf');
      }
      await detail.getByRole('link', { name: 'Editar', exact: true }).click();
      await page.getByRole('heading', { name: 'Editar OC-00000003', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Persona de contacto', { exact: true }).inputValue(), 'Juan Caceda');
      assert.equal(await page.getByLabel('Transporte', { exact: true }).inputValue(), 'Transportista escrito libremente');
      assert.equal(await page.getByLabel('RUC del transportista', { exact: true }).inputValue(), '20100047218');
      assert.equal(await page.getByLabel('Vencimiento cuota 2', { exact: true }).inputValue(), editedDate);
      const manual = page.getByTestId('order-item').nth(2);
      assert.equal(await manual.getByLabel('Afectación IGV', { exact: true }).inputValue(), 'EXONERADO');
      await manual.getByLabel('Cantidad', { exact: true }).fill('10');
      await page.getByLabel('Transporte', { exact: true }).fill('Transportista editado');
      await totals.getByText(`${symbol} 4,410.00`, { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      assert.equal(f.writes.length, 2, 'changed order total requires a matching schedule');
      await page.getByRole('button', { name: `Cada ${interval} días`, exact: true }).click();
      await page.getByRole('button', { name: 'Generar cuotas', exact: true }).click();
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      await page.getByTitle('Editar orden', { exact: true }).waitFor();
      assert.equal(f.writes.length, 3); assert.equal(f.writes[2].method, 'PATCH');
      assert.equal(f.writes[2].payload.expectedUpdatedAt, fixture.order.updatedAt);
      assert.deepEqual(f.writes[2].payload.installments.map(i => i.amount), [1470, 1470, 1470]);
      assert.equal(f.orders[0].orderNumber, 'OC-00000003'); assert.equal(f.orders[0].items[2].quantity, 10);
      await page.getByTitle('Ver detalle', { exact: true }).click();
      await detail.getByText('Transportista editado', { exact: true }).waitFor();
      await detail.getByRole('link', { name: 'Editar', exact: true }).click();
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Cantidad', { exact: true }).nth(2).inputValue(), '10');
      assert.equal(await page.getByLabel('Transporte', { exact: true }).inputValue(), 'Transportista editado');
      await page.goto(`${base}/purchases/orders/${fixture.order.id}/convert`);
      await page.getByText(/Solicitado:.*Sandia Santa Matilde/).waitFor();
      assert.equal(f.writes.length, 3); assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(`PASS ${mobile ? 'mobile PEN' : 'desktop USD'}: carrier RUC lookup/failure/manual edit, 15/20-day schedules, tax, save/retry, PDF, edit/reload and safe conversion`);
    }
    const f = await setup(browser, base, false, { ...legacy.order, id: fixture.order.id });
    await f.page.goto(`${base}/purchases/orders/${fixture.order.id}/edit`);
    await f.page.getByRole('button', { name: 'Guardar cambios', exact: true }).waitFor();
    await f.page.locator('dl').last().getByText('US$ 1,240.00', { exact: true }).waitFor();
    await f.page.getByLabel('Persona de contacto', { exact: true }).fill('Solo contacto editado');
    await f.page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await f.page.getByTitle('Editar orden', { exact: true }).waitFor();
    assert.equal(f.writes[0].payload.totalCostUsd, 1240); assert.equal(f.writes[0].payload.priceIncludesIgv, true);
    assert.deepEqual(f.errors, []); await f.context.close();
    console.log('PASS legacy order edit preserves its recorded gross total');
  } finally { if (browser) await browser.close(); await server.close(); await rm(cacheDir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

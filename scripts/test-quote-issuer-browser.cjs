const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtemp, rm, mkdir } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const id = n => String(n).padStart(24, '0');
const entities = [
  { id: id(101), legalName: 'EMPRESA A S.A.C.', ruc: '20111111111', address: 'Dirección A', isActive: true, isDefault: false },
  { id: id(102), legalName: 'EMPRESA B S.A.C.', ruc: '20222222222', address: 'Dirección B', isActive: true, isDefault: false },
  { id: id(103), legalName: 'EMPRESA INACTIVA', ruc: '20333333333', isActive: false, isDefault: false },
];
const issuer = entity => ({ legalName: entity.legalName, ruc: entity.ruc, address: entity.address });
const product = { id: id(401), name: 'Producto prueba', unit: 'LITRO', taxType: 'GRAVADO', isActive: true, prices: [{ priceTierId: 'price', price: 59 }] };
async function setup(browser, base, mobile, legacy = false) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'America/Lima', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'quote-issuer-fixture'));
  const fiscalEntities = structuredClone(entities), writes = [], errors = [], state = { failCreate: !legacy, failEntities: false };
  let quote = legacy ? { id: id(201), quoteNumber: 'P001-00000001', series: 'P001', number: 1, companyId: id(301), clientName: 'Cliente antiguo', sellerId: id(501), status: 'PENDING', currency: 'PEN',
    items: [{ productId: product.id, companyId: id(301), quantity: 2, unitPrice: 59, priceTier: 'price', subtotal: 118 }], total: 118,
    issueDate: '2026-11-14T05:00:00Z', validUntil: '2026-11-29T05:00:00Z', createdAt: '2026-11-14T05:00:00Z' } : null;
  await context.route('**/api/**', async route => {
    const request = route.request(), ep = new URL(request.url()).pathname.replace(/^\/api/, '');
    let data = [];
    if (request.method() !== 'GET') {
      const payload = request.postDataJSON(); writes.push({ ep, method: request.method(), payload });
      assert.ok(ep === '/quotes' || ep === `/quotes/${id(201)}`, ep);
      if (state.failCreate) { state.failCreate = false; return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: ['Error de prueba al guardar'] }) }); }
      const selected = fiscalEntities.find(entity => entity.id === payload.fiscalEntityId);
      const identity = quote?.fiscalEntityId === payload.fiscalEntityId && quote?.issuer ? quote.issuer : selected ? issuer(selected) : undefined;
      quote = { ...quote, ...payload, id: id(201), quoteNumber: 'P001-00000001', series: 'P001', number: 1, status: 'PENDING', issuer: identity,
        issueDate: '2026-11-14T05:00:00Z', validUntil: '2026-11-29T05:00:00Z', createdAt: '2026-11-14T05:00:00Z', sellerName: 'Responsable prueba',
        items: payload.items.map(item => ({ ...item, subtotal: item.quantity * item.unitPrice })), total: payload.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) };
      data = quote;
    } else if (ep === '/branches') data = [{ id: id(1), name: 'Principal', isActive: true, isDefault: true }];
    else if (ep === '/auth/me') data = { id: id(501), role: 'ADMIN', fullName: 'Responsable prueba', isActive: true };
    else if (ep === '/users') data = { data: [{ id: id(501), fullName: 'Responsable prueba', isActive: true }], total: 1 };
    else if (ep === '/business-settings') data = { legalName: 'EMPRESA GENERAL CONFIGURADA', ruc: '20999999999', address: 'Dirección general', bankAccounts: [] };
    else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (ep === '/fiscal-entities') {
      if (state.failEntities) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: ['Fallo al cargar empresas'] }) });
      data = fiscalEntities;
    } else if (ep === '/companies') data = [{ id: id(301), name: 'Almacén de stock', isActive: true }];
    else if (ep === '/products') data = { data: [product], total: 1 };
    else if (ep === '/price-tiers') data = [{ id: 'price', name: 'Minorista', isActive: true, priority: 1 }];
    else if (ep === '/quotes') data = { data: quote ? [quote] : [], total: quote ? 1 : 0 };
    else if (ep === `/quotes/${id(201)}`) data = quote;
    else if (['/clients', '/stock/lots/expiring', '/loans', '/sales'].includes(ep)) data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, writes, errors, fiscalEntities, state, quote: () => quote };
}
async function download(page, row, name) {
  const event = page.waitForEvent('download'); await row.getByTitle('Descargar PDF', { exact: true }).click();
  const result = await event; assert.equal(await result.failure(), null); await result.saveAs(`/tmp/inquival-quote-issuer/${name}.pdf`);
}
async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-quote-issuer-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen(); const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    await mkdir('/tmp/inquival-quote-issuer', { recursive: true });
    for (const mobile of [false, true]) {
      const f = await setup(browser, base, mobile), { page } = f;
      await page.goto(`${base}/quotes/new`);
      const choice = page.getByLabel('Empresa que cotiza', { exact: true });
      await choice.waitFor(); assert.equal(await choice.inputValue(), '');
      assert.equal(await choice.getByRole('option').count(), 3);
      assert.equal(await choice.getByRole('option', { name: /INACTIVA/ }).count(), 0);
      await page.getByPlaceholder('Distribuidora Los Andes S.A.C.').fill('Cliente cotización');
      await page.getByRole('button', { name: 'Agregar primera línea', exact: true }).click();
      const search = page.getByPlaceholder('Buscar producto por nombre o principio activo…');
      await search.evaluate(element => element.scrollIntoView({ block: 'center' }));
      await search.fill('Producto');
      await page.getByRole('button', { name: /Producto prueba/ }).click();
      const products = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Productos y servicios', exact: true }) });
      await products.getByRole('spinbutton').first().fill('2');
      assert.equal(await page.getByRole('button', { name: 'Guardar cotización', exact: true }).isEnabled(), false);
      await choice.selectOption(entities[1].id);
      const box = await choice.boundingBox(); assert.ok(box && box.width <= (mobile ? 390 : 1440));
      await page.getByText('RUC: 20222222222', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Guardar cotización', exact: true }).click();
      await page.getByText('Error de prueba al guardar', { exact: true }).waitFor();
      assert.equal(await choice.inputValue(), entities[1].id);
      await page.getByRole('button', { name: 'Guardar cotización', exact: true }).click();
      await page.getByText('P001-00000001', { exact: true }).waitFor();
      const row = page.getByRole('row').filter({ hasText: 'P001-00000001' });
      await row.getByText('EMPRESA B S.A.C.', { exact: true }).waitFor();
      assert.equal(f.writes[1].payload.fiscalEntityId, entities[1].id); assert.equal(f.writes[1].payload.companyId, id(301));
      assert.equal(f.writes[1].payload.items[0].companyId, id(301)); assert.equal(f.writes[1].payload.issuer, undefined);
      if (!mobile) await download(page, row, 'empresa-b');
      await row.getByTitle('Ver detalle', { exact: true }).click();
      await page.getByText('Empresa que cotiza', { exact: true }).waitFor();
      await page.getByText('EMPRESA B S.A.C.', { exact: true }).last().waitFor();
      await page.reload();
      // A saved quote must retain its issuer when the catalogue/default settings change.
      Object.assign(f.fiscalEntities[1], { legalName: 'NOMBRE NUEVO DE B', ruc: '20777777777', address: 'Dirección posterior', isActive: false });
      await row.getByTitle('Editar cotización', { exact: true }).click(); await page.reload();
      await page.getByRole('button', { name: 'Actualizar cotización', exact: true }).waitFor();
      assert.equal(await choice.inputValue(), entities[1].id);
      await page.getByText('RUC: 20222222222', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Actualizar cotización', exact: true }).click();
      await row.getByText('EMPRESA B S.A.C.', { exact: true }).waitFor();
      assert.deepEqual(f.quote().issuer, issuer(entities[1]));
      await row.getByTitle('Editar cotización', { exact: true }).click();
      await page.getByRole('button', { name: 'Actualizar cotización', exact: true }).waitFor();
      await choice.selectOption(entities[0].id);
      await page.getByText('RUC: 20111111111', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Actualizar cotización', exact: true }).click();
      await row.getByText('EMPRESA A S.A.C.', { exact: true }).waitFor();
      assert.equal(f.quote().quoteNumber, 'P001-00000001'); assert.equal(f.quote().total, 118);
      assert.deepEqual(f.quote().issuer, issuer(entities[0])); assert.equal(f.writes.length, 4);
      if (!mobile) await download(page, row, 'empresa-a');
      assert.deepEqual(f.errors, []); await f.context.close();
      console.log(`PASS ${mobile ? 'mobile' : 'desktop'}: choose B, save/retry, show issuer, retain saved identity and edit to A without changing stock warehouse or amount`);
    }
    const f = await setup(browser, base, false, true), { page } = f;
    await page.goto(`${base}/quotes/${id(201)}/edit`);
    await page.getByRole('button', { name: 'Actualizar cotización', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Empresa que cotiza', { exact: true }).inputValue(), '');
    await page.getByRole('button', { name: 'Actualizar cotización', exact: true }).click();
    await page.getByText('P001-00000001', { exact: true }).waitFor();
    assert.equal(f.writes[0].payload.fiscalEntityId, undefined); assert.equal(f.quote().issuer, undefined);
    assert.deepEqual(f.errors, []); await f.context.close();
    console.log('PASS legacy edit retains its prior issuer behavior');
  } finally { if (browser) await browser.close(); await server.close(); await rm(cacheDir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

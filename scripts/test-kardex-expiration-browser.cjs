const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtemp, rm } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

const product = { id: 'product', name: 'Producto prueba', unit: 'UND', isActive: true, prices: [] };
const companies = [{ id: 'warehouse-a', name: 'Almacén A' }, { id: 'warehouse-b', name: 'Almacén B' }];
const seedLots = [
  { id: '000000000000000000000001', productId: product.id, companyId: 'warehouse-a', companyName: 'Almacén A', lotNumber: 'LOTE-A', expirationDate: '2026-12-15T00:00:00.000Z', initialQuantity: 10, currentQuantity: 10, receivedAt: '2026-11-01T05:00:00Z', purchaseId: 'purchase', isActive: true },
  { id: '000000000000000000000002', productId: product.id, companyId: 'warehouse-b', companyName: 'Almacén B', lotNumber: 'LOTE-B', expirationDate: '2027-03-20T05:00:00.000Z', initialQuantity: 20, currentQuantity: 20, receivedAt: '2026-11-01T05:00:00Z', purchaseId: 'purchase', isActive: true },
  { id: '000000000000000000000003', productId: product.id, companyId: 'warehouse-a', companyName: 'Almacén A', lotNumber: 'LOTE-C', initialQuantity: 5, currentQuantity: 5, receivedAt: '2026-11-01T05:00:00Z', isActive: true },
];

async function setup(browser, base, mobile = false, noLots = false, noStock = false) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'America/Lima', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'fixture'));
  let lots = noLots ? [] : structuredClone(seedLots), failNextSave = false;
  const writes = [], errors = [];
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^\/api/, '');
    let data = [];
    if (request.method() !== 'GET') {
      if (request.method() === 'POST' && endpoint === '/product-lots/from-stock') {
        const body = request.postDataJSON();
        assert.deepEqual(Object.keys(body).sort(), ['companyId', 'expirationDate', 'lotNumber', 'productId', 'quantity']);
        writes.push({ method: 'POST', body });
        if (failNextSave) {
          failNextSave = false;
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'No se pudo guardar el lote de prueba' }) });
        }
        if (lots.some(lot => lot.companyId === body.companyId && lot.lotNumber === body.lotNumber)) {
          return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Este lote ya existe en el almacén' }) });
        }
        data = { id: String(100 + lots.length).padStart(24, '0'), ...body, companyName: companies.find(company => company.id === body.companyId)?.name,
          initialQuantity: body.quantity, currentQuantity: body.quantity, expirationDate: `${body.expirationDate}T05:00:00.000Z`, receivedAt: '2026-11-14T05:00:00Z', isActive: true };
        lots.push(data);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
      }
      assert.equal(request.method(), 'PATCH');
      const match = /^\/product-lots\/([a-f\d]{24})\/expiration-date$/.exec(endpoint);
      assert.ok(match, `Unexpected write: ${endpoint}`);
      const body = request.postDataJSON();
      assert.deepEqual(Object.keys(body), ['expirationDate']);
      writes.push({ id: match[1], body });
      if (failNextSave) {
        failNextSave = false;
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'No se pudo guardar la fecha de prueba' }) });
      }
      lots = lots.map(lot => lot.id === match[1] ? { ...lot, expirationDate: `${body.expirationDate}T05:00:00.000Z` } : lot);
      data = lots.find(lot => lot.id === match[1]);
    } else if (endpoint === '/auth/me') data = { id: 'operator', role: 'ADMIN', fullName: 'Prueba', isActive: true };
    else if (endpoint === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isActive: true, isDefault: true }];
    else if (endpoint === '/business-settings') data = {};
    else if (endpoint === '/companies') data = companies;
    else if (endpoint === '/products') data = { data: [product], total: 1 };
    else if (endpoint === '/products/product') data = product;
    else if (endpoint === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (endpoint === '/stock/by-product') data = [{ productId: product.id, totalQuantity: noStock ? 0 : 35, byCompany: [{ companyId: 'warehouse-a', quantity: noStock ? 0 : 15 }, { companyId: 'warehouse-b', quantity: noStock ? 0 : 20 }] }];
    else if (endpoint === '/product-lots' || endpoint === '/product-lots/expiring') {
      data = lots.filter(lot => (!url.searchParams.get('companyId') || lot.companyId === url.searchParams.get('companyId')) &&
        (endpoint !== '/product-lots/expiring' || (lot.expirationDate && lot.currentQuantity > 0)));
    } else if (endpoint === '/stock-movements') data = { total: 2, data: companies.map((company, index) => ({
      id: `movement-${index}`, productId: product.id, companyId: company.id, movementType: 'PURCHASE', quantity: index ? 20 : 10,
      previousStock: 0, newStock: index ? 20 : 10, referenceId: 'purchase', referenceType: 'Purchase', description: 'Ingreso de prueba', date: '2026-11-01T05:00:00Z',
    })) };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/kardex`);
  return { page, context, writes, errors, failSave: () => { failNextSave = true; }, lots: () => structuredClone(lots) };
}

async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-kardex-expiration-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    for (const mobile of [false, true]) {
      const f = await setup(browser, base, mobile), { page } = f;
      const dateButton = page.getByRole('button', { name: 'Cambiar vencimiento de Producto prueba', exact: true });
      await dateButton.click();
      assert.equal(new URL(page.url()).searchParams.get('productId'), null);
      await page.getByRole('heading', { name: 'Cambiar fecha de vencimiento' }).waitFor();
      assert.equal(await page.getByLabel('Fecha de vencimiento', { exact: true }).inputValue(), '2026-12-15');
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(f.writes.length, 0);
      await dateButton.click();
      await page.getByLabel('Fecha de vencimiento', { exact: true }).fill('2027-01-15');
      await page.getByRole('button', { name: 'Guardar fecha', exact: true }).click();
      await page.getByRole('heading', { name: 'Cambiar fecha de vencimiento' }).waitFor({ state: 'hidden' });
      assert.equal(await dateButton.innerText(), '15/01/2027');
      assert.equal(f.writes[0].id, seedLots[0].id);
      assert.equal(f.lots()[1].expirationDate, seedLots[1].expirationDate);
      await page.reload();
      assert.equal(await dateButton.innerText(), '15/01/2027');
      // Every lot is accessible; a missing date can be filled without changing stock.
      await page.getByText('Producto prueba', { exact: true }).click();
      await page.getByRole('button', { name: 'Cambiar vencimiento del lote LOTE-C en Almacén A', exact: true }).click();
      assert.equal(await page.getByLabel('Fecha de vencimiento', { exact: true }).inputValue(), '');
      await page.getByLabel('Fecha de vencimiento', { exact: true }).fill('2027-06-30');
      f.failSave();
      await page.getByRole('button', { name: 'Guardar fecha', exact: true }).click();
      await page.getByText('No se pudo guardar la fecha de prueba', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Fecha de vencimiento', { exact: true }).inputValue(), '2027-06-30');
      await page.getByRole('button', { name: 'Guardar fecha', exact: true }).click();
      await page.getByRole('heading', { name: 'Cambiar fecha de vencimiento' }).waitFor({ state: 'hidden' });
      assert.equal(f.lots()[2].expirationDate, '2027-06-30T05:00:00.000Z');
      assert.equal(f.lots()[2].currentQuantity, 5);
      // Purchase rows show only the lots in the movement's warehouse.
      const movementRows = page.locator('tr').filter({ hasText: 'Ingreso de prueba' });
      assert.equal(await movementRows.nth(0).getByText('Lote: LOTE-B', { exact: true }).count(), 0);
      assert.equal(await movementRows.nth(1).getByText('Lote: LOTE-A', { exact: true }).count(), 0);
      await movementRows.nth(1).getByRole('button', { name: 'Cambiar vencimiento del lote LOTE-B en Almacén B', exact: true }).click();
      assert.equal(await page.getByLabel('Fecha de vencimiento', { exact: true }).inputValue(), '2027-03-20');
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.deepEqual(f.errors, []);
      await f.context.close();
      process.stdout.write(`PASS ${mobile ? 'mobile' : 'desktop'}: direct date click, selected lot, cancel, save, refresh, missing date, failure/retry and warehouse matching\n`);

      const created = await setup(browser, base, mobile, true), cp = created.page;
      const date = cp.getByRole('button', { name: 'Cambiar vencimiento de Producto prueba', exact: true });
      await date.click();
      await cp.getByLabel('Número de lote', { exact: true }).waitFor();
      const save = cp.getByRole('button', { name: 'Crear lote y guardar', exact: true });
      assert.equal(await save.isDisabled(), true);
      await cp.getByLabel('Almacén', { exact: true }).selectOption('warehouse-a');
      assert.equal(await cp.getByLabel('Unidades existentes de este lote', { exact: true }).inputValue(), '15');
      await cp.getByLabel('Número de lote', { exact: true }).fill('   ');
      await cp.getByLabel('Fecha de vencimiento', { exact: true }).fill('2028-02-29');
      assert.equal(await save.isDisabled(), true);
      await cp.getByLabel('Número de lote', { exact: true }).fill('  LOTE-NUEVO  ');
      await cp.getByLabel('Unidades existentes de este lote', { exact: true }).fill('16');
      assert.equal(await save.isDisabled(), true);
      await cp.getByLabel('Unidades existentes de este lote', { exact: true }).fill('7');
      created.failSave(); await save.click();
      await cp.getByText('No se pudo guardar el lote de prueba', { exact: true }).waitFor();
      assert.equal(await cp.getByLabel('Número de lote', { exact: true }).inputValue(), '  LOTE-NUEVO  ');
      assert.equal(await cp.getByLabel('Fecha de vencimiento', { exact: true }).inputValue(), '2028-02-29');
      assert.equal(await cp.getByLabel('Unidades existentes de este lote', { exact: true }).inputValue(), '7');
      await save.click();
      await cp.getByRole('heading', { name: 'Cambiar fecha de vencimiento' }).waitFor({ state: 'hidden' });
      assert.equal(await date.innerText(), '29/02/2028');
      assert.equal(created.lots().length, 1);
      assert.equal(created.lots()[0].lotNumber, 'LOTE-NUEVO');
      assert.equal(created.lots()[0].currentQuantity, 7);
      assert.deepEqual(created.writes[1].body, { productId: product.id, companyId: 'warehouse-a', lotNumber: 'LOTE-NUEVO', expirationDate: '2028-02-29', quantity: 7 });
      await cp.reload();
      assert.equal(await date.innerText(), '29/02/2028');
      await date.click();
      assert.equal(await cp.getByLabel('Fecha de vencimiento', { exact: true }).inputValue(), '2028-02-29');
      await cp.getByRole('button', { name: 'Crear nuevo lote', exact: true }).click();
      await cp.getByLabel('Número de lote', { exact: true }).waitFor();
      await cp.getByLabel('Almacén', { exact: true }).selectOption('warehouse-a');
      assert.equal(await cp.getByLabel('Unidades existentes de este lote', { exact: true }).inputValue(), '8');
      await cp.getByLabel('Número de lote', { exact: true }).fill('LOTE-NUEVO');
      await cp.getByLabel('Fecha de vencimiento', { exact: true }).fill('2028-03-01');
      await cp.getByLabel('Unidades existentes de este lote', { exact: true }).fill('1');
      await save.click();
      await cp.getByText('Este lote ya existe en el almacén', { exact: true }).waitFor();
      assert.equal(created.lots().length, 1);
      assert.equal(await cp.getByLabel('Número de lote', { exact: true }).inputValue(), 'LOTE-NUEVO');
      await cp.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await cp.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await cp.getByText('Producto prueba', { exact: true }).click();
      await cp.getByText('LOTE-NUEVO', { exact: true }).waitFor();
      assert.deepEqual(created.errors, []);
      await created.context.close();
      process.stdout.write(`PASS ${mobile ? 'mobile' : 'desktop'}: create a missing lot, required fields, existing units only, warehouse, failure/retry, duplicate rejection and persistence after reload\n`);
    }
    const empty = await setup(browser, base, false, true, true), ep = empty.page;
    await ep.getByText('Producto prueba', { exact: true }).click();
    await ep.getByRole('button', { name: 'Crear lote y vencimiento', exact: true }).click();
    await ep.getByLabel('Número de lote', { exact: true }).fill('LOTE-SIN-STOCK');
    await ep.getByLabel('Almacén', { exact: true }).selectOption('warehouse-a');
    await ep.getByLabel('Fecha de vencimiento', { exact: true }).fill('2028-01-31');
    assert.equal(await ep.getByLabel('Unidades existentes de este lote', { exact: true }).inputValue(), '0');
    await ep.getByRole('button', { name: 'Crear lote y guardar', exact: true }).click();
    await ep.getByRole('heading', { name: 'Cambiar fecha de vencimiento' }).waitFor({ state: 'hidden' });
    await ep.getByText('LOTE-SIN-STOCK', { exact: true }).waitFor();
    assert.equal(empty.lots()[0].currentQuantity, 0);
    assert.deepEqual(empty.errors, []); await empty.context.close();
    process.stdout.write('PASS product detail: a zero-stock lot can retain its expiration without inventing stock\n');
  } finally {
    await browser?.close();
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });

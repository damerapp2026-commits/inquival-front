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

async function setup(browser, base, mobile = false) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'America/Lima', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'fixture'));
  let lots = structuredClone(seedLots), failNextSave = false;
  const writes = [], errors = [];
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^\/api/, '');
    let data = [];
    if (request.method() !== 'GET') {
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
    else if (endpoint === '/stock/by-product') data = [{ productId: product.id, totalQuantity: 35, byCompany: [{ companyId: 'warehouse-a', quantity: 15 }, { companyId: 'warehouse-b', quantity: 20 }] }];
    else if (endpoint === '/product-lots' || endpoint === '/product-lots/expiring') {
      data = lots.filter(lot => (!url.searchParams.get('companyId') || lot.companyId === url.searchParams.get('companyId')) &&
        (endpoint !== '/product-lots/expiring' || lot.expirationDate));
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
    }
  } finally {
    await browser?.close();
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });

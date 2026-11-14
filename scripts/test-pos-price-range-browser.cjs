const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtemp, rm } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

const product = {
  id: 'product', name: 'Producto prueba', unit: 'UND', taxType: 'EXONERADO', isActive: true,
  prices: [{ priceTierId: 'distributor', price: 100 }, { priceTierId: 'farmer', price: 150 }],
};
const tiers = [
  { id: 'distributor', name: 'Distribuidor', isActive: true, priority: 1 },
  { id: 'farmer', name: 'P. AGRICULTOR', isActive: true, priority: 2 },
  { id: 'inactive', name: 'Inactivo', isActive: false, priority: 3 },
];
const draft = {
  cart: [{ productId: product.id, name: product.name, unit: product.unit, quantity: 1, unitPrice: 100, taxType: product.taxType, sourceCompanyId: 'company' }],
  bonusItems: [], companyId: 'company', tierId: 'distributor',
};

async function checkRole(browser, base, role, mobile) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  const writes = [], errors = [];
  try {
    await context.addInitScript(value => {
      localStorage.setItem('token', 'pos-price-range-fixture');
      if (!localStorage.getItem('inquival:pos:draft:v1')) localStorage.setItem('inquival:pos:draft:v1', JSON.stringify(value));
    }, draft);
    await context.route('**/api/**', async route => {
      const request = route.request(), ep = new URL(request.url()).pathname.replace(/^\/api/, '');
      let data = [];
      if (request.method() !== 'GET') {
        assert.equal(request.method(), 'POST');
        assert.equal(ep, '/sales');
        const payload = request.postDataJSON();
        writes.push(payload);
        data = { id: 'sale', saleNumber: 'NI01-00000001', ...payload };
      } else if (ep === '/auth/me') data = { id: 'worker', fullName: 'Trabajador prueba', role, isActive: true };
      else if (ep === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isDefault: true, isActive: true }];
      else if (ep === '/business-settings') data = {};
      else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
      else if (ep === '/products') data = { data: [product], total: 1 };
      else if (ep === '/companies') data = [{ id: 'company', name: 'Principal', isActive: true }];
      else if (ep === '/price-tiers') data = tiers;
      else if (ep === '/payment-methods') data = [{ id: 'cash', name: 'Efectivo', isActive: true }];
      else if (ep === '/stock/by-product') data = [{ productId: product.id, totalQuantity: 20, byCompany: [{ companyId: 'company', quantity: 20 }] }];
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/pos`);
    if (mobile) await page.getByRole('button', { name: /1 producto.*S\/ 100/ }).click();
    const range = page.getByLabel('Rango:', { exact: true });
    await range.waitFor();
    assert.equal(await range.isEnabled(), true);
    assert.deepEqual(await range.locator('option').allTextContents(), ['Distribuidor', 'P. AGRICULTOR']);
    assert.equal(await range.inputValue(), 'distributor');
    await range.selectOption('farmer');
    await page.locator('aside').getByText('S/ 150.00 · UND', { exact: true }).waitFor();
    await page.waitForFunction(() => {
      const value = JSON.parse(localStorage.getItem('inquival:pos:draft:v1') || '{}');
      return value.tierId === 'farmer' && value.cart?.[0]?.unitPrice === 150;
    });
    await page.reload();
    if (mobile) await page.getByRole('button', { name: /1 producto.*S\/ 150/ }).click();
    await page.locator('aside').getByText('S/ 150.00 · UND', { exact: true }).waitFor();
    assert.equal(await range.inputValue(), 'farmer');
    if (role !== 'ADMIN') assert.equal(await page.getByTitle('Cambiar precio / rango', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Vender', exact: true }).click();
    await page.getByRole('button', { name: /^Siguiente/ }).click();
    await page.getByPlaceholder('0.00', { exact: true }).fill('150');
    await page.getByRole('button', { name: /^Confirmar ·/ }).click();
    await page.getByRole('heading', { name: '¡Venta registrada!', exact: true }).waitFor();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].items[0].priceTier, 'farmer');
    assert.equal(writes[0].items[0].unitPrice, 150);
    assert.equal(writes[0].payments[0].amount, 150);
    assert.equal(writes[0].sellerId, 'worker');
    assert.deepEqual(errors, []);
    console.log(`PASS ${role} ${mobile ? 'mobile' : 'desktop'}: active ranges selectable, cart repriced, draft restored and selected price submitted`);
  } finally {
    await context.close();
  }
}

async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-pos-price-range-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    for (const role of ['VENDEDOR', 'VENDEDOR_CAMPO', 'ADMIN']) {
      for (const mobile of [false, true]) await checkRole(browser, base, role, mobile);
    }
  } finally {
    if (browser) await browser.close();
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtemp, rm } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-product-status-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => localStorage.setItem('token', 'product-status-fixture'));
    const products = [
      { id: 'target', name: 'Producto de prueba', isActive: true },
      { id: 'other', name: 'Otro producto activo', isActive: true },
      { id: 'inactive', name: 'Producto inicialmente inactivo', isActive: false },
    ].map(product => ({ ...product, categoryId: 'category', unit: 'UND', taxType: 'EXONERADO', prices: [{ priceTierId: 'retail', price: 100 }] }));
    const state = { failNext: false, gate: null };
    const writes = [], reads = [], errors = [];
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), ep = url.pathname.replace(/^\/api/, '');
      let data = [];
      if (request.method() !== 'GET') {
        assert.equal(request.method(), 'PUT');
        assert.equal(ep, '/products/target');
        const payload = request.postDataJSON();
        writes.push(payload);
        assert.deepEqual(Object.keys(payload), ['isActive'], 'only status changes, without stock or price writes');
        if (state.gate) await state.gate;
        if (state.failNext) {
          state.failNext = false;
          return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: ['Fallo simulado al cambiar estado'] }) });
        }
        products[0].isActive = payload.isActive;
        data = products[0];
      } else if (ep === '/auth/me') data = { id: 'admin', role: 'ADMIN', fullName: 'Prueba', isActive: true };
      else if (ep === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isDefault: true, isActive: true }];
      else if (ep === '/business-settings') data = {};
      else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
      else if (ep === '/products') {
        const params = Object.fromEntries(url.searchParams);
        reads.push(params);
        const rows = products.filter(product => (params.includeInactive === 'true' || product.isActive)
          && (!params.search || product.name.toLowerCase().includes(params.search.toLowerCase())));
        // Simulate a capped API page so an inactive product is on the second page.
        const size = Math.min(Number(params.limit || 20), 2), page = Number(params.page || 1);
        data = { data: rows.slice((page - 1) * size, page * size), total: rows.length };
      } else if (ep === '/companies') data = [{ id: 'company', name: 'Principal', isActive: true }];
      else if (ep === '/categories') data = [{ id: 'category', name: 'Categoría', isActive: true }];
      else if (ep === '/stock/by-product') data = products.map(product => ({ productId: product.id, totalQuantity: 10, byCompany: [{ companyId: 'company', quantity: 10 }] }));
      else if (ep === '/price-tiers') data = [{ id: 'retail', name: 'Minorista', priority: 1, isActive: true }];
      else if (ep === '/lookup/tipo-cambio') data = { venta: 3.75, fecha: '2026-11-14' };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    const toggle = page.getByRole('switch', { name: 'Mostrar Producto de prueba en el POS', exact: true });
    const waitChecked = value => page.waitForFunction(value => document.querySelector('[role="switch"][aria-label="Mostrar Producto de prueba en el POS"]')?.getAttribute('aria-checked') === String(value), value);
    const targetCard = page.getByRole('button').filter({ has: page.getByText('Producto de prueba', { exact: true }) });
    await page.goto(`${base}/products?view=catalog`);
    await waitChecked(true);
    assert.equal(await page.getByRole('switch').count(), 3);
    assert.equal(await page.getByRole('switch', { name: 'Mostrar Producto inicialmente inactivo en el POS', exact: true }).getAttribute('aria-checked'), 'false');
    assert.ok(reads.some(params => params.includeInactive === 'true' && params.page === '2'));
    const row = toggle.locator('xpath=ancestor::tr');
    assert.equal(await page.getByRole('spinbutton', { name: 'Precio final de Producto de prueba', exact: true }).inputValue(), '100.00');
    assert.equal((await row.locator('td').nth(2).innerText()).trim(), '10');

    let release;
    state.gate = new Promise(resolve => { release = resolve; });
    await toggle.click();
    await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Mostrar Producto de prueba en el POS"]')?.disabled);
    assert.equal(await toggle.getAttribute('aria-checked'), 'true', 'do not claim success before the server responds');
    await toggle.evaluate(button => button.click());
    assert.equal(writes.length, 1, 'pending status cannot be submitted twice');
    release(); state.gate = null;
    await waitChecked(false);
    await page.getByText('Producto desactivado del POS', { exact: true }).waitFor();
    assert.deepEqual(writes, [{ isActive: false }]);
    assert.equal(await row.locator('td').nth(2).innerText(), '10');
    assert.equal(await page.getByRole('spinbutton', { name: 'Precio final de Producto de prueba', exact: true }).inputValue(), '100.00');
    await page.reload();
    await waitChecked(false);
    const statusFilter = page.getByLabel('Estado del producto', { exact: true });
    await statusFilter.selectOption('inactive');
    assert.equal(await page.getByRole('switch').count(), 2);
    assert.equal(await toggle.getAttribute('aria-checked'), 'false');
    await statusFilter.selectOption('active');
    assert.equal(await toggle.count(), 0);
    assert.equal(await page.getByRole('switch').count(), 1);
    await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
    await waitChecked(false);
    assert.equal(await statusFilter.inputValue(), 'all');
    assert.equal(await page.getByRole('switch').count(), 3);
    await page.goto(`${base}/pos`);
    await page.getByRole('button').filter({ has: page.getByText('Otro producto activo', { exact: true }) }).waitFor();
    assert.equal(await targetCard.count(), 0);
    assert.equal(await page.getByText('Producto inicialmente inactivo', { exact: true }).count(), 0);
    console.log('PASS inactive products stay in the complete catalog for reactivation, persist after reload and disappear from POS without changing price or stock');

    await page.goto(`${base}/products?view=catalog`);
    await waitChecked(false);
    state.failNext = true;
    await toggle.click();
    await page.getByText('Fallo simulado al cambiar estado', { exact: true }).waitFor();
    assert.equal(await toggle.getAttribute('aria-checked'), 'false');
    assert.equal(await toggle.isEnabled(), true);
    await toggle.click();
    await waitChecked(true);
    await page.getByText('Producto activado en el POS', { exact: true }).waitFor();
    await page.reload();
    await waitChecked(true);
    await page.goto(`${base}/pos`);
    await targetCard.waitFor();
    assert.match(await targetCard.innerText(), /100\.00/);
    assert.deepEqual(writes, [{ isActive: false }, { isActive: true }, { isActive: true }]);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS a failed update preserves the real status, can be retried, and reactivation restores the product in POS');
  } finally {
    if (browser) await browser.close();
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

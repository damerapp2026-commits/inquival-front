const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const r2 = value => Math.round(value * 100) / 100;

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript(() => {
      localStorage.setItem('token', 'fixture');
      // The stored catalog rate also survives a page reload.
      if (!localStorage.getItem('priceCatalog:globalRates:v1')) {
        localStorage.setItem('priceCatalog:globalRates:v1', JSON.stringify({ tcOverride: 3.4, margenDist: 1.12, margenFinal: 1.09 }));
      }
    });
    const products = [
      { id: 'pen-exempt', name: 'Humus PEN', taxType: 'EXONERADO', prices: [{ priceTierId: 'distributor', price: 50 }] },
      { id: 'pen-taxed', name: 'Urea PEN', taxType: 'GRAVADO', prices: [] },
      { id: 'usd-taxed', name: 'Urea USD', taxType: 'GRAVADO', prices: [] },
    ];
    const costs = {
      'pen-exempt': { currency: 'PEN', sin: 60, con: 60 },
      'pen-taxed': { currency: 'PEN', sin: 84.75, con: 100 },
      'usd-taxed': { currency: 'USD', sin: 15, con: 17.7, exchangeRate: 3.5 },
    };
    const writes = [], errors = [];
    let failSave = false;
    let releaseCatalog = null;
    let catalogGate = null;
    await context.route('**/api/**', async route => {
      const request = route.request(), ep = new URL(request.url()).pathname.replace(/^\/api/, '');
      let data = [];
      if (ep === '/auth/me') data = { id: 'admin', role: 'ADMIN', fullName: 'Prueba', isActive: true };
      else if (ep === '/business-settings') data = {};
      else if (ep === '/products') data = { data: products, total: products.length };
      else if (ep === '/price-tiers') data = [{ id: 'distributor', name: 'Distribuidor', priority: 1 }];
      else if (ep === '/lookup/tipo-cambio') data = { venta: 3.4, fecha: '2026-11-11' };
      else if (ep === '/purchases/price-catalog') {
        if (catalogGate) await catalogGate;
        data = products.map(product => {
          const cost = costs[product.id], usd = cost.currency === 'USD';
          return {
            productId: product.id, productName: product.name, currency: cost.currency,
            taxType: product.taxType, lastPurchaseDate: '2026-11-10', supplierName: 'Proveedor',
            calculation: cost.calculation, precioMinorista: cost.precioMinorista,
            // Same API contract as MongoPurchaseRepository: PEN purchases return no USD prices.
            unitPriceSinIgvPen: usd ? r2(cost.sin * cost.exchangeRate) : cost.sin,
            unitPriceConIgvPen: usd ? r2(cost.con * cost.exchangeRate) : cost.con,
            ...(usd ? { unitPriceSinIgvUsd: cost.sin, unitPriceConIgvUsd: cost.con, exchangeRate: cost.exchangeRate } : {}),
          };
        });
      } else if (ep.startsWith('/purchases/price-catalog/') && request.method() === 'PATCH') {
        const productId = ep.split('/').at(-1), payload = request.postDataJSON();
        writes.push({ productId, payload });
        if (failSave) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Fallo de guardado simulado' }) });
        const cost = costs[productId], usd = cost.currency === 'USD';
        const values = payload.calculation || payload;
        cost.sin = (usd ? values.unitPriceSinIgvUsd : values.unitPriceSinIgvPen) ?? cost.sin;
        cost.con = (usd ? values.unitPriceConIgvUsd : values.unitPriceConIgvPen) ?? cost.con;
        if (payload.calculation) cost.calculation = payload.calculation;
        if (payload.precioMinorista != null) cost.precioMinorista = payload.precioMinorista;
        assert.ok(Number.isFinite(cost.sin) && Number.isFinite(cost.con));
        data = { updated: true };
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const input = (product, field = 'USD s/IGV') => page.getByRole('spinbutton', { name: `${field} de ${product}`, exact: true });
    const rowValues = async product => {
      const row = page.locator('tbody tr').filter({ has: page.getByTitle(product, { exact: true }) });
      return {
        inputs: await row.locator('input').evaluateAll(inputs => inputs.map(input => input.value)),
        tentative: await row.locator('td').nth(7).textContent(),
        billing: await row.locator('td').nth(9).textContent(),
      };
    };
    const waitValue = async (product, value, field = 'USD s/IGV') => {
      await input(product, field).waitFor();
      await page.waitForFunction(({ label, value }) => document.querySelector(`[aria-label="${label}"]`)?.value === value,
        { label: `${field} de ${product}`, value });
    };
    const save = async (product, value) => {
      await input(product).fill(value);
      await input(product).press('Enter');
      await page.getByText('Guardado', { exact: true }).waitFor();
    };
    const reload = async () => { await page.reload(); await input('Humus PEN').waitFor(); };
    await page.goto(`${base}/products?view=catalog`);
    await waitValue('Humus PEN', '17.65');

    // Do not discard the edited value while the saved catalog is still being fetched.
    catalogGate = new Promise(resolve => { releaseCatalog = resolve; });
    await input('Humus PEN').fill('19.95');
    const preview = await rowValues('Humus PEN');
    assert.equal(preview.tentative, '75.97');
    assert.equal(preview.billing, '73.93');
    assert.equal(preview.inputs.at(-1), '50.00');
    await input('Humus PEN').press('Enter');
    await page.getByText('Guardando', { exact: true }).waitFor();
    assert.equal(await input('Humus PEN').inputValue(), '19.95');
    assert.equal(await input('Humus PEN').isDisabled(), true);
    releaseCatalog(); catalogGate = null;
    await page.getByText('Guardado', { exact: true }).waitFor();
    await waitValue('Humus PEN', '19.95');
    assert.deepEqual(writes[0].payload.calculation, {
      unitPriceSinIgvUsd: 19.95, unitPriceSinIgvPen: 67.83, unitPriceConIgvUsd: 19.95, unitPriceConIgvPen: 67.83,
      exchangeRate: 3.4, distributorMargin: 1.12, billingMargin: 1.09, tentativePrice: 75.97, billingPrice: 73.93,
    });
    assert.equal(writes[0].payload.precioMinorista, 50);
    await reload();
    await waitValue('Humus PEN', '19.95');
    await waitValue('Humus PEN', '67.83', 'PEN s/IGV');
    assert.deepEqual(await rowValues('Humus PEN'), preview);
    console.log('PASS complete PEN row survives saving, delayed refetch and reload, including tentative, billing and manual final prices');

    await save('Urea PEN', '10');
    await reload();
    await waitValue('Urea PEN', '10.00');
    await waitValue('Urea PEN', '11.80', 'USD c/IGV');
    await waitValue('Urea PEN', '40.12', 'PEN c/IGV');
    await input('Urea USD').fill('12.34');
    const usdPreview = await rowValues('Urea USD');
    await input('Urea USD').press('Enter');
    await page.getByText('Guardado', { exact: true }).waitFor();
    await reload();
    await waitValue('Urea USD', '12.34');
    await waitValue('Urea USD', '41.96', 'PEN s/IGV');
    assert.deepEqual(await rowValues('Urea USD'), usdPreview);
    assert.equal(costs['usd-taxed'].exchangeRate, 3.5);
    console.log('PASS full USD row uses the catalog rate after reload and preserves the invoice rate');

    // Changing the current rates must not alter rows already saved with other rates.
    await page.getByRole('textbox', { name: 'Tipo de cambio del catálogo', exact: true }).fill('3.6');
    await page.getByRole('textbox', { name: 'Margen tentativo', exact: true }).fill('1.2');
    await page.getByRole('textbox', { name: 'Margen de facturación', exact: true }).fill('1.15');
    await reload();
    assert.deepEqual(await rowValues('Humus PEN'), preview);
    assert.deepEqual(await rowValues('Urea USD'), usdPreview);
    await input('Humus PEN', 'Precio final').fill('65');
    await input('Humus PEN', 'Precio final').press('Enter');
    await page.getByText('Guardado', { exact: true }).waitFor();
    await reload();
    await waitValue('Humus PEN', '65.00', 'Precio final');
    assert.deepEqual(costs['pen-exempt'].calculation, writes[0].payload.calculation);
    console.log('PASS saved rows survive new rates and manual final price overrides the product price');

    failSave = true;
    await input('Humus PEN').fill('22.22');
    await input('Humus PEN').press('Tab');
    await page.getByText('No se pudo guardar', { exact: true }).waitFor();
    assert.equal(await input('Humus PEN').inputValue(), '22.22');
    assert.equal(costs['pen-exempt'].sin, 67.83);
    failSave = false;
    await input('Humus PEN').focus();
    await input('Humus PEN').press('Enter');
    await page.getByText('Guardado', { exact: true }).waitFor();
    await reload();
    await waitValue('Humus PEN', '22.22');
    assert.equal(costs['pen-exempt'].sin, 79.99);
    await waitValue('Humus PEN', '65.00', 'Precio final');
    assert.deepEqual(errors, []);
    console.log('PASS failed save keeps the draft and can be retried');
    await context.close();
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

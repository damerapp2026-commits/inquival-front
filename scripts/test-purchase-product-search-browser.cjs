const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const productId = '000000000000000000000001';
const otherId = '000000000000000000000002';
const unusedId = '000000000000000000000003';
const products = [
  { id: productId, name: 'HUMUS PRUEBA', unit: 'UND' },
  { id: otherId, name: 'ABONO PRUEBA', unit: 'KG' },
  { id: unusedId, name: 'PRODUCTO SIN COMPRAS', unit: 'UND' },
];
const purchases = Array.from({ length: 25 }, (_, index) => ({
  id: String(index + 100).padStart(24, '0'), companyId: 'company',
  supplier: 'Proveedor Alfa', paymentType: 'CONTADO',
  date: '2026-11-01T05:00:00Z', issueDate: '2026-11-01T05:00:00Z',
  totalCost: 350, totalCostUsd: 100, exchangeRate: 3.5,
  documentSeries: 'F001', documentNumber: String(index + 1),
  items: [
    ...(index < 24 ? [
      { productId, quantity: 2, unitCost: 10, lotNumber: 'A' },
      { productId, quantity: 3, unitCost: 10, lotNumber: 'B' },
    ] : []),
    { productId: otherId, quantity: 1, unitCost: 50 },
  ],
}));

async function fixture(browser, mobile = false) {
  const context = await browser.newContext({
    serviceWorkers: 'block', timezoneId: 'America/Lima',
    viewport: { width: mobile ? 390 : 1440, height: 1000 },
  });
  await context.addInitScript(() => localStorage.setItem('token', 'fixture'));
  const reads = [], writes = [], errors = [];
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const ep = url.pathname.replace(/^\/api/, '');
    if (request.method() !== 'GET') {
      writes.push(ep);
      return route.abort();
    }
    let data = [];
    if (ep === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isActive: true, isDefault: true }];
    else if (ep === '/auth/me') data = { id: 'admin', role: 'ADMIN', fullName: 'Prueba', isActive: true };
    else if (ep === '/business-settings') data = {};
    else if (ep === '/companies') data = [{ id: 'company', name: 'Almacén de prueba' }];
    else if (ep === '/products') data = { data: products, total: products.length };
    else if (ep === '/purchases') {
      reads.push(Object.fromEntries(url.searchParams));
      const selected = url.searchParams.get('productId');
      const supplier = url.searchParams.get('supplier') || '';
      const rows = purchases.filter(purchase =>
        (!selected || purchase.items.some(item => item.productId === selected)) &&
        purchase.supplier.toLowerCase().includes(supplier.toLowerCase()));
      const page = Number(url.searchParams.get('page') || 1), limit = Number(url.searchParams.get('limit') || 20);
      data = { data: rows.slice((page - 1) * limit, page * limit), total: rows.length,
        totalPen: 0, totalUsd: rows.length * 100, totalUsdContado: rows.length * 100 };
    } else if (ep.startsWith('/purchases/')) data = purchases.find(purchase => ep === `/purchases/${purchase.id}`);
    else if (ep === '/accounts-payable') data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, reads, writes, errors };
}

async function waitMarks(page, count) {
  await page.waitForFunction(expected => document.querySelectorAll('tbody mark').length === expected, count);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const { context, page, reads, writes, errors } = await fixture(browser);
    await page.goto(`${base}/purchases?page=2&currency=USD`);
    await page.getByRole('button', { name: 'Ver', exact: true }).first().waitFor();
    const search = () => page.getByPlaceholder('Buscar producto por nombre...');
    await search().fill('humus');
    await search().press('Enter');
    await waitMarks(page, 20);
    assert.equal(new URL(page.url()).searchParams.get('page'), null);
    assert.equal(new URL(page.url()).searchParams.get('currency'), 'USD');
    assert.equal(reads.at(-1).productId, productId);
    assert.equal(reads.at(-1).page, '1');
    assert.equal(await page.getByText('Cantidad: 5 UND', { exact: true }).count(), 20);
    assert.equal(await page.getByText('24 compras', { exact: true }).count(), 1);

    const pagination = page.locator('input.w-12');
    await pagination.fill('2');
    await pagination.press('Enter');
    await waitMarks(page, 4);
    assert.equal(new URL(page.url()).searchParams.get('productId'), productId);
    await page.getByRole('button', { name: 'Ver', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Detalle de Compra', exact: true }).waitFor();
    await waitMarks(page, 2);
    assert.equal(await page.getByText('Producto buscado', { exact: true }).count(), 2);
    assert.equal(await page.locator('tr.bg-amber-50').count(), 2);
    assert.equal(await page.locator('tbody tr').count(), 3);
    await page.getByTitle('Volver', { exact: true }).click();
    await waitMarks(page, 4);
    assert.equal(new URL(page.url()).searchParams.get('page'), '2');
    await page.reload();
    await waitMarks(page, 4);

    const downloadReady = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel', exact: true }).click();
    const download = await downloadReady;
    const book = XLSX.readFile(await download.path());
    const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]);
    assert.equal(rows.length, 24);
    assert.ok(rows.every(row => row.Productos.includes('HUMUS PRUEBA x2') && row.Productos.includes('ABONO PRUEBA x1')));
    assert.equal(reads.at(-1).limit, '9999');
    assert.equal(reads.at(-1).productId, productId);
    console.log('PASS search across pages, quantities, detail highlights, back/reload and filtered Excel');

    await page.getByTitle('Quitar', { exact: true }).click();
    await page.getByText('25 compras', { exact: true }).waitFor();
    await waitMarks(page, 0);
    assert.equal(new URL(page.url()).searchParams.get('page'), null);
    assert.equal(new URL(page.url()).searchParams.get('currency'), 'USD');
    await search().fill('SIN COMPRAS');
    await search().press('Enter');
    await page.getByText('No hay datos disponibles', { exact: true }).waitFor();
    await page.getByTitle('Quitar', { exact: true }).click();
    await page.getByText('25 compras', { exact: true }).waitFor();

    // The delayed supplier update must not discard a product selected in the meantime.
    await page.getByPlaceholder('Buscar por proveedor...').fill('Alfa');
    await search().fill('humus');
    await search().press('Enter');
    await page.waitForURL(url => url.searchParams.get('supplier') === 'Alfa');
    await waitMarks(page, 20);
    assert.equal(new URL(page.url()).searchParams.get('productId'), productId);
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    console.log('PASS clear, no purchases, combined supplier debounce and no business writes');
    await context.close();

    const mobile = await fixture(browser, true);
    await mobile.page.goto(`${base}/purchases`);
    await mobile.page.getByPlaceholder('Buscar producto por nombre...').fill('humus');
    await mobile.page.getByRole('button', { name: 'HUMUS PRUEBA UND', exact: true }).click();
    await waitMarks(mobile.page, 20);
    const chip = await mobile.page.getByTitle('Quitar', { exact: true }).boundingBox();
    assert.ok(chip && chip.x >= 0 && chip.x + chip.width <= 390);
    assert.deepEqual(mobile.errors, []);
    assert.deepEqual(mobile.writes, []);
    console.log('PASS product selection on mobile');
    await mobile.context.close();
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

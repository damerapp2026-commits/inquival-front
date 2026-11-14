const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtemp, rm } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

async function setup(browser, base, loanType) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'America/Lima', viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'fixture'));
  const incoming = loanType === 'INCOMING';
  let quantity = incoming ? 110 : 90;
  const loan = { id: 'loan', loanType, borrowerName: 'Tienda prueba', status: 'ACTIVE', date: '2026-11-13T05:00:00Z', returns: [], items: [{ productId: 'product', companyId: 'warehouse', quantity: 4, returnedQuantity: 0 }, { productId: 'product', companyId: 'warehouse-b', quantity: 6, returnedQuantity: 0 }] };
  const movements = [{ id: 'creation', productId: 'product', companyId: 'warehouse', movementType: incoming ? 'LOAN_IN' : 'LOAN_OUT', quantity: 10, previousStock: 100, newStock: quantity, date: '2026-11-13T05:00:00Z', description: 'Préstamo prueba', referenceId: loan.id, referenceType: 'Loan' }];
  const errors = [], writes = [];
  let kardexReads = 0;
  await context.route('**/api/**', async route => {
    const request = route.request(), endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
    let data = [];
    if (request.method() !== 'GET') {
      assert.equal(request.method(), 'POST');
      assert.equal(endpoint, '/loans/loan/returns');
      const body = request.postDataJSON(); writes.push(body);
      assert.deepEqual(body.items, [{ productId: 'product', quantity: 3 }]);
      const previousStock = quantity;
      quantity += incoming ? -3 : 3;
      loan.status = 'PARTIAL'; loan.items[0].returnedQuantity = 3;
      loan.returns.push({ items: body.items, date: '2026-11-13T18:00:00Z' });
      movements.push({ id: 'return', productId: 'product', companyId: 'warehouse', movementType: incoming ? 'LOAN_RETURN_OUT' : 'LOAN_RETURN', quantity: 3, previousStock, newStock: quantity, date: '2026-11-13T18:00:00Z',
        description: incoming ? 'Devolución a Tienda prueba: Producto prueba x3' : 'Devolución préstamo: Producto prueba x3',
        ...(!incoming ? { displayDescription: 'Devolución de Tienda prueba: Producto prueba x3' } : {}), referenceId: loan.id, referenceType: 'Loan' });
      data = loan;
    } else if (endpoint === '/auth/me') data = { id: 'operator', role: 'ADMIN', fullName: 'Prueba', isActive: true };
    else if (endpoint === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isActive: true, isDefault: true }];
    else if (endpoint === '/business-settings') data = {};
    else if (endpoint === '/companies') data = [{ id: 'warehouse', name: 'Almacén' }];
    else if (endpoint === '/products') data = { data: [{ id: 'product', name: 'Producto prueba', unit: 'UND', prices: [], isActive: true }], total: 1 };
    else if (endpoint === '/products/product') data = { id: 'product', name: 'Producto prueba', unit: 'UND', prices: [], isActive: true };
    else if (endpoint === '/loans') data = { data: [loan], total: 1 };
    else if (endpoint === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (endpoint === '/stock/by-product') data = [{ productId: 'product', totalQuantity: quantity, byCompany: [{ companyId: 'warehouse', quantity }] }];
    else if (endpoint === '/stock-movements') { kardexReads++; data = { data: movements, total: movements.length }; }
    else if (['/sales', '/clients', '/credits'].includes(endpoint)) data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/kardex?productId=product`);
  return { page, context, writes, errors, quantity: () => quantity, kardexReads: () => kardexReads };
}

async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-loan-kardex-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    for (const loanType of ['OUTGOING', 'INCOMING']) {
      const f = await setup(browser, base, loanType), { page } = f;
      await page.getByText('Préstamo prueba', { exact: true }).waitFor();
      const originalReads = f.kardexReads();
      await page.getByRole('link', { name: 'Ventas', exact: true }).first().click();
      await page.getByRole('button', { name: 'Préstamos', exact: true }).click();
      await page.getByRole('button', { name: 'Devolver', exact: true }).click();
      const returnForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Confirmar Devolución', exact: true }) });
      assert.equal(await returnForm.getByRole('combobox').count(), 0);
      assert.equal(await returnForm.getByText('Almacén', { exact: true }).count(), 0);
      assert.equal(await returnForm.getByRole('spinbutton').count(), 1);
      await page.getByPlaceholder('Cantidad a devolver (máx 10)', { exact: true }).fill('3');
      await page.getByRole('button', { name: 'Confirmar Devolución', exact: true }).click();
      await page.getByText('Devolución registrada', { exact: true }).waitFor();
      assert.equal(f.writes.length, 1);
      // SPA navigation deliberately preserves the five-minute query cache.
      await page.getByRole('link', { name: 'Kardex', exact: true }).first().click();
      const productRow = page.locator('tr').filter({ has: page.getByText('Producto prueba', { exact: true }) });
      await productRow.getByText(String(f.quantity()), { exact: true }).waitFor();
      await page.getByText('Producto prueba', { exact: true }).click();
      const description = `Devolución ${loanType === 'INCOMING' ? 'a' : 'de'} Tienda prueba: Producto prueba x3`;
      const returnRow = page.locator('tr').filter({ hasText: description });
      await returnRow.waitFor();
      const cells = returnRow.locator('td');
      assert.equal(await cells.nth(2).innerText(), loanType === 'OUTGOING' ? '3' : '');
      assert.equal(await cells.nth(3).innerText(), loanType === 'INCOMING' ? '3' : '');
      assert.equal(await cells.nth(4).innerText(), String(f.quantity()));
      assert.ok(f.kardexReads() > originalReads);
      await page.getByRole('link', { name: 'Ventas', exact: true }).first().click();
      await page.getByRole('button', { name: 'Préstamos', exact: true }).click();
      await page.getByRole('button', { name: 'Ver', exact: true }).click();
      await page.getByText(`${loanType === 'INCOMING' ? 'A' : 'De'} la tienda: Tienda prueba`, { exact: true }).waitFor();
      assert.equal(await page.getByRole('columnheader', { name: 'Almacén', exact: true }).count(), 0);
      // Both alternate kardex views must also show stores on historical returns.
      await page.goto(`${base}/kardex?tab=movimientos`);
      await page.getByText(description, { exact: true }).waitFor();
      await page.goto(`${base}/kardex/product/product`);
      await page.getByText(description, { exact: true }).waitFor();
      assert.deepEqual(f.errors, []);
      await f.context.close();
      process.stdout.write(`PASS ${loanType}: return refreshes stock/kardex and names the store in all kardex views and the return history\n`);
    }
  } finally {
    await browser?.close(); await server.close(); await rm(cacheDir, { recursive: true, force: true });
  }
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });

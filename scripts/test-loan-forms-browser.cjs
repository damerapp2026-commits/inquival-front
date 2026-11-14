const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtemp, rm } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

async function setup(browser, base, mobile) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'America/Lima', viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'fixture'));
  let loan, quantity = 30, failCreate = true, failReturn = true;
  const errors = [], writes = [];
  await context.route('**/api/**', async route => {
    const request = route.request(), endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
    let data = [];
    if (request.method() !== 'GET') {
      assert.equal(request.method(), 'POST');
      assert.ok(['/loans', '/loans/form-loan/returns'].includes(endpoint));
      const body = request.postDataJSON(); writes.push({ endpoint, body });
      assert.deepEqual(body.items, [{ productId: 'product', quantity: 5 }]);
      const fail = endpoint === '/loans' ? failCreate : failReturn;
      if (fail) {
        if (endpoint === '/loans') failCreate = false; else failReturn = false;
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, message: ['Error interno del servidor'], timestamp: new Date().toISOString() }) });
      }
      if (endpoint === '/loans') {
        quantity += body.loanType === 'INCOMING' ? 5 : -5;
        loan = { ...body, id: 'form-loan', status: 'ACTIVE', date: '2026-11-13T05:00:00Z', returns: [],
          items: [{ productId: 'product', companyId: 'warehouse', quantity: 2, returnedQuantity: 0 }, { productId: 'product', companyId: 'warehouse-b', quantity: 3, returnedQuantity: 0 }] };
      } else {
        quantity += loan.loanType === 'INCOMING' ? -5 : 5;
        loan.status = 'RETURNED';
        loan.items.forEach(item => { item.returnedQuantity = item.quantity; });
        loan.returns.push({ items: loan.items, date: '2026-11-13T18:00:00Z' });
      }
      data = loan;
    } else if (endpoint === '/auth/me') data = { id: 'operator', role: 'ADMIN', fullName: 'Prueba', isActive: true };
    else if (endpoint === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isActive: true, isDefault: true }];
    else if (endpoint === '/business-settings') data = {};
    else if (endpoint === '/companies') data = [{ id: 'warehouse', name: 'Almacén A', isActive: true }, { id: 'warehouse-b', name: 'Almacén B', isActive: true }];
    else if (endpoint === '/products') data = { data: [{ id: 'product', name: 'Producto prueba', unit: 'UND', prices: [], isActive: true }], total: 1 };
    else if (endpoint === '/loans') data = { data: loan ? [loan] : [], total: loan ? 1 : 0 };
    else if (endpoint === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (endpoint === '/stock/by-product') data = [{ productId: 'product', totalQuantity: quantity, byCompany: [{ companyId: 'warehouse', quantity }] }];
    else if (['/sales', '/clients', '/credits'].includes(endpoint) || endpoint.startsWith('/stock/company/')) data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/sales`);
  return { page, context, writes, errors, quantity: () => quantity };
}

async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-loan-forms-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    for (const mobile of [false, true]) for (const loanType of ['INCOMING', 'OUTGOING']) {
      const f = await setup(browser, base, mobile), { page } = f;
      await page.getByRole('button', { name: 'Préstamo', exact: true }).click();
      const createForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Registrar Préstamo', exact: true }) });
      assert.equal(await createForm.getByRole('combobox').count(), 0);
      assert.equal(await createForm.getByText('Almacén', { exact: true }).count(), 0);
      if (loanType === 'INCOMING') await createForm.getByRole('button', { name: /Pedimos a otra tienda/ }).click();
      await createForm.getByPlaceholder('Ej: Tienda Don Juan, Ferretería El Sol...').fill('Tienda formulario');
      await createForm.getByPlaceholder('Buscar producto...', { exact: true }).fill('Producto');
      await page.getByRole('button', { name: 'Producto prueba', exact: true }).click();
      await createForm.getByRole('spinbutton').fill('5');
      await createForm.getByRole('button', { name: 'Registrar Préstamo', exact: true }).click();
      await page.getByText('Error interno del servidor', { exact: true }).last().waitFor();
      assert.equal(await createForm.getByRole('spinbutton').inputValue(), '5');
      assert.equal(await createForm.getByPlaceholder('Buscar producto...', { exact: true }).inputValue(), 'Producto prueba');
      await createForm.getByRole('button', { name: 'Registrar Préstamo', exact: true }).click();
      await page.getByRole('heading', { name: 'Nuevo Préstamo', exact: true }).waitFor({ state: 'hidden' });
      assert.equal(f.quantity(), loanType === 'INCOMING' ? 35 : 25);
      assert.equal(f.writes[1].body.loanType, loanType);
      await page.getByRole('button', { name: 'Préstamos', exact: true }).click();
      await page.getByText('Producto prueba x5', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Ver', exact: true }).click();
      assert.equal(await page.getByRole('columnheader', { name: 'Almacén', exact: true }).count(), 0);
      const detailRows = page.locator('tbody tr').filter({ has: page.getByText('Producto prueba', { exact: true }) });
      assert.equal(await detailRows.count(), 1);
      await page.getByRole('button', { name: loanType === 'INCOMING' ? 'Devolver a Tienda formulario' : 'Registrar Devolución', exact: true }).click();
      const returnForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Confirmar Devolución', exact: true }) });
      assert.equal(await returnForm.getByRole('combobox').count(), 0);
      assert.equal(await returnForm.getByRole('spinbutton').count(), 1);
      assert.equal(await returnForm.getByText('Almacén A', { exact: true }).count(), 0);
      await returnForm.getByPlaceholder('Cantidad a devolver (máx 5)', { exact: true }).fill('5');
      await returnForm.getByRole('button', { name: 'Confirmar Devolución', exact: true }).click();
      await page.getByText('Error interno del servidor', { exact: true }).last().waitFor();
      assert.equal(await returnForm.getByRole('spinbutton').inputValue(), '5');
      await returnForm.getByRole('button', { name: 'Confirmar Devolución', exact: true }).click();
      await page.getByText('Devolución registrada', { exact: true }).waitFor();
      assert.equal(f.quantity(), 30);
      assert.equal(f.writes.length, 4);
      assert.deepEqual(f.errors, []);
      await f.context.close();
      process.stdout.write(`PASS ${mobile ? 'mobile' : 'desktop'} ${loanType}: product-only creation/detail/return, grouped quantities and retry after a 500\n`);
    }
  } finally {
    await browser?.close(); await server.close(); await rm(cacheDir, { recursive: true, force: true });
  }
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });

const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);

const paidAccounts = Array.from({ length: 25 }, (_, i) => ({
  id: `paid-${i}`, purchaseId: `purchase-${i}`, purchaseRef: `F001-${String(i + 1).padStart(3, '0')}`,
  supplier: `Proveedor pagado ${String(i + 1).padStart(2, '0')}`,
  currency: i % 2 === 0 ? 'USD' : 'PEN',
  totalAmount: 100, paidAmount: 100, pendingAmount: 0, status: 'PAID',
  paymentScheduleType: 'SINGLE_DATE', dueDate: '2026-11-11', installments: [],
  createdAt: '2025-01-01T00:00:00Z',
  payments: [
    { id: 'payment-2', amount: 60, paymentDate: '2026-11-11T00:00:00Z', codigoTransferencia: 'OP-002', registeredByName: 'Administrador' },
    { id: 'payment-1', amount: 40, paymentDate: '2026-10-30T00:00:00Z', codigoTransferencia: 'OP-001' },
  ],
}));
paidAccounts[24].payments = [];

async function fixture(browser, mobile = false) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Tokyo', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'fixture'));
  const reads = [], writes = [], errors = [];
  const state = { fail: false };
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), ep = url.pathname.replace(/^\/api/, '');
    if (request.method() !== 'GET') { writes.push(ep); return route.abort(); }
    let data = [];
    if (ep === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isActive: true, isDefault: true }];
    else if (ep === '/auth/me') data = { id: 'admin', role: 'ADMIN', fullName: 'Prueba', isActive: true };
    else if (ep === '/business-settings') data = {};
    else if (ep === '/accounts-payable') {
      const query = Object.fromEntries(url.searchParams); reads.push(query);
      if (query.status === 'PAID') {
        if (state.fail) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Fallo simulado' }) });
        const filtered = paidAccounts.filter(ap => (!query.currency || ap.currency === query.currency) && (!query.supplier || ap.supplier.toLowerCase().includes(query.supplier.toLowerCase())));
        const page = Number(query.page || 1), limit = Number(query.limit || 20);
        data = { data: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
      } else {
        // The calendar's legacy 500-record request does not contain the older paid history.
        data = { data: [{ ...paidAccounts[0], id: 'pending', supplier: 'Proveedor pendiente', status: 'PENDING', paidAmount: 0, pendingAmount: 100, dueDate: '2026-11-20', payments: [] }], total: 550 };
      }
    } else if (ep.startsWith('/accounts-payable/paid-')) data = paidAccounts.find(ap => ep === `/accounts-payable/${ap.id}`);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, reads, writes, errors, state };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const f = await fixture(browser), { page } = f;
    await page.goto(`${base}/accounts-payable?date=2026-11-11`);
    await page.getByRole('button', { name: 'Pagadas', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Cuentas pagadas', exact: true });
    await panel.getByText('25 cuentas pagadas', { exact: true }).waitFor();
    assert.equal(await panel.getByRole('listitem').count(), 20);
    assert.equal(await panel.getByText('Proveedor pendiente', { exact: true }).count(), 0);
    assert.equal(await panel.getByText('11/11/2026', { exact: true }).count(), 20);
    assert.equal(new URL(page.url()).searchParams.get('date'), '2026-11-11');
    assert.equal(new URL(page.url()).searchParams.get('tab'), 'paid');
    assert.equal(f.reads.at(-1).status, 'PAID');
    await panel.getByRole('button', { name: 'Página siguiente de cuentas pagadas' }).click();
    await panel.getByText('Página 2 de 2', { exact: true }).waitFor();
    assert.equal(await panel.getByRole('listitem').count(), 5);
    await panel.getByText('Sin fecha registrada', { exact: true }).waitFor();
    assert.equal(f.reads.at(-1).page, '2');

    await page.getByRole('button', { name: '$ Dólares', exact: true }).click();
    await panel.getByText('13 cuentas pagadas', { exact: true }).waitFor();
    assert.equal(f.reads.at(-1).page, '1');
    assert.equal(f.reads.at(-1).currency, 'USD');
    assert.equal(await panel.getByRole('listitem').count(), 13);
    const search = page.getByPlaceholder('Buscar proveedor / laboratorio...');
    await search.fill('pagado 01');
    await panel.getByText('1 cuenta pagada', { exact: true }).waitFor();
    await panel.getByRole('button', { name: 'Ver historial de Proveedor pagado 01, F001-001', exact: true }).click();
    const heading = page.getByRole('heading', { name: 'Detalle - Cuenta por Pagar', exact: true });
    await page.getByRole('heading', { name: 'Historial de Pagos (2)', exact: true }).waitFor();
    await page.getByText('Cód: OP-002', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Confirmar Pago', exact: true }).count(), 0);
    await heading.locator('..').getByRole('button').click();
    await search.fill('inexistente');
    await panel.getByText('No hay cuentas pagadas que coincidan con estos filtros.', { exact: true }).waitFor();
    await page.reload();
    await panel.getByText('25 cuentas pagadas', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Pagadas', exact: true }).getAttribute('aria-current'), 'page');
    console.log('PASS paid history, paging, combined filters, payment dates, detail and reload');

    await page.getByRole('button', { name: 'Acuerdos de Pago', exact: true }).click();
    await page.getByRole('button', { name: 'Nuevo Acuerdo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Calendario', exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get('tab'), null);
    assert.equal(new URL(page.url()).searchParams.get('date'), '2026-11-11');
    f.state.fail = true;
    await page.goto(`${base}/accounts-payable?tab=paid`);
    await panel.getByText('No se pudieron cargar las cuentas pagadas.', { exact: true }).waitFor();
    f.state.fail = false;
    await panel.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await panel.getByText('25 cuentas pagadas', { exact: true }).waitFor();
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.errors, []);
    console.log('PASS existing tabs, retry and read-only browsing');
    await f.context.close();

    const mobile = await fixture(browser, true);
    await mobile.page.goto(`${base}/accounts-payable?tab=paid`);
    await mobile.page.getByText('25 cuentas pagadas', { exact: true }).waitFor();
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const box = await mobile.page.getByRole('button', { name: 'Pagadas', exact: true }).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 390);
    assert.deepEqual(mobile.errors, []);
    assert.deepEqual(mobile.writes, []);
    console.log('PASS mobile paid tab without horizontal overflow');
    await mobile.context.close();
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

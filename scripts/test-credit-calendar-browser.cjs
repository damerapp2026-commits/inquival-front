const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5191';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);

const clients = [
  { id: 'ana', name: 'Ana Agricultora', documentNumber: '12345678', isActive: true },
  { id: 'bruno', name: 'Bruno Distribuidor', documentNumber: '87654321', isActive: true },
  { id: 'celia', name: 'Celia Sin Fecha', documentNumber: '11111111', isActive: true },
];
const makeCredit = (id, clientId, dueDate, pendingAmount, currency = 'PEN', status = 'PENDING') => ({
  id, clientId, name: id, dueDate, pendingAmount, currency, status,
  totalAmount: 200, paidAmount: status === 'PARTIAL' ? 200 - pendingAmount : 0,
  createdAt: '2026-01-01T00:00:00Z', payments: [], saleIds: [], saleDetails: [],
});
const credits = [
  makeCredit('Crédito vencido', 'ana', '2026-11-10T00:00:00Z', 60, 'PEN', 'PARTIAL'),
  makeCredit('Crédito de hoy', 'ana', '2026-11-12T05:00:00Z', 120, 'PEN', 'PARTIAL'),
  makeCredit('Crédito dólares', 'bruno', '2026-11-12', 30, 'USD'),
  makeCredit('Crédito próximo', 'bruno', '2026-11-19T00:00:00Z', 50, 'USD'),
  makeCredit('Crédito futuro', 'ana', '2026-11-25', 500),
  makeCredit('Crédito diciembre', 'ana', '2026-12-02', 88),
  makeCredit('Crédito sin fecha', 'celia', undefined, 90),
  makeCredit('Crédito pagado', 'ana', '2026-11-12', 0, 'PEN', 'PAID'),
  makeCredit('Crédito sin saldo', 'ana', '2026-11-12', 0, 'PEN', 'PARTIAL'),
  ...Array.from({ length: 12 }, (_, i) => makeCredit(`Crédito lote ${i + 1}`, 'bruno', '2026-11-15', 10)),
];

async function expectRowCount(panel, count) {
  const rows = panel.getByRole('listitem');
  if (count) await rows.nth(count - 1).waitFor();
  await rows.nth(count).waitFor({ state: 'detached' });
  assert.equal(await rows.count(), count);
}

async function fixture(browser, mobile = false) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Tokyo', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'calendar-fixture'));
  const writes = [], errors = [], state = { fail: false };
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), ep = url.pathname.replace(/^\/api/, '');
    if (request.method() !== 'GET') { writes.push(ep); return route.abort(); }
    let data = [];
    if (ep === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isActive: true, isDefault: true }];
    else if (ep === '/auth/me') data = { id: 'admin', role: 'ADMIN', fullName: 'Prueba', isActive: true };
    else if (ep === '/business-settings') data = {};
    else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (ep === '/clients') data = { data: clients, total: clients.length };
    else if (ep === '/credits') {
      if (state.fail) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Fallo simulado' }) });
      const status = url.searchParams.get('status');
      const filtered = credits.filter(credit => !status || credit.status === status);
      data = { data: filtered, total: filtered.length };
    } else if (ep.startsWith('/credits/')) data = credits.find(credit => ep === `/credits/${encodeURIComponent(credit.id)}` || decodeURIComponent(ep) === `/credits/${credit.id}`);
    else if (['/sales', '/loans', '/products', '/quotes', '/cash-register', '/stock/lots/expiring'].includes(ep)) data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-11-12T15:00:00Z') });
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, writes, errors, state };
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  try {
    const f = await fixture(browser), { page } = f;
    await page.goto(`${base}/clients?tab=creditos&keep=1`);
    await page.getByRole('button', { name: 'Calendario de cobros', exact: true }).click();
    const calendar = page.getByRole('region', { name: 'Calendario de cobros', exact: true });
    await calendar.getByRole('heading', { name: 'noviembre de 2026', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('tab'), 'creditos');
    assert.equal(new URL(page.url()).searchParams.get('keep'), '1');
    await calendar.getByRole('group', { name: 'Vencido', exact: true }).getByText('S/ 60.00', { exact: true }).waitFor();
    await calendar.getByRole('group', { name: 'Vence hoy', exact: true }).getByText('$ 30.00', { exact: true }).waitFor();
    await calendar.getByRole('group', { name: 'Vence hoy', exact: true }).getByText('S/ 120.00', { exact: true }).waitFor();
    await calendar.getByRole('group', { name: 'Próximos 7 días', exact: true }).getByText('$ 50.00', { exact: true }).waitFor();
    await calendar.getByRole('group', { name: 'Próximos 7 días', exact: true }).getByText('S/ 120.00', { exact: true }).waitFor();

    await calendar.getByRole('button', { name: '12 de noviembre de 2026: 2 créditos por cobrar', exact: true }).click();
    const panel = calendar.getByRole('region', { name: 'Vencimientos de créditos', exact: true });
    await expectRowCount(panel, 2);
    assert.equal(await panel.getByText('Crédito pagado', { exact: true }).count(), 0);
    assert.equal(await panel.getByText('Crédito sin saldo', { exact: true }).count(), 0);
    await panel.getByRole('button', { name: 'Ver detalle de Crédito de hoy de Ana Agricultora', exact: true }).click();
    const detail = page.getByRole('heading', { name: 'Detalle de la cuenta', exact: true });
    await detail.waitFor();
    await detail.locator('..').getByRole('button').click();
    await page.reload();
    await calendar.getByRole('button', { name: '12 de noviembre de 2026: 2 créditos por cobrar', exact: true }).waitFor();
    assert.equal(await calendar.getByRole('button', { name: '12 de noviembre de 2026: 2 créditos por cobrar', exact: true }).getAttribute('aria-pressed'), 'true');
    console.log('PASS due dates, partial balances, currency totals, detail and reload');

    await page.getByRole('group', { name: 'Moneda de créditos', exact: true }).getByRole('button', { name: '$ Dólares', exact: true }).click();
    await panel.getByText('Crédito dólares', { exact: true }).waitFor();
    await expectRowCount(panel, 1);
    await page.getByPlaceholder('Buscar cliente...').fill('Ana');
    await panel.getByText('No hay créditos por cobrar para este día.', { exact: true }).waitFor();
    await page.getByRole('group', { name: 'Moneda de créditos', exact: true }).getByRole('button', { name: 'Todas', exact: true }).click();
    await panel.getByText('Crédito de hoy', { exact: true }).waitFor();
    await expectRowCount(panel, 1);
    await page.getByPlaceholder('Buscar cliente...').fill('');
    await panel.getByText('Crédito dólares', { exact: true }).waitFor();
    await page.getByLabel('Estado del crédito', { exact: true }).selectOption('PARTIAL');
    await panel.getByText('Crédito de hoy', { exact: true }).waitFor();
    await expectRowCount(panel, 1);
    await page.getByLabel('Estado del crédito', { exact: true }).selectOption('');
    await panel.getByText('Crédito dólares', { exact: true }).waitFor();

    await calendar.getByRole('button', { name: '15 de noviembre de 2026: 12 créditos por cobrar', exact: true }).click();
    await expectRowCount(panel, 10);
    await panel.getByRole('textbox').fill('2');
    await panel.getByRole('textbox').press('Enter');
    await expectRowCount(panel, 2);
    await calendar.getByText('Sin fecha de vencimiento (1)', { exact: true }).click();
    await calendar.getByText('Crédito sin fecha', { exact: true }).waitFor();
    await calendar.getByRole('button', { name: 'Mes siguiente de cobros', exact: true }).click();
    await panel.getByText('Crédito diciembre', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('creditDate'), null);
    await expectRowCount(panel, 1);
    await calendar.getByRole('button', { name: 'Mes siguiente de cobros', exact: true }).click();
    await calendar.getByRole('heading', { name: 'enero de 2027', exact: true }).waitFor();
    await panel.getByText('No hay créditos por cobrar con vencimiento en este mes.', { exact: true }).waitFor();
    await calendar.getByRole('button', { name: 'Ir a hoy', exact: true }).click();
    await panel.getByText('Crédito de hoy', { exact: true }).waitFor();
    console.log('PASS combined filters, day pagination, undated credits, months and year boundary');

    await page.getByRole('button', { name: 'Listado', exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get('tab'), 'creditos');
    await page.getByLabel('Estado del crédito', { exact: true }).selectOption('PAID');
    await page.getByText('Ana Agricultora', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Calendario de cobros', exact: true }).click();
    await calendar.getByRole('group', { name: 'Vence hoy', exact: true }).getByText('S/ 120.00', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Estado del crédito', { exact: true }).inputValue(), '');
    await page.goto(`${base}/credits?creditView=calendar`);
    await page.getByRole('heading', { name: 'Cuentas por Cobrar', exact: true }).waitFor();
    await calendar.getByRole('heading', { name: 'noviembre de 2026', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Cuentas por Cobrar', exact: true }).first().waitFor();
    await page.goto(`${base}/sales?tab=creditos&creditView=calendar`);
    await calendar.getByRole('heading', { name: 'noviembre de 2026', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('tab'), 'creditos');
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.errors, []);
    console.log('PASS shared client, sales and finance access, existing list and read-only calendar');
    await f.context.close();

    const mobile = await fixture(browser, true);
    await mobile.page.goto(`${base}/clients?tab=creditos&creditView=calendar`);
    await mobile.page.getByRole('region', { name: 'Calendario de cobros', exact: true }).waitFor();
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile layout must not overflow');
    const box = await mobile.page.getByRole('button', { name: 'Calendario de cobros', exact: true }).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 390);
    assert.deepEqual(mobile.errors, []);
    assert.deepEqual(mobile.writes, []);
    await mobile.context.close();
    console.log('PASS mobile calendar');

    const retry = await fixture(browser);
    retry.state.fail = true;
    await retry.page.goto(`${base}/credits?creditView=calendar`);
    await retry.page.getByRole('alert').getByText('No se pudieron cargar los créditos o los clientes.', { exact: true }).waitFor();
    retry.state.fail = false;
    await retry.page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await retry.page.getByRole('region', { name: 'Calendario de cobros', exact: true }).waitFor();
    assert.deepEqual(retry.writes, []);
    assert.deepEqual(retry.errors, []);
    await retry.context.close();
    console.log('PASS failed requests and retry');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

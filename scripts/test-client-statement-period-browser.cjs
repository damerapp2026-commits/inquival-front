const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { client, sales, credits } = require('./fixtures/client-statement.cjs');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5191';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
// Put the October accounts past the first page, as happens with a long record.
const accounts = [
  ...Array.from({ length: 201 }, (_, index) => ({ ...credits[1], id: `older-${index}`, name: `Cuenta antigua ${index}`, createdAt: '2025-01-01', saleIds: [], payments: [] })),
  ...credits,
];
const output = process.env.STATEMENT_TEST_OUTPUT || path.join(os.tmpdir(), 'inquival-statement-period-pdfs');

async function fixture(browser, mobile = false) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Tokyo', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'statement-fixture'));
  const writes = [], errors = [], pages = [], state = { fail: false };
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), ep = url.pathname.replace(/^\/api/, '');
    if (request.method() !== 'GET') { writes.push(ep); return route.abort(); }
    let data = [];
    if (ep === '/auth/me') data = { id: 'admin', role: 'ADMIN', fullName: 'Prueba', isActive: true };
    else if (ep === '/business-settings') data = {};
    else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (ep === '/clients') data = { data: [client], total: 1 };
    else if (ep === `/credits/client/${client.id}` || ep === '/sales') {
      if (state.fail) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Fallo simulado' }) });
      const rows = ep === '/sales' ? sales : accounts;
      const page = Number(url.searchParams.get('page') || 1), limit = Number(url.searchParams.get('limit') || 200);
      pages.push({ ep, page, limit });
      data = { data: rows.slice((page - 1) * limit, page * limit), total: rows.length };
    } else if (['/credits', '/loans', '/products', '/quotes', '/cash-register', '/stock/lots/expiring'].includes(ep)) data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-11-12T15:00:00Z') });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/clients`);
  return { context, page, writes, errors, pages, state };
}

async function open(page, format = 'Resumen de cuenta') {
  await page.getByTitle('Descargar estado de cuenta', { exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${format}`) }).click();
  return page.getByRole('heading', { name: format === 'Detallado' ? `Detalle de cuenta — ${client.name}` : 'Exportar estado de cuenta', exact: true }).locator('../..');
}
async function setPeriod(modal, from, to) {
  await modal.getByLabel('Periodo', { exact: true }).selectOption('custom');
  await modal.getByLabel('Desde', { exact: true }).fill(from);
  await modal.getByLabel('Hasta', { exact: true }).fill(to);
}
async function close(modal) { await modal.getByRole('heading').locator('..').getByRole('button').click(); }
async function download(page, button, filename) {
  const waiting = page.waitForEvent('download');
  await button.click();
  const file = await waiting;
  assert.match(file.suggestedFilename(), /\.pdf$/);
  await file.saveAs(path.join(output, filename));
  assert.ok((await fs.stat(path.join(output, filename))).size > 1000);
  return file.suggestedFilename();
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  try {
    const f = await fixture(browser), { page } = f;
    let modal = await open(page);
    await modal.getByRole('status').getByText('Se exportarán 204 de 204 cuentas del periodo.', { exact: true }).waitFor();
    assert.ok(f.pages.some(request => request.ep.includes('/credits/client/') && request.page === 2));
    await setPeriod(modal, '2026-10-01', '2026-10-31');
    await modal.getByText('Se exportarán 2 de 2 cuentas del periodo.', { exact: true }).waitFor();
    await modal.getByLabel('Elegir cuentas específicas', { exact: true }).check();
    await modal.getByRole('button', { name: 'Quitar todas', exact: true }).click();
    assert.ok(await modal.getByRole('button', { name: 'Descargar PDF', exact: true }).isDisabled());
    await modal.getByRole('checkbox', { name: /^Incluir Campaña de noviembre del/ }).check();
    await modal.getByText('Se exportarán 1 de 2 cuentas del periodo.', { exact: true }).waitFor();
    const filename = await download(page, modal.getByRole('button', { name: 'Descargar PDF', exact: true }), 'october-summary.pdf');
    assert.match(filename, /2026-10-01_al_2026-10-31/);
    console.log('PASS pagination, custom period, empty selection guard and summary PDF');

    modal = await open(page, 'Detallado');
    assert.equal(await modal.getByLabel('Desde', { exact: true }).inputValue(), '2026-10-01');
    await modal.getByText('Se exportarán 1 de 2 cuentas del periodo.', { exact: true }).waitFor();
    await modal.getByText('NV-000127', { exact: true }).waitFor();
    assert.equal(await modal.getByText('NV-000143', { exact: true }).count(), 0);
    assert.equal(await modal.getByText('NV-000138', { exact: true }).count(), 0);
    await download(page, modal.getByRole('button', { name: 'Exportar PDF', exact: true }), 'october-detail.pdf');
    await setPeriod(modal, '2026-11-01', '2026-11-30');
    await modal.getByText('Se exportarán 0 de 1 cuentas del periodo.', { exact: true }).waitFor();
    assert.ok(await modal.getByRole('button', { name: 'Exportar PDF', exact: true }).isDisabled());
    await modal.getByRole('checkbox', { name: /^Incluir Compra en dólares del/ }).check();
    await modal.getByText('NV-000143', { exact: true }).waitFor();
    await modal.getByText('$ 400.00', { exact: true }).first().waitFor();
    await download(page, modal.getByRole('button', { name: 'Exportar PDF', exact: true }), 'november-usd-detail.pdf');
    console.log('PASS criteria persist between formats, selected sales only, current balances and USD detail');

    await setPeriod(modal, '2027-01-01', '2027-01-31');
    assert.ok(await modal.getByRole('button', { name: 'Exportar PDF', exact: true }).isDisabled());
    await modal.getByLabel('Hasta', { exact: true }).fill('2026-01-01');
    await modal.getByRole('alert').waitFor();
    assert.ok(await modal.getByRole('button', { name: 'Exportar PDF', exact: true }).isDisabled());
    await modal.getByLabel('Periodo', { exact: true }).selectOption('all');
    await modal.getByLabel('Elegir cuentas específicas', { exact: true }).uncheck();
    await modal.getByText('Se exportarán 204 de 204 cuentas del periodo.', { exact: true }).waitFor();
    await modal.getByText('NV-000138', { exact: true }).waitFor();
    await modal.getByText('NV-000140', { exact: true }).waitFor();
    assert.deepEqual(f.errors, []);
    assert.deepEqual(f.writes, []);
    await f.context.close();
    console.log('PASS invalid/empty periods, original full history and read-only export');

    const mobile = await fixture(browser, true);
    modal = await open(mobile.page);
    await setPeriod(modal, '2026-10-01', '2026-10-31');
    await modal.getByLabel('Elegir cuentas específicas', { exact: true }).check();
    await modal.getByRole('checkbox', { name: /^Incluir Campaña de noviembre del/ }).waitFor();
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const box = await modal.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 390);
    assert.deepEqual(mobile.errors, []);
    assert.deepEqual(mobile.writes, []);
    await mobile.context.close();
    console.log('PASS mobile period and account selector');

    const retry = await fixture(browser);
    retry.state.fail = true;
    modal = await open(retry.page);
    await modal.getByRole('alert').waitFor();
    assert.ok(await modal.getByRole('button', { name: 'Descargar PDF', exact: true }).isDisabled());
    retry.state.fail = false;
    await modal.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await modal.getByText('Se exportarán 204 de 204 cuentas del periodo.', { exact: true }).waitFor();
    assert.deepEqual(retry.errors, []);
    assert.deepEqual(retry.writes, []);
    await retry.context.close();
    console.log('PASS load failure prevents partial export and supports retry');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtemp, mkdir, rm } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const client = { id: 'selector-client', name: 'Cliente prueba selección', isActive: true };
const accounts = [
  { id: 'one', date: '2024-06-20', note: 'NI01-00003439', total: 1228, paid: 0 },
  { id: 'two', date: '2024-06-14', note: 'NI01-00003438', total: 1512, paid: 100 },
  { id: 'paid', date: '2024-07-01', note: 'NI01-00003437', total: 200, paid: 200, name: 'Campaña antigua' },
  { id: 'usd', date: '2024-05-30', note: 'NI01-00003436', total: 100, paid: 25, currency: 'USD' },
].map(row => ({ id: row.id, clientId: client.id, name: row.name, createdAt: `${row.date}T05:00:00Z`, saleIds: [`sale-${row.id}`],
  saleDetails: [{ saleId: `sale-${row.id}`, saleNumber: row.note, date: `${row.date}T05:00:00Z`, total: row.total, currency: row.currency || 'PEN', items: [] }],
  totalAmount: row.total, paidAmount: row.paid, pendingAmount: row.total - row.paid, currency: row.currency || 'PEN',
  status: row.paid === row.total ? 'PAID' : row.paid ? 'PARTIAL' : 'PENDING', payments: row.paid ? [{ id: `payment-${row.id}`, amount: row.paid, paymentDate: '2024-08-01T05:00:00Z', paymentMethodName: 'Efectivo', notes: `Abono cuenta ${row.id}` }] : [] }));
const sales = accounts.map(account => ({ id: account.saleIds[0], saleNumber: account.saleDetails[0].saleNumber,
  clientId: client.id, date: account.createdAt, createdAt: account.createdAt, total: account.totalAmount,
  currency: account.currency, totalUsd: account.currency === 'USD' ? account.totalAmount : undefined, items: [], payments: [], isCredit: true, voucherType: 'NONE' }));
async function setup(browser, base, mobile) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Tokyo', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'selector-fixture'));
  const errors = [], writes = [], reads = [];
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), ep = url.pathname.replace(/^\/api/, '');
    if (request.method() !== 'GET') { writes.push(ep); return route.abort(); }
    reads.push(ep); let data = [];
    if (ep === '/auth/me') data = { id: 'admin', fullName: 'Prueba', role: 'ADMIN', isActive: true };
    else if (ep === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isActive: true, isDefault: true }];
    else if (ep === '/business-settings') data = {};
    else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (ep === '/clients') data = { data: [client], total: 1 };
    else if (ep === '/credits') {
      const filtered = accounts.filter(account => !url.searchParams.get('status') || account.status === url.searchParams.get('status'));
      data = { data: filtered, total: filtered.length };
    } else if (ep === `/credits/client/${client.id}`) data = { data: accounts, total: accounts.length };
    else if (ep === '/sales') data = { data: sales, total: sales.length };
    else if (['/loans', '/products', '/quotes', '/stock/lots/expiring'].includes(ep)) data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-11-14T15:00:00Z') });
  await page.goto(`${base}/clients?tab=creditos`);
  return { page, context, errors, writes, reads };
}
async function open(page, mode = 'summary') {
  await page.getByTitle('Descargar estado de cuenta', { exact: true }).click();
  const options = ['Resumen de cuenta', 'Detalle de ventas', 'Detalle de abonos'];
  for (const option of options) assert.equal(await page.getByRole('button', { name: new RegExp('^' + option) }).count(), 1);
  await page.getByRole('button', { name: new RegExp('^' + options[['summary', 'sales', 'payments'].indexOf(mode)]) }).click();
  return page.getByRole('heading', { name: mode === 'sales' ? 'Exportar detalle de ventas' : mode === 'payments' ? 'Exportar detalle de abonos' : 'Exportar estado de cuenta', exact: true }).locator('../..');
}
async function download(page, button, filename) {
  const event = page.waitForEvent('download'); await button.click(); const result = await event;
  assert.equal(await result.failure(), null); await result.saveAs('/tmp/inquival-statement-selector/' + filename);
}
async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-statement-selector-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen(); const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    await mkdir('/tmp/inquival-statement-selector', { recursive: true });
    for (const mobile of [false, true]) {
      const f = await setup(browser, base, mobile), { page } = f;
      await page.getByLabel('Estado del crédito', { exact: true }).selectOption('PENDING');
      let modal = await open(page);
      await modal.getByText('Se exportarán 4 de 4 cuentas del periodo.', { exact: true }).waitFor();
      assert.ok(f.reads.includes(`/credits/client/${client.id}`), 'always read the full client record, independently of the screen status filter');
      await modal.getByLabel('Periodo', { exact: true }).selectOption('custom');
      await modal.getByLabel('Desde', { exact: true }).fill('2026-11-01');
      await modal.getByLabel('Hasta', { exact: true }).fill('2026-11-14');
      await modal.getByLabel('Elegir cuentas específicas', { exact: true }).check();
      await modal.getByText('No hay cuentas creadas en el periodo seleccionado.', { exact: true }).waitFor();
      assert.equal(await modal.getByRole('searchbox').count(), 0);
      assert.equal(await modal.getByRole('button', { name: 'Descargar PDF', exact: true }).isDisabled(), true);
      await modal.getByRole('button', { name: 'Ver todas las cuentas (4)', exact: true }).click();
      assert.equal(await modal.getByLabel('Periodo', { exact: true }).inputValue(), 'all');
      await modal.getByText('Se exportarán 0 de 4 cuentas del periodo.', { exact: true }).waitFor();
      await modal.getByText('NI01-00003437', { exact: true }).waitFor();
      await modal.getByText('Fecha: 01/07/2024 · Pagada', { exact: true }).waitFor();
      const search = modal.getByLabel('Buscar cuenta para exportar', { exact: true });
      await search.fill('20/06/2024 1,228.00');
      const target = modal.getByRole('checkbox', { name: /^Incluir NI01-00003439 del/ });
      await target.waitFor(); assert.equal(await target.isChecked(), false);
      assert.equal(await modal.getByRole('checkbox', { name: /^Incluir / }).count(), 1);
      await target.check();
      await modal.getByText('Se exportarán 1 de 4 cuentas del periodo.', { exact: true }).waitFor();
      await search.fill('1512');
      await modal.getByText('1 cuenta marcada no coincide con esta búsqueda y seguirá incluida en el PDF.', { exact: true }).waitFor();
      await search.fill('');
      assert.equal(await modal.getByRole('checkbox', { name: /^Incluir NI01-00003438 del/ }).isChecked(), false);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'modal fits mobile viewport');
      await download(page, modal.getByRole('button', { name: 'Descargar PDF', exact: true }), `single-summary-${mobile ? 'mobile' : 'desktop'}.pdf`);
      modal = await open(page, 'sales');
      await modal.getByText('Se exportarán 1 de 4 cuentas del periodo.', { exact: true }).waitFor();
      const table = modal.getByRole('table');
      await table.getByText('NI01-00003439', { exact: true }).waitFor();
      assert.equal(await table.getByText('NI01-00003438', { exact: true }).count(), 0);
      await modal.getByLabel('Buscar cuenta para exportar', { exact: true }).fill('14/6/2024 1512,00');
      await modal.getByRole('button', { name: 'Quitar todas', exact: true }).click();
      assert.equal(await modal.getByRole('button', { name: 'Descargar PDF', exact: true }).isDisabled(), true);
      await modal.getByRole('checkbox', { name: /^Incluir NI01-00003438 del/ }).check();
      await table.getByText('NI01-00003438', { exact: true }).waitFor();
      assert.equal(await table.getByText('NI01-00003439', { exact: true }).count(), 0);
      await download(page, modal.getByRole('button', { name: 'Descargar PDF', exact: true }), `single-detail-${mobile ? 'mobile' : 'desktop'}.pdf`);
      const salesReads = f.reads.filter(ep => ep === '/sales').length;
      modal = await open(page, 'payments');
      await modal.getByText('Se exportarán 1 de 4 cuentas del periodo.', { exact: true }).waitFor();
      assert.equal(await modal.getByRole('checkbox', { name: /^Incluir NI01-00003438 del/ }).isChecked(), true);
      await download(page, modal.getByRole('button', { name: 'Descargar PDF', exact: true }), `single-payments-${mobile ? 'mobile' : 'desktop'}.pdf`);
      assert.equal(f.reads.filter(ep => ep === '/sales').length, salesReads, 'payments export uses the account ledger without depending on sales requests');
      assert.deepEqual(f.errors, []); assert.deepEqual(f.writes, []); await f.context.close();
      console.log(`PASS ${mobile ? 'mobile' : 'desktop'}: empty period recovery, full client history, note/date/amount search, explicit single selection and matching PDF`);
    }
    await browser.close(); browser = undefined;
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(__dirname, 'test-client-statement-period-browser.cjs')], { stdio: 'inherit', env: { ...process.env, E2E_BASE_URL: base } });
      child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error('Period export regression failed: ' + code)));
    });
  } finally { if (browser) await browser.close(); await server.close(); await rm(cacheDir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

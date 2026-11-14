const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtemp, rm, mkdir } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const client = { id: 'client', name: 'Cliente prueba créditos', isActive: true };
const otherClient = { id: 'other-client', name: 'Otro cliente créditos', isActive: true };
const sale = (id, number) => ({ saleId: id, saleNumber: number, date: '2024-06-20T05:00:00Z', total: 100, currency: 'PEN',
  items: [{ productId: 'product', productName: 'Producto prueba', companyId: 'warehouse', companyName: 'Principal', quantity: 1, unitPrice: 100, subtotal: 100 }] });
const credit = (id, overrides = {}) => ({ id, clientId: client.id, saleIds: [], saleDetails: [], totalAmount: 100, paidAmount: 0, pendingAmount: 100,
  status: 'PENDING', payments: [], createdAt: '2024-06-20T05:00:00Z', dueDate: '2026-11-13', currency: 'PEN', ...overrides });
const accounts = [
  credit('single', { saleIds: ['sale-one'], saleDetails: [sale('sale-one', 'NI01-00003439')] }),
  credit('named', { name: 'Campaña noviembre', saleIds: ['sale-two', 'sale-three'], saleDetails: [sale('sale-two', 'NI01-00003438'), sale('sale-three', 'NI01-00003437')] }),
  credit('multi', { saleIds: ['sale-four', 'sale-five'], saleDetails: [sale('sale-four', 'NI01-00003436'), sale('sale-five', 'NI01-00003435')] }),
  credit('historical', { name: 'Deuda histórica 2024' }),
  credit('no-link'),
  credit('no-number', { saleIds: ['000000000000000000000999'], saleDetails: [sale('000000000000000000000999')] }),
  credit('other-partial', { clientId: otherClient.id, currency: 'USD', status: 'PARTIAL', paidAmount: 25, pendingAmount: 75, saleIds: ['other-sale'], saleDetails: [sale('other-sale', 'NI02-00000007')], payments: [{ amount: 25, currency: 'USD', paymentDate: '2026-11-12', paymentGroupId: 'group' }] }),
  credit('other-paid', { clientId: otherClient.id, currency: 'USD', status: 'PAID', paidAmount: 100, pendingAmount: 0, saleIds: ['other-sale-paid'], saleDetails: [sale('other-sale-paid', 'NI02-00000008')], payments: [{ amount: 100, currency: 'USD', paymentDate: '2026-11-12', paymentGroupId: 'group' }] }),
];
async function fixture(browser, base, mobile) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'America/Lima', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'reference-fixture'));
  const writes = [], errors = [];
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), ep = url.pathname.replace(/^\/api/, '');
    if (request.method() !== 'GET') { writes.push(ep); return route.abort(); }
    let data = [];
    if (ep === '/auth/me') data = { id: 'admin', role: 'ADMIN', fullName: 'Prueba', isActive: true };
    else if (ep === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isDefault: true, isActive: true }];
    else if (ep === '/business-settings') data = {};
    else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (ep === '/clients') data = { data: [client, otherClient], total: 2 };
    else if (ep === '/credits') {
      const status = url.searchParams.get('status'); const filtered = accounts.filter(c => !status || c.status === status);
      data = { data: filtered, total: filtered.length };
    } else if (/^\/credits\/client\/[^/]+(?:\/open)?$/.test(ep)) {
      const clientId = ep.split('/')[3]; const rows = accounts.filter(c => c.clientId === clientId);
      data = ep.endsWith('/open') ? rows.filter(c => c.pendingAmount > 0) : { data: rows, total: rows.length };
    }
    else if (ep.startsWith('/credits/')) data = accounts.find(c => ep === `/credits/${c.id}`);
    else if (['/sales', '/loans', '/products', '/suppliers', '/stock/lots/expiring'].includes(ep)) data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-11-13T15:00:00Z') });
  await page.goto(`${base}/sales?tab=creditos`);
  return { page, context, writes, errors };
}
const modal = (page, title) => page.getByRole('heading', { name: title, exact: true }).locator('../..');
const close = panel => panel.getByRole('heading').locator('..').getByRole('button').click();
async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-credit-references-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen(); const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    await mkdir('/tmp/inquival-credit-references', { recursive: true });
    for (const mobile of [false, true]) {
      const f = await fixture(browser, base, mobile), { page } = f;
      await page.getByRole('button', { name: `Cuentas de ${client.name}`, exact: true }).click();
      const table = page.getByRole('table');
      await table.getByRole('columnheader', { name: 'Cuenta / Nota de venta', exact: true }).waitFor();
      const single = table.getByRole('row').filter({ has: page.getByRole('button', { name: 'Ver cuenta NI01-00003439', exact: true }) });
      await single.getByText('NI01-00003439', { exact: true }).waitFor();
      assert.equal(await single.getByText('S/ 100.00', { exact: true }).count(), 2);
      const named = table.getByRole('row').filter({ hasText: 'Campaña noviembre' });
      assert.match(await named.innerText(), /NI01-00003438, NI01-00003437/);
      await table.getByText('NI01-00003436, NI01-00003435', { exact: true }).waitFor();
      await table.getByText('Deuda histórica 2024', { exact: true }).waitFor();
      await table.getByText('Sin venta vinculada', { exact: true }).waitFor();
      await table.getByText('Venta sin número (00000999)', { exact: true }).waitFor();
      assert.equal(await table.getByText('NV-00000999', { exact: true }).count(), 0);
      await single.getByRole('button', { name: 'Ver cuenta NI01-00003439', exact: true }).click();
      const detail = modal(page, 'Detalle de la cuenta');
      await detail.getByText(/NI01-00003439 —/).waitFor();
      await detail.getByText('Producto prueba', { exact: true }).waitFor();
      await close(detail);
      await named.getByTitle('Editar productos', { exact: true }).click();
      const edit = modal(page, 'Editar productos — Campaña noviembre');
      await edit.getByText('NI01-00003438', { exact: true }).waitFor();
      await edit.getByText('NI01-00003437', { exact: true }).waitFor();
      await close(edit);
      await single.getByTitle('Editar fecha límite', { exact: true }).click();
      const due = modal(page, 'Fecha límite de pago');
      await due.getByText('NI01-00003439', { exact: true }).waitFor();
      await close(due);
      await page.getByRole('button', { name: `Cuentas de ${client.name}`, exact: true }).getByRole('button', { name: 'Pagar', exact: true }).click();
      const pay = modal(page, `Pagar — ${client.name}`);
      await pay.getByText('NI01-00003439', { exact: true }).waitFor();
      await pay.getByText('NI01-00003438, NI01-00003437', { exact: true }).waitFor();
      await close(pay);
      await page.getByRole('button', { name: 'Calendario de cobros', exact: true }).click();
      const calendar = page.getByRole('region', { name: 'Calendario de cobros', exact: true });
      await calendar.getByText('NI01-00003439', { exact: true }).waitFor();
      await calendar.getByText('NI01-00003438, NI01-00003437', { exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'calendar fits viewport');
      await page.getByRole('button', { name: 'Listado', exact: true }).click();
      if (!mobile) {
        for (const [option, file] of [['Resumen por fecha', 'resumen'], ['Detallado', 'detalle']]) {
          await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
          const downloadEvent = page.waitForEvent('download');
          await page.getByRole('button', { name: new RegExp(`^${option}`) }).click();
          const download = await downloadEvent; assert.equal(await download.failure(), null);
          await download.saveAs(`/tmp/inquival-credit-references/${file}.pdf`);
        }
      }
      for (const route of ['/credits', '/clients?tab=creditos', '/sales?tab=creditos']) {
        await page.goto(`${base}${route}`);
        await page.getByRole('button', { name: `Cuentas de ${otherClient.name}`, exact: true }).click();
        await page.getByRole('table').getByText('NI02-00000007', { exact: true }).waitFor();
        await page.getByRole('table').getByText('NI02-00000008', { exact: true }).waitFor();
        await page.getByLabel('Estado del crédito', { exact: true }).selectOption('PAID');
        await page.getByRole('table').getByText('NI02-00000008', { exact: true }).waitFor();
        assert.equal(await page.getByRole('table').getByText('NI02-00000007', { exact: true }).count(), 0);
      }
      await page.goto(`${base}/credits/client/${otherClient.id}`);
      await page.getByRole('heading', { name: `Creditos - ${otherClient.name}`, exact: true }).waitFor();
      await page.getByText(/NI02-00000007 —/).waitFor();
      await page.getByText(/NI02-00000008 —/).waitFor();
      const transactions = page.getByText('Transacciones grupales', { exact: true }).locator('../..');
      await transactions.getByText('NI02-00000007', { exact: true }).waitFor();
      await transactions.getByText('NI02-00000008', { exact: true }).waitFor();
      assert.deepEqual(f.writes, []); assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(`PASS ${mobile ? 'mobile' : 'desktop'}: single/multiple/named notes, historical/unlinked accounts, detail, edit, payment, due date, calendar, all clients/statuses, shared entry points and history; no writes`);
    }
  } finally { if (browser) await browser.close(); await server.close(); await rm(cacheDir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

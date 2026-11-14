const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { mkdtemp } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const parsePdf = require(process.env.PDF_PARSE_MODULE_PATH || 'pdf-parse');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5194';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);

const extraClients = Array.from({ length: 21 }, (_, i) => ({ id: `extra-${i + 1}`, name: `Cliente ${String(i + 1).padStart(2, '0')}`, isActive: true }));
const clients = [
  { id: 'ana', name: 'Ana Agricultora', isActive: true },
  { id: 'bruno', name: 'Bruno con abonos', isActive: true },
  { id: 'carla', name: 'Carla sin deuda', isActive: true },
  ...extraClients,
];
const credit = (id, clientId, totalAmount, paidAmount, status) => ({
  id, clientId, name: id, totalAmount, paidAmount, pendingAmount: totalAmount - paidAmount,
  status, currency: 'PEN', createdAt: '2026-11-13T05:00:00Z', dueDate: '2026-11-20',
  payments: [], saleIds: [], saleDetails: [],
});
const credits = [
  credit('Cuenta sin abonos', 'ana', 100, 0, 'PENDING'),
  credit('Cuenta con abonos', 'ana', 100, 30, 'PARTIAL'),
  credit('Cuenta cancelada de Ana', 'ana', 100, 100, 'PAID'),
  credit('Cuenta con abonos de Bruno', 'bruno', 200, 75, 'PARTIAL'),
  credit('Cuenta cancelada de Carla', 'carla', 80, 80, 'PAID'),
  ...extraClients.map((client, i) => credit(`Cuenta adicional ${i + 1}`, client.id, i + 1, 0, 'PENDING')),
];

async function fixture(browser, mobile = false) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'America/Lima', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'credit-status-fixture'));
  const writes = [], errors = [], reads = [];
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), ep = url.pathname.replace(/^\/api/, '');
    if (request.method() !== 'GET') { writes.push(ep); return route.abort(); }
    let data = [];
    if (ep === '/auth/me') data = { id: 'admin', role: 'ADMIN', fullName: 'Prueba', isActive: true };
    else if (ep === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isDefault: true, isActive: true }];
    else if (ep === '/business-settings') data = {};
    else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (ep === '/clients') data = { data: clients, total: clients.length };
    else if (ep === '/credits') {
      reads.push(Object.fromEntries(url.searchParams));
      const status = url.searchParams.get('status');
      const rows = credits.filter(item => !status || item.status === status);
      data = { data: rows, total: rows.length };
    } else if (ep.startsWith('/credits/')) data = credits.find(item => ep === `/credits/${encodeURIComponent(item.id)}`);
    else if (['/sales', '/loans', '/products', '/suppliers'].includes(ep)) data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/sales?tab=creditos`);
  await page.getByText('23 clientes', { exact: true }).waitFor();
  return { page, context, writes, errors, reads };
}

async function exportText(page, label, filename) {
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const ready = page.waitForEvent('download');
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  const download = await ready;
  assert.equal(await download.failure(), null);
  await download.saveAs(filename);
  return (await parsePdf(readFileSync(filename))).text.replace(/\s+/g, ' ');
}

async function main() {
  const output = await mkdtemp(path.join(os.tmpdir(), 'inquival-credit-status-pdfs-'));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  try {
    const f = await fixture(browser), { page } = f;
    const status = page.getByLabel('Estado del crédito', { exact: true });
    assert.deepEqual(await status.locator('option').allTextContents(), ['Todos', 'Pendiente', 'Pagado']);
    assert.equal(await status.inputValue(), 'PENDING');
    assert.equal(await page.getByRole('button', { name: /^Cuentas de / }).count(), 10);
    const ana = page.getByRole('button', { name: 'Cuentas de Ana Agricultora', exact: true });
    await ana.getByText('S/ 170.00', { exact: true }).waitFor();
    await ana.getByText('2 cuentas', { exact: true }).waitFor();
    await ana.click();
    await page.getByRole('table').getByText('Cuenta sin abonos', { exact: true }).waitFor();
    await page.getByRole('table').getByText('Cuenta con abonos', { exact: true }).waitFor();
    assert.equal(await page.getByText('Cuenta cancelada de Ana', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Parcial', { exact: true }).count(), 0);

    await page.getByPlaceholder('Buscar cliente...').fill('Ana');
    await page.getByText('1 cliente', { exact: true }).waitFor();
    for (const label of ['Resumen por fecha', 'Detallado']) {
      const text = await exportText(page, label, path.join(output, `${label}-ana.pdf`));
      assert.match(text, /S\/ 170\.00/);
      assert.doesNotMatch(text, /Parcial|Carla sin deuda/);
      if (label === 'Detallado') {
        assert.match(text, /Cuenta sin abonos/);
        assert.match(text, /Cuenta con abonos/);
        assert.doesNotMatch(text, /Cuenta cancelada de Ana/);
      }
    }
    console.log('PASS one pending filter includes untouched and partially paid accounts, preserves balances and exports the complete client debt');

    await page.getByPlaceholder('Buscar cliente...').fill('');
    await page.getByText('23 clientes', { exact: true }).waitFor();
    await page.locator('input.w-12').fill('3');
    await page.locator('input.w-12').press('Enter');
    await page.getByRole('button', { name: 'Cuentas de Cliente 01', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Cuentas de / }).count(), 3);
    for (const label of ['Resumen por fecha', 'Detallado']) {
      const text = await exportText(page, label, path.join(output, `${label}-all-pages.pdf`));
      assert.match(text, /S\/ 526\.00/);
      for (const name of ['Ana Agricultora', 'Bruno con abonos', 'Cliente 01', 'Cliente 21']) assert.ok(text.includes(name));
      assert.doesNotMatch(text, /Carla sin deuda|Parcial/);
    }
    console.log('PASS both PDFs export every matching client from all pages while the last page is selected');

    await status.selectOption('');
    await page.getByText('24 clientes', { exact: true }).waitFor();
    await ana.getByText('3 cuentas', { exact: true }).waitFor();
    await ana.getByText('S/ 300.00', { exact: true }).waitFor();
    await ana.getByText('S/ 130.00', { exact: true }).waitFor();
    await page.getByRole('table').getByText('Cuenta cancelada de Ana', { exact: true }).waitFor();
    for (const label of ['Resumen por fecha', 'Detallado']) {
      const text = await exportText(page, label, path.join(output, `${label}-all-statuses.pdf`));
      for (const name of ['Ana Agricultora', 'Bruno con abonos', 'Carla sin deuda', 'Cliente 01', 'Cliente 21']) assert.ok(text.includes(name));
      assert.match(text, /S\/ 811\.00/);
      assert.match(text, /S\/ 285\.00/);
      assert.match(text, /S\/ 526\.00/);
      assert.doesNotMatch(text, /Estado: Pendiente|Parcial/);
    }
    await page.getByRole('button', { name: 'Calendario de cobros', exact: true }).click();
    await page.getByRole('region', { name: 'Calendario de cobros', exact: true }).waitFor();
    assert.equal(await status.inputValue(), 'PENDING');
    assert.deepEqual(await status.locator('option').allTextContents(), ['Pendiente']);
    await page.getByRole('button', { name: 'Listado', exact: true }).click();
    console.log('PASS Todos combines pending, partially paid and paid accounts with matching PDF totals; the collection calendar keeps outstanding accounts only');

    await status.selectOption('PAID');
    await page.getByText('2 clientes', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cuentas de Carla sin deuda', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Cuentas de Bruno con abonos', exact: true }).count(), 0);
    await page.getByPlaceholder('Buscar cliente...').fill('Bruno');
    await page.getByText('No hay créditos que coincidan', { exact: true }).waitFor();
    await status.selectOption('PENDING');
    const bruno = page.getByRole('button', { name: 'Cuentas de Bruno con abonos', exact: true });
    await bruno.getByText('S/ 125.00', { exact: true }).waitFor();
    await bruno.getByText('Pendiente', { exact: true }).last().waitFor();
    assert.ok(f.reads.every(params => !params.status), 'server PENDING-only filtering must not discard accounts with abonos');
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.errors, []);
    await f.context.close();

    const mobile = await fixture(browser, true);
    await mobile.page.getByPlaceholder('Buscar cliente...').fill('Bruno');
    await mobile.page.getByText('S/ 125.00', { exact: true }).waitFor();
    assert.deepEqual(await mobile.page.getByLabel('Estado del crédito', { exact: true }).locator('option').allTextContents(), ['Todos', 'Pendiente', 'Pagado']);
    await mobile.page.getByPlaceholder('Buscar cliente...').fill('');
    await mobile.page.getByLabel('Estado del crédito', { exact: true }).selectOption('');
    await mobile.page.getByText('24 clientes', { exact: true }).waitFor();
    await mobile.page.getByPlaceholder('Buscar cliente...').fill('Carla');
    await mobile.page.getByRole('button', { name: 'Cuentas de Carla sin deuda', exact: true }).waitFor();
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(mobile.writes, []);
    assert.deepEqual(mobile.errors, []);
    await mobile.context.close();
    console.log('PASS paid-only accounts, clients with partial payments only, and mobile filters without business writes');
    console.log('PDF fixtures:', output);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

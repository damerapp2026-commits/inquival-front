const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const principal = '000000000000000000000001';
const beta = '000000000000000000000002';
const gamma = '000000000000000000000003';

async function fixture(browser, { worker = false, mobile = false } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'fixture'));
  const branches = [
    { id: principal, name: 'Principal', isActive: true, isDefault: true },
    { id: beta, name: 'Sucursal Beta', isActive: true, isDefault: false },
  ];
  const calls = [], errors = [], userWrites = [];
  const user = { id: 'fixture-user', username: 'fixture', fullName: 'Prueba', role: worker ? 'VENDEDOR' : 'ADMIN', branchId: worker ? beta : principal };
  let releaseWrite;
  let writeGate;
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const branch = request.headers()['x-branch-id'];
    const method = request.method();
    calls.push({ path, branch, method });
    let data = [];
    if (path === '/auth/me') data = user;
    else if (path === '/branches' && method === 'POST') {
      const input = request.postDataJSON();
      data = { ...input, id: gamma, isActive: true, isDefault: false };
      branches.push(data);
    } else if (path === '/branches') data = worker ? branches.filter(b => b.id === beta) : branches;
    else if (path === '/business-settings') data = { legalName: branches.find(b => b.id === branch)?.name, bankAccounts: [] };
    else if (path === '/clients') {
      const rows = branch === gamma ? [] : [{ id: `client-${branch}`, name: branch === principal ? 'Cliente Principal' : 'Cliente Beta', isActive: true }];
      data = { data: rows, total: rows.length };
    } else if (path === '/products' || path === '/sales' || path === '/credits') data = { data: [], total: 0 };
    else if (path === '/users' && method === 'POST') {
      userWrites.push(request.postDataJSON());
      await writeGate;
      data = { id: 'created-user', ...request.postDataJSON(), isActive: true };
    } else if (path === '/users') data = { data: [], total: 0 };
    else if (path === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (path === '/dashboard/summary') data = { totalIncome: 0, totalExpense: 0, netProfit: 0, registersCount: 0 };
    else if (path === '/dashboard/credits-summary') data = { totalPending: 0, totalPaid: 0, topDebtors: [] };
    else if (path === '/dashboard/payables-summary') data = { totalPending: 0, totalPaid: 0 };
    else if (path === '/dashboard/sales-chart') data = { dailySales: [], hourlySales: [], paymentBreakdown: [] };
    else if (path === '/dashboard/exchange-rate') data = { data: [], latest: null };
    else if (path === '/dashboard/category-sales-chart') data = { dates: [], categories: [], series: [] };
    else if (path === '/dashboard/profitability') data = { data: [], summary: {} };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, calls, errors, userWrites,
    holdWrites() { writeGate = new Promise(resolve => { releaseWrite = resolve; }); },
    releaseWrites() { releaseWrite(); },
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  try {
    const f = await fixture(browser);
    await f.page.goto(`${base}/clients`);
    await f.page.getByRole('cell', { name: 'Cliente Principal', exact: true }).waitFor();
    assert.equal(await f.page.getByLabel('Sucursal activa').inputValue(), principal);
    await f.page.getByLabel('Crear sucursal', { exact: true }).click();
    await f.page.getByLabel('Nombre de la sucursal').fill('Sucursal Gamma');
    await f.page.getByLabel('Dirección', { exact: true }).fill('Dirección Gamma');
    await f.page.locator('form').getByRole('button', { name: 'Crear sucursal', exact: true }).click();
    await f.page.getByRole('option', { name: 'Sucursal Gamma' }).waitFor({ state: 'attached' });
    assert.ok(f.calls.some(c => c.path === '/branches' && c.method === 'POST'));

    await f.page.getByLabel('Sucursal activa').selectOption(beta);
    await f.page.waitForURL('**/dashboard');
    await f.page.goto(`${base}/clients`);
    await f.page.getByRole('cell', { name: 'Cliente Beta', exact: true }).waitFor();
    assert.equal(await f.page.getByRole('cell', { name: 'Cliente Principal', exact: true }).count(), 0);
    assert.equal(await f.page.getByLabel('Sucursal activa').inputValue(), beta);

    await f.page.goto(`${base}/settings`);
    await f.page.getByRole('button', { name: 'Usuarios', exact: true }).click();
    await f.page.getByRole('button', { name: 'Nuevo Usuario' }).click();
    const form = f.page.locator('form');
    await form.locator('input').nth(0).fill('Trabajador Gamma');
    await form.locator('input').nth(1).fill('trabajador-gamma');
    await form.locator('input[type=password]').fill('test-password');
    await f.page.getByLabel('Sucursal del usuario').selectOption(gamma);
    f.holdWrites();
    await f.page.getByRole('button', { name: 'Crear Usuario', exact: true }).click();
    await f.page.waitForFunction(() => document.querySelector('#active-branch')?.disabled);
    assert.equal(await f.page.getByLabel('Sucursal activa').isDisabled(), true);
    f.releaseWrites();
    await f.page.waitForFunction(() => !document.querySelector('#active-branch')?.disabled);
    assert.equal(f.userWrites.length, 1);
    assert.equal(f.userWrites[0].branchId, gamma);

    await f.page.getByLabel('Sucursal activa').selectOption(gamma);
    await f.page.waitForURL('**/dashboard');
    await f.page.goto(`${base}/clients`);
    await f.page.getByText('No hay datos disponibles', { exact: true }).waitFor();
    assert.equal(await f.page.getByRole('cell', { name: 'Cliente Beta', exact: true }).count(), 0);
    assert.equal(f.calls.filter(c => c.path === '/clients').at(-1).branch, gamma);
    assert.deepEqual(f.errors, []);
    await f.context.close();

    for (const worker of [false, true]) {
      const mobile = await fixture(browser, { worker, mobile: true });
      await mobile.page.goto(`${base}/clients`);
      await mobile.page.getByRole('heading', { name: 'Clientes', exact: true }).waitFor();
      if (worker) {
        await mobile.page.getByRole('cell', { name: 'Cliente Beta', exact: true }).waitFor();
        assert.equal(await mobile.page.getByLabel('Sucursal activa').count(), 0);
        assert.equal(await mobile.page.getByLabel('Crear sucursal', { exact: true }).count(), 0);
        assert.equal(mobile.calls.filter(c => c.path === '/clients').at(-1).branch, beta);
      } else {
        const box = await mobile.page.getByLabel('Sucursal activa').boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= 390);
      }
      assert.deepEqual(mobile.errors, []);
      await mobile.context.close();
    }
    console.log('PASS: branch creation, selection, fresh queries after reload, empty branch, user assignment, write guard, admin permissions and mobile layout');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

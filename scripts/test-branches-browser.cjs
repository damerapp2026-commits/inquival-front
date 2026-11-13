const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const principal = '000000000000000000000001';
const beta = '000000000000000000000002';
const gamma = '000000000000000000000003';

async function fixture(browser, { worker = false, mobile = false, width = mobile ? 390 : 1440, many = false } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('token', 'fixture'));
  const branches = [
    { id: principal, name: 'Principal', isActive: true, isDefault: true },
    { id: beta, name: 'Sucursal Beta', isActive: true, isDefault: false },
  ];
  if (many) ['Norte', 'Sur', 'Centro', 'Costa'].forEach((name, index) => branches.push({ id: String(index + 10).padStart(24, '0'), name: `Sucursal ${name}`, isActive: true, isDefault: false }));
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

async function chooseBranch(page, name) {
  const trigger = page.getByLabel('Sucursal activa');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await page.getByRole('option', { name, exact: true }).click();
}

async function capture(page, name, width = 440) {
  const directory = process.env.BRANCH_TEST_SCREENSHOT_DIR;
  if (!directory) return;
  require('node:fs').mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}.png`, clip: { x: Math.max(0, page.viewportSize().width - width), y: 0, width, height: 450 } });
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  try {
    const f = await fixture(browser);
    await f.page.goto(`${base}/clients`);
    await f.page.getByRole('cell', { name: 'Cliente Principal', exact: true }).waitFor();
    await f.page.getByLabel('Sucursal activa').getByText('Principal', { exact: true }).waitFor();
    await f.page.getByLabel('Sucursal activa').click();
    assert.equal(await f.page.getByRole('option', { name: 'Principal', exact: true }).getAttribute('aria-selected'), 'true');
    await capture(f.page, 'branch-menu-desktop');
    await f.page.keyboard.press('Escape');
    assert.equal(await f.page.getByRole('listbox').count(), 0);
    assert.ok(await f.page.getByLabel('Sucursal activa').evaluate(element => element === document.activeElement));
    await f.page.getByLabel('Sucursal activa').press('ArrowDown');
    await f.page.getByRole('option', { name: 'Principal', exact: true }).press('End');
    assert.ok(await f.page.getByRole('option', { name: 'Sucursal Beta', exact: true }).evaluate(element => element === document.activeElement));
    await f.page.getByRole('button', { name: 'Crear sucursal', exact: true }).click();
    await f.page.getByLabel('Nombre de la sucursal').fill('Sucursal Gamma');
    await f.page.getByLabel('Dirección', { exact: true }).fill('Dirección Gamma');
    await f.page.locator('form').getByRole('button', { name: 'Crear sucursal', exact: true }).click();
    await f.page.getByText('Sucursal creada. Ya puedes seleccionarla.', { exact: true }).waitFor();
    await f.page.getByLabel('Sucursal activa').click();
    await f.page.getByRole('option', { name: 'Sucursal Gamma', exact: true }).waitFor();
    assert.ok(f.calls.some(c => c.path === '/branches' && c.method === 'POST'));

    await chooseBranch(f.page, 'Sucursal Beta');
    await f.page.waitForURL('**/dashboard');
    await f.page.goto(`${base}/clients`);
    await f.page.getByRole('cell', { name: 'Cliente Beta', exact: true }).waitFor();
    assert.equal(await f.page.getByRole('cell', { name: 'Cliente Principal', exact: true }).count(), 0);
    await f.page.getByLabel('Sucursal activa').getByText('Sucursal Beta', { exact: true }).waitFor();

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

    await chooseBranch(f.page, 'Sucursal Gamma');
    await f.page.waitForURL('**/dashboard');
    await f.page.goto(`${base}/clients`);
    await f.page.getByText('No hay datos disponibles', { exact: true }).waitFor();
    assert.equal(await f.page.getByRole('cell', { name: 'Cliente Beta', exact: true }).count(), 0);
    assert.equal(f.calls.filter(c => c.path === '/clients').at(-1).branch, gamma);
    assert.deepEqual(f.errors, []);
    await f.context.close();

    const searchable = await fixture(browser, { many: true });
    await searchable.page.goto(`${base}/clients`);
    await searchable.page.getByLabel('Sucursal activa').click();
    await searchable.page.getByLabel('Buscar sucursal').fill('norte');
    assert.equal(await searchable.page.getByRole('option').count(), 1);
    await searchable.page.getByLabel('Buscar sucursal').press('ArrowDown');
    assert.ok(await searchable.page.getByRole('option', { name: 'Sucursal Norte', exact: true }).evaluate(element => element === document.activeElement));
    await searchable.page.keyboard.press('Escape');
    await searchable.page.getByLabel('Sucursal activa').click();
    await searchable.page.getByLabel('Buscar sucursal').fill('no existe');
    await searchable.page.getByText('No se encontraron sucursales', { exact: true }).waitFor();
    await searchable.page.getByRole('heading', { name: 'Clientes', exact: true }).click();
    assert.equal(await searchable.page.getByRole('listbox').count(), 0);
    assert.deepEqual(searchable.errors, []);
    await searchable.context.close();

    for (const width of [320, 390]) for (const worker of [false, true]) {
      const mobile = await fixture(browser, { worker, mobile: true, width });
      await mobile.page.goto(`${base}/clients`);
      await mobile.page.getByRole('heading', { name: 'Clientes', exact: true }).waitFor();
      if (worker) {
        await mobile.page.getByRole('cell', { name: 'Cliente Beta', exact: true }).waitFor();
        assert.equal(await mobile.page.getByLabel('Sucursal activa').count(), 0);
        assert.equal(await mobile.page.getByRole('button', { name: 'Crear sucursal', exact: true }).count(), 0);
        assert.equal(mobile.calls.filter(c => c.path === '/clients').at(-1).branch, beta);
      } else {
        const box = await mobile.page.getByLabel('Sucursal activa').boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width);
        await mobile.page.getByLabel('Sucursal activa').click();
        const menu = await mobile.page.getByRole('listbox').locator('..').boundingBox();
        assert.ok(menu && menu.x >= 8 && menu.x + menu.width <= width - 8, 'menu fits the mobile viewport');
        if (width === 390) await capture(mobile.page, 'branch-menu-mobile', width);
        await mobile.page.keyboard.press('Escape');
      }
      assert.deepEqual(mobile.errors, []);
      await mobile.context.close();
    }
    console.log('PASS: branch creation, selection, fresh queries after reload, empty branch, user assignment, write guard, admin permissions, keyboard navigation, search, outside dismissal and mobile layout');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const entry = {
  date: '2026-11-01T00:00:00.000Z',
  description: 'Almuerzo',
  category: 'ALIMENTACION',
  amount: 10,
};
const budget = {
  workerId: 'worker-a',
  alojamiento: 10,
  transporte: 10,
  combustible: 10,
  alimentacion: 10,
  otros: 10,
};
const makeReport = () => ({
  id: 'report-1',
  workerId: 'worker-a',
  workerName: 'Trabajador prueba',
  month: 11,
  year: 2026,
  status: 'DRAFT',
  version: 0,
  depositedAmount: 300,
  entries: [{ ...entry }],
});
async function fixture(browser, options = {}) {
  const role = options.role || 'VENDEDOR';
  const context = await browser.newContext({
    serviceWorkers: 'block',
    timezoneId: options.timezone || 'America/Lima',
    viewport: { width: options.mobile ? 390 : 1440, height: 1000 },
  });
  await context.addInitScript(() => localStorage.setItem('token', 'fixture'));
  const state = {
    report: options.empty ? null : makeReport(),
    budget: { ...budget },
    writes: [],
    reads: [],
    failBudget: false,
    failReview: false,
    failSave: false,
    conflict: false,
  };
  if (role === 'ADMIN') state.report.status = 'SUBMITTED';
  await context.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      ep = url.pathname.replace(/^\/api/, ''),
      method = request.method();
    const body = request.postData() ? request.postDataJSON() : null;
    let data = [],
      status = 200;
    if (ep.startsWith('/worker-expenses') && method !== 'GET')
      state.writes.push({ ep, method, body });
    if (ep.startsWith('/worker-expenses') && method === 'GET') state.reads.push(ep + url.search);
    const fail = (message) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message }),
      });
    if (ep === '/auth/me')
      data = {
        id: role === 'ADMIN' ? 'admin' : 'worker-a',
        role,
        username: role,
        fullName: role,
        isActive: true,
      };
    else if (ep === '/users')
      data = {
        data:
          url.searchParams.get('role') === 'VENDEDOR_CAMPO'
            ? []
            : [{ id: 'worker-a', role: 'VENDEDOR', fullName: 'Trabajador prueba' }],
        total: 1,
      };
    else if (ep === '/business-settings') data = {};
    else if (ep === '/worker-expenses/my-report' && method === 'GET')
      data =
        state.report && Number(url.searchParams.get('month')) === state.report.month
          ? state.report
          : null;
    else if (ep === '/worker-expenses/my-report' && method === 'POST') {
      state.report = { ...makeReport(), month: body.month, year: body.year, entries: [] };
      data = state.report;
    } else if (ep === '/worker-expenses/budgets') data = [state.budget];
    else if (ep === '/worker-expenses/budgets/worker-a' && method === 'GET') data = state.budget;
    else if (ep === '/worker-expenses/budgets/worker-a') {
      if (state.failBudget) return fail('Fallo de tope simulado');
      state.budget = { ...state.budget, ...body };
      data = state.budget;
    } else if (ep === '/worker-expenses/reports') data = [state.report];
    else if (/\/reports\/report-1\/(submit|entries)$/.test(ep)) {
      if (state.conflict) {
        state.report = { ...state.report, version: 1, entries: [{ ...entry, amount: 50 }] };
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'El reporte cambió en otra sesión.' }),
        });
      }
      if (state.failSave) return fail('Fallo de gastos simulado');
      assert.equal(body.version, state.report.version);
      state.report = {
        ...state.report,
        entries: body.entries,
        version: state.report.version + 1,
        status: ep.endsWith('/submit') ? 'SUBMITTED' : state.report.status,
      };
      data = state.report;
    } else if (ep.endsWith('/review')) {
      if (state.failReview) return fail('Fallo de revisión simulado');
      state.report = { ...state.report, ...body, version: state.report.version + 1 };
      data = state.report;
    } else if (ep.endsWith('/advance')) {
      state.report = {
        ...state.report,
        depositedAmount: body.depositedAmount,
        advanceConfirmedAt: '2026-11-06T12:00:00Z',
        version: state.report.version + 1,
      };
      data = state.report;
    }
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date(options.time || '2026-11-06T12:00:00Z'));
  await page.goto(base + '/expenses/workers');
  return { context, page, state, errors };
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  let passed = 0;
  async function scenario(name, options, run) {
    const f = await fixture(browser, options);
    try {
      await run(f);
      assert.deepEqual(f.errors, []);
      console.log('PASS:', name);
      passed++;
    } finally {
      await f.context.close();
    }
  }
  try {
    await scenario(
      'mobile send saves visible amount atomically, preserves calendar day and has no horizontal expense grid',
      { mobile: true },
      async ({ page, state }) => {
        const amount = page.getByLabel('Monto del gasto 1', { exact: true });
        await amount.waitFor();
        await amount.fill('99');
        assert.equal(
          await page.getByLabel('Fecha del gasto 1', { exact: true }).inputValue(),
          '2026-11-01',
        );
        assert.equal(await page.getByLabel('Total adelantado', { exact: true }).count(), 0);
        const widths = await page
          .locator('fieldset')
          .first()
          .evaluate((el) => ({ inside: el.scrollWidth, outside: el.clientWidth }));
        assert.ok(widths.inside <= widths.outside + 1);
        await page.getByRole('button', { name: 'Enviar para revisión', exact: true }).click();
        await page.getByText('Enviado · en revisión', { exact: true }).waitFor();
        assert.equal(state.report.entries[0].amount, 99);
        assert.deepEqual(
          state.writes.map((w) => w.ep),
          ['/worker-expenses/reports/report-1/submit'],
        );
        assert.equal(state.writes[0].body.version, 0);
        assert.equal(state.writes[0].body.depositedAmount, undefined);
      },
    );
    await scenario(
      'failed save preserves edits; cancelling month navigation keeps them; retry saves them',
      {},
      async ({ page, state }) => {
        const amount = page.getByLabel('Monto del gasto 1', { exact: true });
        await amount.fill('99');
        state.failSave = true;
        await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
        await page.getByText('Fallo de gastos simulado', { exact: true }).waitFor();
        assert.equal(await amount.inputValue(), '99');
        page.once('dialog', (dialog) => dialog.dismiss());
        await page.getByRole('button', { name: 'Mes anterior', exact: true }).click();
        assert.equal(await amount.inputValue(), '99');
        state.failSave = false;
        await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
        await page.getByText('Sin cambios pendientes.', { exact: false }).waitFor();
        assert.equal(state.report.entries[0].amount, 99);
      },
    );
    await scenario(
      'stale session keeps local edits and requires explicit reload',
      {},
      async ({ page, state }) => {
        const amount = page.getByLabel('Monto del gasto 1', { exact: true });
        await amount.fill('99');
        state.conflict = true;
        await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
        await page
          .getByRole('button', { name: 'Recargar versión guardada', exact: true })
          .waitFor();
        assert.equal(await amount.inputValue(), '99');
        assert.equal(
          await page
            .getByRole('button', { name: 'Enviar para revisión', exact: true })
            .isDisabled(),
          true,
        );
        page.once('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: 'Recargar versión guardada', exact: true }).click();
        await page.waitForFunction(
          () => document.querySelector('[aria-label="Monto del gasto 1"]').value === '50',
        );
      },
    );
    await scenario(
      'opening empty months creates nothing; validates amount before creating and sending a new report',
      { empty: true },
      async ({ page, state }) => {
        await page.getByRole('button', { name: 'Agregar gasto', exact: true }).click();
        assert.equal(state.writes.length, 0);
        await page.getByRole('button', { name: 'Enviar para revisión', exact: true }).click();
        await page.getByText('Revisa el gasto 1:', { exact: false }).waitFor();
        assert.equal(state.writes.length, 0);
        await page.getByLabel('Monto del gasto 1', { exact: true }).fill('15.25');
        await page.getByRole('button', { name: 'Enviar para revisión', exact: true }).click();
        await page.getByText('Enviado · en revisión', { exact: true }).waitFor();
        assert.deepEqual(
          state.writes.map((w) => w.ep),
          ['/worker-expenses/my-report', '/worker-expenses/reports/report-1/submit'],
        );
        assert.equal(state.report.entries[0].amount, 15.25);
      },
    );
    await scenario(
      'month and default expense day use Peru even on a Tokyo browser across midnight',
      { empty: true, timezone: 'Asia/Tokyo', time: '2026-11-01T04:30:00Z' },
      async ({ page, state }) => {
        await page.getByText('Octubre 2026', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Agregar gasto', exact: true }).click();
        assert.equal(
          await page.getByLabel('Fecha del gasto 1', { exact: true }).inputValue(),
          '2026-10-31',
        );
        assert.ok(state.reads.some((url) => url.includes('month=10')));
        assert.equal(state.writes.length, 0);
      },
    );
    await scenario(
      'admin failed budget save retains 99 and successful retry keeps the confirmed amount',
      { role: 'ADMIN' },
      async ({ page, state }) => {
        await page.getByText('Configurar topes mensuales', { exact: true }).click();
        const cap = page.getByLabel('Trabajador prueba: Alojamiento', { exact: true });
        await cap.fill('99');
        state.failBudget = true;
        await page.getByTitle('Guardar', { exact: true }).click();
        await page.getByText('Fallo de tope simulado', { exact: true }).waitFor();
        assert.equal(await cap.inputValue(), '99');
        state.failBudget = false;
        await page.getByTitle('Guardar', { exact: true }).click();
        await page.getByText('Tope de viáticos actualizado', { exact: true }).waitFor();
        assert.equal(await cap.inputValue(), '99');
        assert.equal(state.budget.alojamiento, 99);
      },
    );
    await scenario(
      'admin date stays November 1; failed review retains notes; confirms advance with reference',
      { role: 'ADMIN' },
      async ({ page, state }) => {
        await page
          .getByRole('button')
          .filter({ hasText: 'Trabajador prueba · Noviembre 2026' })
          .click();
        await page.getByText('1/11/2026', { exact: true }).waitFor();
        const notes = page.getByPlaceholder('Observaciones (opcional, requerido para rechazar)');
        await notes.fill('Revisar comprobante');
        state.failReview = true;
        await page.getByRole('button', { name: 'Rechazar', exact: true }).click();
        await page.getByText('Fallo de revisión simulado', { exact: true }).waitFor();
        assert.equal(await notes.inputValue(), 'Revisar comprobante');
        await page
          .getByRole('button', { name: 'Registrar o confirmar adelanto', exact: true })
          .click();
        await page.getByLabel('Total adelantado', { exact: true }).fill('500');
        await page.getByLabel('Referencia del adelanto', { exact: true }).fill('Transferencia 123');
        await page.getByRole('button', { name: 'Confirmar adelanto', exact: true }).click();
        await page.getByText('Confirmado por administración', { exact: false }).waitFor();
        assert.equal(state.report.depositedAmount, 500);
        const sent = state.writes.find((w) => w.ep.endsWith('/advance'));
        assert.equal(sent.body.version, 0);
        assert.equal(sent.body.note, 'Transferencia 123');
      },
    );
    await scenario('multiple unsaved admin forms ask once before leaving and cancellation preserves edits', { role: 'ADMIN' }, async ({ page }) => {
      await page.getByText('Configurar topes mensuales', { exact: true }).click();
      const cap = page.getByLabel('Trabajador prueba: Alojamiento', { exact: true });
      await cap.fill('99');
      await page.getByRole('button').filter({ hasText: 'Trabajador prueba · Noviembre 2026' }).click();
      await page.getByPlaceholder('Observaciones (opcional, requerido para rechazar)').fill('Pendiente de revisar');
      let dialogs = 0;
      page.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
      await page.getByRole('link', { name: 'Inicio', exact: true }).click();
      assert.equal(dialogs, 1);
      assert.ok(page.url().endsWith('/expenses/workers'));
      assert.equal(await cap.inputValue(), '99');
    });
    console.log(
      `${passed} browser scenarios passed. All API traffic was intercepted; no business data was used.`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

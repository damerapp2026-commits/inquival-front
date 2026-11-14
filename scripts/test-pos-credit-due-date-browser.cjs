const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtemp, rm } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

const product = { id: 'product', name: 'Producto prueba', unit: 'UND', taxType: 'EXONERADO', isActive: true, prices: [{ priceTierId: 'price', price: 100 }] };
const client = { id: 'client', name: 'Cliente prueba', isActive: true };
const draft = { cart: [{ productId: product.id, name: product.name, unit: 'UND', quantity: 1, unitPrice: 100, taxType: 'EXONERADO', sourceCompanyId: 'company' }], bonusItems: [], companyId: 'company', tierId: 'price', clientId: client.id };

async function setup(browser, base, mobile, fromQuote) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: mobile ? 'Asia/Tokyo' : 'America/Lima', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(value => {
    localStorage.setItem('token', 'pos-due-date-fixture');
    localStorage.setItem('inquival:pos:draft:v1', JSON.stringify(value));
  }, draft);
  const writes = [], errors = [];
  const state = { fail: true };
  await context.route('**/api/**', async route => {
    const request = route.request(), ep = new URL(request.url()).pathname.replace(/^\/api/, '');
    let data = [];
    if (request.method() !== 'GET') {
      assert.equal(request.method(), 'POST');
      assert.equal(ep, fromQuote ? '/quotes/quote/convert' : '/sales');
      const payload = request.postDataJSON();
      writes.push({ ep, payload });
      if (state.fail) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: ['Fallo simulado al registrar venta'] }) });
      data = { id: 'sale', saleNumber: 'NI01-00000001', ...payload };
      state.savedSale = { ...data, total: 100, createdAt: payload.date,
        items: payload.items.map(item => ({ ...item, subtotal: item.quantity * item.unitPrice })),
        creditDueDate: payload.isCredit ? `${payload.creditDueDate}T00:00:00.000Z` : undefined };
    } else if (ep === '/auth/me') data = { id: 'admin', fullName: 'Prueba', role: 'ADMIN', isActive: true };
    else if (ep === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isDefault: true, isActive: true }];
    else if (ep === '/business-settings') data = {};
    else if (ep === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (ep === '/products') data = { data: [product], total: 1 };
    else if (ep === '/sales') data = { data: state.savedSale ? [state.savedSale] : [], total: state.savedSale ? 1 : 0 };
    else if (ep === '/sales/sale') data = state.savedSale;
    else if (ep === '/companies') data = [{ id: 'company', name: 'Principal', isActive: true }];
    else if (ep === '/clients') data = { data: [client], total: 1 };
    else if (ep === '/price-tiers') data = [{ id: 'price', name: 'Minorista', isActive: true, priority: 1 }];
    else if (ep === '/payment-methods') data = [{ id: 'cash', name: 'Efectivo', isActive: true }];
    else if (ep === '/stock/by-product') data = [{ productId: product.id, totalQuantity: 20, byCompany: [{ companyId: 'company', quantity: 20 }] }];
    else if (ep === '/quotes/quote') data = { id: 'quote', quoteNumber: 'C001-00000001', clientId: client.id, status: 'PENDING', companyId: 'company', items: [{ productId: product.id, quantity: 1, unitPrice: 100, priceTier: 'price' }] };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/pos${fromQuote ? '?fromQuote=quote' : ''}`);
  if (fromQuote) await page.getByText('Cotización C001-00000001 cargada', { exact: true }).waitFor();
  if (mobile) await page.getByRole('button', { name: /1 producto.*S\/ 100/ }).click();
  await page.getByRole('button', { name: 'Vender', exact: true }).click();
  await page.locator('label[title="Fecha de la venta"] input').fill('2026-11-14');
  await page.getByRole('button', { name: /^Siguiente/ }).click();
  return { context, page, writes, errors, state };
}

async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-pos-due-date-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    for (const [mobile, fromQuote] of [[false, false], [true, true]]) {
      const f = await setup(browser, base, mobile, fromQuote), { page } = f;
      await page.getByRole('button', { name: 'A crédito', exact: true }).click();
      const note = 'Entregar en parcela <Norte> & cobrar después de cosecha.';
      const noteInput = page.getByPlaceholder('Ej: Tomates, Maíz', { exact: true });
      await noteInput.fill(`  ${note}  `);
      const due = page.getByLabel('Fecha de vencimiento', { exact: false });
      const confirm = page.getByRole('button', { name: /^A Crédito ·/ });
      assert.equal(await due.inputValue(), '');
      assert.equal(await due.getAttribute('required'), '');
      assert.equal(await confirm.isDisabled(), true);
      await page.getByText('Selecciona la fecha de vencimiento del crédito para continuar.', { exact: true }).waitFor();
      // The submission handler must also reject missing dates if the button is triggered directly.
      await confirm.evaluate(button => { button.disabled = false; button.click(); });
      assert.equal(f.writes.length, 0);
      await due.fill('2026-12-14');
      assert.equal(await confirm.isEnabled(), true);
      await due.fill('');
      assert.equal(await confirm.isDisabled(), true);
      await due.fill('2026-11-13');
      assert.equal(await confirm.isDisabled(), true);
      await page.getByText('El vencimiento no puede ser anterior a la fecha de venta.', { exact: true }).waitFor();
      const days = page.getByLabel('O calcular el vencimiento por días', { exact: true });
      for (const invalid of ['0', '1.5', '9999999999999999']) {
        await days.fill(invalid);
        assert.equal(await confirm.isDisabled(), true);
      }
      await days.fill('30');
      assert.equal(await due.inputValue(), '2026-12-14');
      assert.equal(await confirm.isEnabled(), true);
      // Editing the date clears the shortcut and sends the actual selected calendar day.
      await due.fill('2026-12-20');
      assert.equal(await days.inputValue(), '');
      await confirm.click();
      await page.getByText('Fallo simulado al registrar venta', { exact: true }).waitFor();
      assert.equal(f.writes.length, 1);
      assert.equal(f.writes[0].payload.creditDueDate, '2026-12-20');
      assert.equal(f.writes[0].payload.isCredit, true);
      assert.equal(f.writes[0].payload.creditName, note);
      assert.equal(await due.inputValue(), '2026-12-20');
      assert.equal(await noteInput.inputValue(), `  ${note}  `);
      f.state.fail = false;
      await confirm.click();
      await page.getByRole('heading', { name: '¡Venta registrada!', exact: true }).waitFor();
      assert.equal(f.writes.length, 2);
      assert.equal(f.writes[1].payload.creditDueDate, '2026-12-20');
      assert.equal(f.writes[1].payload.creditName, note);
      // Remove the intentionally triggered error toast before testing the mobile format tabs.
      await page.addStyleTag({ content: '[data-rht-toaster] { pointer-events: none !important; } [data-rht-toaster] * { pointer-events: none !important; }' });
      await page.getByRole('button', { name: /^Ver comprobante/ }).click();
      const voucher = page.frameLocator('iframe[title="Vista previa"]');
      for (const format of ['A5', 'A4', 'Ticket 80mm']) {
        await page.getByRole('button', { name: format, exact: true }).click();
        await voucher.locator('.voucher-note-text').waitFor();
        assert.equal(await voucher.locator('.voucher-note-text').innerText(), note);
        assert.equal(await voucher.locator('.voucher-note-text > *').count(), 0, 'note is rendered as text');
        await voucher.getByText('Vence el', { exact: true }).waitFor();
        await voucher.getByText('20/12/2026', { exact: true }).waitFor();
      }
      // Reopen the saved sale from the list, then read a rescheduled due date.
      for (const day of ['20', '25']) {
        f.state.savedSale.creditDueDate = `2026-12-${day}T00:00:00.000Z`;
        await page.goto(`${base}/sales?openSaleId=sale`);
        await page.getByRole('button', { name: 'Ver comprobante', exact: true }).click();
        for (const format of ['A5', 'A4', 'Ticket 80mm']) {
          await page.getByRole('button', { name: format, exact: true }).click();
          await voucher.getByText(`${day}/12/2026`, { exact: true }).waitFor();
          assert.equal(await voucher.locator('.voucher-note-text').innerText(), note);
        }
      }
      delete f.state.savedSale.creditDueDate;
      await page.goto(`${base}/sales?openSaleId=sale`);
      await page.getByRole('button', { name: 'Ver comprobante', exact: true }).click();
      await voucher.locator('.voucher-note-text').waitFor();
      assert.equal(await voucher.getByText('Vence el', { exact: true }).count(), 0, 'no invented date for an undated historical credit');
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(`PASS ${mobile ? 'mobile quote conversion (Tokyo)' : 'desktop sale (Lima)'}: due date and note survive checkout, reopened A5/A4/ticket show the current calendar day; undated accounts stay undated`);
    }
    const f = await setup(browser, base, false, false);
    await f.page.getByRole('button', { name: 'A crédito', exact: true }).click();
    await f.page.getByPlaceholder('Ej: Tomates, Maíz', { exact: true }).fill('Nota del crédito descartado');
    await f.page.getByRole('button', { name: 'Pago inmediato', exact: true }).click();
    assert.equal(await f.page.getByLabel('Fecha de vencimiento', { exact: false }).count(), 0);
    await f.page.getByPlaceholder('0.00', { exact: true }).fill('100');
    f.state.fail = false;
    await f.page.getByRole('button', { name: /^Confirmar ·/ }).click();
    await f.page.getByRole('heading', { name: '¡Venta registrada!', exact: true }).waitFor();
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].payload.isCredit, false);
    assert.equal(f.writes[0].payload.creditDueDate, undefined);
    assert.equal(f.writes[0].payload.creditName, undefined);
    await f.page.getByRole('button', { name: /^Ver comprobante/ }).click();
    assert.equal(await f.page.frameLocator('iframe[title="Vista previa"]').locator('.voucher-note').count(), 0);
    assert.equal(await f.page.frameLocator('iframe[title="Vista previa"]').getByText('Vence el', { exact: true }).count(), 0);
    assert.deepEqual(f.errors, []);
    await f.context.close();
    console.log('PASS immediate payment does not require a credit due date');
  } finally {
    if (browser) await browser.close();
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

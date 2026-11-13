const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

function draft(currency) {
  return {
    state: {
      supplier: 'Proveedor prueba', supplierRuc: '20535703214', supplierId: 'supplier', laboratoryId: 'laboratory',
      paymentType: 'CREDITO', paymentMethodId: '', addToStock: true,
      paymentScheduleType: 'SINGLE_DATE', dueDate: '2026-12-20', installments: [],
      detraccion: false, detraccionDueDate: '', purchaseDate: '2026-11-13', issueDate: '2026-11-13',
      documentType: 'FACTURA', documentSeries: 'F001', documentNumber: '1000', grSeries: '', grNumber: '', grDate: '',
      items: [{ companyId: 'warehouse', productId: 'product', quantity: 1, lotNumber: '', expirationDate: '',
        unitPriceSinIgv: 847.4576, unitPriceSinIgvInput: '847.4576', unitPriceConIgv: 1000, costoAdquisicion: 1000,
        costoEnSoles: currency === 'USD' ? 3750 : 1000, markupPercent: 0, precioVenta: currency === 'USD' ? 3750 : 1000, precioVentaMode: 'direct' }],
    },
    currency, exchangeRate: currency === 'USD' ? 3.75 : null,
    exchangeRateDate: '2026-11-13', originalTotal: 0, fiscalEntityId: 'fiscal',
  };
}

async function setup(browser, base, currency = 'PEN', mobile = false) {
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'America/Lima', viewport: { width: mobile ? 390 : 1440, height: 1000 } });
  await context.addInitScript(seed => {
    localStorage.setItem('token', 'fixture');
    if (!localStorage.getItem('inquival:purchases:new:draft:v1')) localStorage.setItem('inquival:purchases:new:draft:v1', JSON.stringify(seed));
  }, draft(currency));
  const writes = [], errors = [];
  await context.route('**/api/**', async route => {
    const request = route.request(), endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
    let data = [];
    if (request.method() !== 'GET') {
      assert.equal(request.method(), 'POST');
      assert.equal(endpoint, '/purchases');
      const payload = request.postDataJSON();
      writes.push(payload);
      data = { id: 'purchase', ...payload };
    } else if (endpoint === '/auth/me') data = { id: 'operator', role: 'ADMIN', fullName: 'Prueba', isActive: true };
    else if (endpoint === '/branches') data = [{ id: '000000000000000000000001', name: 'Principal', isActive: true, isDefault: true }];
    else if (endpoint === '/business-settings') data = {};
    else if (endpoint === '/companies') data = [{ id: 'warehouse', name: 'Almacén', isActive: true }];
    else if (endpoint === '/fiscal-entities') data = [{ id: 'fiscal', legalName: 'Empresa prueba', ruc: '20614419631', isActive: true, isDefault: true }];
    else if (endpoint === '/laboratories') data = [{ id: 'laboratory', name: 'Proveedor prueba', ruc: '20535703214', isActive: true }];
    else if (endpoint === '/payment-methods') data = [{ id: 'cash', name: 'Efectivo', isActive: true }];
    else if (endpoint === '/products') data = { data: [{ id: 'product', name: 'Producto prueba', unit: 'UND', taxType: 'GRAVADO', tracksLot: false, prices: [], isActive: true }], total: 1 };
    else if (endpoint === '/cash-register/today') data = { id: 'cash', status: 'OPEN' };
    else if (endpoint === '/accounts-payable/alerts') data = { overdue: [], upcoming: [] };
    else if (endpoint.includes('tipo-cambio')) data = { venta: 3.75, fecha: '2026-11-13', source: 'SUNAT' };
    else if (['/purchases', '/suppliers', '/clients', '/stock/lots/expiring'].includes(endpoint)) data = { data: [], total: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/purchases/new`);
  await page.getByRole('checkbox', { name: 'Registrar abono inicial / a cuenta' }).waitFor();
  return { context, page, writes, errors };
}

async function main() {
  const { createServer } = await import('vite');
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'inquival-initial-payment-vite-'));
  const server = await createServer({ root: path.resolve(__dirname, '..'), cacheDir, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    for (const currency of ['PEN', 'USD']) {
      for (const schedule of ['SINGLE_DATE', 'INSTALLMENTS']) {
        const f = await setup(browser, base, currency), { page } = f;
        await page.getByRole('checkbox', { name: 'Registrar abono inicial / a cuenta' }).check();
        await page.getByLabel(`Monto del abono (${currency})`, { exact: true }).fill('600');
        await page.getByLabel('Método de pago del abono').selectOption('cash');
        await page.getByLabel('Fecha del abono', { exact: true }).fill('2026-11-12');
        await page.getByLabel('N° de operación (opcional)').fill('OP-600');
        if (currency === 'USD') await page.getByLabel('Tipo de cambio del abono (S/ por US$ 1)').fill('3.75');
        await page.getByText(`${currency === 'USD' ? '$' : 'S/'} 400.00`, { exact: true }).first().waitFor();
        if (schedule === 'INSTALLMENTS') {
          await page.getByRole('button', { name: 'Letras / cuotas', exact: true }).click();
          await page.getByText('# de cuotas', { exact: true }).locator('..').getByRole('spinbutton').fill('2');
          await page.getByRole('button', { name: 'Generar', exact: true }).click();
          const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('inquival:purchases:new:draft:v1')));
          assert.deepEqual(stored.state.installments.map(i => i.amount), [200, 200]);
        }
        // Draft reload preserves the advance and the schedule without posting it.
        await page.reload();
        assert.equal(await page.getByLabel(`Monto del abono (${currency})`, { exact: true }).inputValue(), '600');
        assert.deepEqual(await page.locator('form').evaluate(form => [...form.querySelectorAll(':invalid')].map(input => ({ name: input.name, value: input.value, error: input.validationMessage }))), []);
        await page.getByRole('button', { name: 'Registrar Compra', exact: true }).click();
        await page.waitForURL(`${base}/purchases`);
        assert.equal(f.writes.length, 1);
        const payload = f.writes[0];
        assert.equal(payload.paymentType, 'CREDITO');
        assert.equal(payload.initialPayment.amount, 600);
        assert.equal(payload.initialPayment.paymentCurrency, currency);
        assert.equal(payload.initialPayment.paymentMethodId, 'cash');
        assert.equal(payload.initialPayment.paymentDate, '2026-11-12');
        assert.equal(payload.initialPayment.codigoTransferencia, 'OP-600');
        assert.equal(currency === 'USD' ? payload.totalCostUsd : payload.totalCost, 1000);
        assert.equal(payload.paymentScheduleType, schedule);
        if (schedule === 'INSTALLMENTS') assert.deepEqual(payload.installments.map(i => i.amount), [200, 200]);
        else assert.equal(payload.dueDate, '2026-12-20');
        assert.deepEqual(f.errors, []);
        await f.context.close();
        process.stdout.write(`PASS ${currency} / ${schedule}: advance, remaining balance, draft and single submit\n`);
      }
    }
    const f = await setup(browser, base, 'USD', true), { page } = f;
    await page.getByRole('checkbox', { name: 'Registrar abono inicial / a cuenta' }).check();
    await page.getByLabel('Moneda del abono').selectOption('PEN');
    await page.getByLabel('Monto del abono (PEN)', { exact: true }).fill('600');
    await page.getByLabel('Tipo de cambio del abono (S/ por US$ 1)').fill('3.75');
    await page.getByText('$ 840.00', { exact: true }).first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    // An advance that covers the total cannot create an accidental credit purchase.
    await page.getByLabel('Monto del abono (PEN)', { exact: true }).fill('3750');
    await page.getByRole('button', { name: 'Registrar Compra', exact: true }).click();
    await page.getByText('El abono inicial debe ser menor al saldo al proveedor. Para pagar todo, selecciona Contado', { exact: true }).waitFor();
    assert.equal(f.writes.length, 0);
    await page.getByLabel('Monto del abono (PEN)', { exact: true }).fill('600');
    await page.getByRole('button', { name: 'Registrar Compra', exact: true }).click();
    await page.waitForURL(`${base}/purchases`);
    assert.equal(f.writes[0].initialPayment.paymentCurrency, 'PEN');
    assert.equal(f.writes[0].initialPayment.amount, 600);
    assert.equal(f.writes[0].initialPayment.exchangeRate, 3.75);
    assert.deepEqual(f.errors, []);
    await f.context.close();
    process.stdout.write('PASS mobile USD invoice / PEN advance: conversion, layout, full-payment rejection and submit\n');
  } finally {
    await browser?.close();
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });

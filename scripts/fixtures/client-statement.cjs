// Fictional data for the PDF preview and financial presentation regression checks.
const client = { id: 'demo-client', name: 'Agro Comercial del Valle (EJEMPLO)', documentNumber: 'Datos ficticios', address: 'Dirección de ejemplo · Perú', isActive: true };
const now = new Date('2026-11-09T18:00:00.000Z');
const sale = (id, date, total, extra = {}) => ({
  id, clientId: client.id, date, createdAt: date, total, currency: 'PEN', voucherType: 'NONE',
  saleNumber: id, isCredit: true, items: [], payments: [], ...extra,
});
const item = (productName, quantity, unitPrice, extra = {}) => ({
  productId: productName, companyId: 'demo', productName, quantity, unitPrice,
  subtotal: quantity * unitPrice, priceTier: 'PUBLIC', ...extra,
});
const sales = [
  sale('NV-000127', '2026-10-28T00:00:00.000Z', 1500, {
    payments: [{ paymentMethodId: 'cash', paymentMethodName: 'Efectivo', amount: 300 }],
    items: [item('Abono granulado · saco de 50 kg', 3, 350), item('Fertilizante foliar · caja de 12 unidades', 1, 450)],
  }),
  sale('NV-000138', '2026-11-01T00:00:00.000Z', 600, { items: [item('Nutriente para cultivo · caja de 6 unidades', 2, 300)] }),
  sale('NV-000140', '2026-11-02T00:00:00.000Z', 240, {
    isCredit: false, payments: [{ paymentMethodId: 'cash', paymentMethodName: 'Efectivo', amount: 240 }],
    items: [item('Bioestimulante · botella de 1 litro', 2, 120)],
  }),
  sale('NV-000143', '2026-11-04T00:00:00.000Z', 1440, {
    currency: 'USD', exchangeRate: 3.6, totalUsd: 400,
    payments: [{ paymentMethodId: 'bank', paymentMethodName: 'Transferencia', amount: 360, amountUsd: 100 }],
    items: [item('Nutriente soluble importado · saco de 25 kg', 2, 720, { unitPriceUsd: 200, subtotalUsd: 400 })],
  }),
];
const credit = (id, totalAmount, paidAmount, extra = {}) => ({
  id, clientId: client.id, saleIds: [], totalAmount, paidAmount, pendingAmount: totalAmount - paidAmount,
  status: paidAmount === totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING',
  currency: 'PEN', payments: [], createdAt: '2026-10-28T00:00:00.000Z', ...extra,
});
const credits = [
  credit('grouped', 1800, 1100, {
    name: 'Campaña de noviembre', saleIds: ['NV-000127', 'NV-000138'], dueDate: '2026-11-05T00:00:00.000Z',
    payments: [
      { id: 'payment-2', amount: 600, paymentDate: '2026-11-09T00:00:00.000Z', paymentMethodName: 'Transferencia', notes: 'Segundo abono · operación de ejemplo 002' },
      { id: 'payment-1', amount: 500, paymentDate: '2026-11-03T00:00:00.000Z', paymentMethodName: 'Efectivo', notes: 'Primer abono · recibido en tienda' },
    ],
  }),
  credit('usd', 300, 100, {
    name: 'Compra en dólares', currency: 'USD', saleIds: ['NV-000143'], createdAt: '2026-11-04T00:00:00.000Z', dueDate: '2026-11-20T00:00:00.000Z',
    payments: [{ id: 'payment-usd', amount: 100, currency: 'USD', paymentDate: '2026-11-08T00:00:00.000Z', paymentMethodName: 'Transferencia', paymentCurrency: 'PEN', receivedAmount: 360, exchangeRate: 3.6, notes: 'Abono recibido en soles y aplicado en dólares' }],
  }),
  credit('historical', 1000, 1000, { name: 'Saldo anterior cancelado', createdAt: '2026-10-15T00:00:00.000Z' }),
];
module.exports = { client, sales, credits, now };

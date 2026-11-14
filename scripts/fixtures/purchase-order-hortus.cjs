const { fiscalEntity, companies } = require('./purchase-order.cjs');
const products = [
  { id: '000000000000000000000101', name: 'Zeamax x L', unit: 'LITRO', activeIngredient: 'Nicosulfuron 40 g/L', taxType: 'GRAVADO', prices: [], isActive: true },
  { id: '000000000000000000000102', name: 'Canciller x L', unit: 'LITRO', activeIngredient: 'Difenoconazole 250 gr/L', taxType: 'GRAVADO', prices: [], isActive: true },
];
const details = {
  supplierContact: 'Juan Caceda', supplierPhone: '993531796', quotationValidUntil: '2026-08-31',
  deliveryPlace: 'Calle Lindley s/n Urb Santa Rosa', deliveryAddress: 'CAL. LINDLEY NRO S/N URB. SANTA ROSA - MOCHE',
  transport: 'Transportista de prueba', transportAddress: 'Agencia de prueba',
  paymentForm: 'LETRA', creditDays: 120, requestedBy: 'Damer Quipuscoa', approvedBy: '',
};
const order = {
  id: '000000000000000000000201', orderNumber: 'OC-00000003', supplier: 'HORTUS S A', supplierRuc: '20101637221',
  fiscalEntityId: fiscalEntity.id, priceIncludesIgv: false, currency: 'USD', totalCost: 5280, totalCostUsd: 5280,
  issueDate: '2026-08-31', dueDate: '2026-12-29', paymentType: 'CREDITO', paymentScheduleType: 'SINGLE_DATE',
  status: 'PENDING', createdAt: '2026-08-31T05:00:00Z', updatedAt: '2026-11-13T05:00:00Z',
  items: [
    { productId: products[0].id, productName: products[0].name, description: products[0].activeIngredient, unit: 'LITRO', quantity: 120, unitPriceSinIgv: 9, unitPriceConIgv: 10.62, taxType: 'GRAVADO' },
    { productId: products[1].id, productName: products[1].name, description: products[1].activeIngredient, unit: 'LITRO', quantity: 120, unitPriceSinIgv: 16, unitPriceConIgv: 18.88, taxType: 'GRAVADO' },
    { productName: 'Sandia Santa Matilde x 1000 semillas', description: 'Producto solicitado fuera del catálogo', unit: 'UNIDAD', quantity: 20, unitPriceSinIgv: 87, unitPriceConIgv: 87, taxType: 'EXONERADO' },
  ],
  notes: `[OC_META]${JSON.stringify(details)}[/OC_META]`,
};
module.exports = { order, products, companies, details, fiscalEntity: { ...fiscalEntity, legalName: 'INVERSIONES QUIVAL S.A.C. - INQUIVAL S.A.C.', ruc: '20604522146' } };

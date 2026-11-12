const companyInfo = {
  legalName: 'INVERSIONES QUIVEN S.A.C.', ruc: '20614169631',
  address: 'Calle Lindley S/N Santa Rosa - Moche', phone: '908912508', salesEmail: 'ventas@example.com',
  bankAccounts: [
    { bank: 'BCP', currency: 'USD', accountNumber: 'CUENTA DE EJEMPLO USD', cci: 'CCI DE EJEMPLO USD', holder: 'EMPRESA DE EJEMPLO' },
    { bank: 'BCP', currency: 'PEN', accountNumber: 'CUENTA DE EJEMPLO PEN', cci: 'CCI DE EJEMPLO PEN', holder: 'EMPRESA DE EJEMPLO' },
  ],
  detraccionAccount: { bank: 'Banco de la Nación', accountNumber: 'CUENTA DE EJEMPLO' },
};
const client = {
  id: 'client', name: 'CORPORACIÓN DEL SUR S.A. - SUCURSAL PERÚ', documentNumber: '20123456789',
  address: 'Av. Principal 123 - Moche, Trujillo', phone: '900000000', email: 'cliente@example.com', isActive: true,
};
const products = [{ id: 'product', name: 'Rapibrot x 4 L', unit: 'GALÓN', taxType: 'GRAVADO', isActive: true, prices: [] }];
const vendor = { name: 'Vendedor de ejemplo', phone: '900000001', email: 'asesor@example.com' };
const quote = {
  id: 'quote', quoteNumber: 'COT-00000011', series: 'COT', number: 11, clientId: client.id,
  clientName: client.name, clientDocumentNumber: client.documentNumber, clientContact: 'Contacto de ejemplo',
  clientPhone: client.phone, clientEmail: client.email, clientAddress: client.address,
  sellerId: 'seller', sellerName: vendor.name, createdBy: 'seller',
  currency: 'USD', paymentMethod: 'CRÉDITO', creditDays: 30, paymentScheduleType: 'SINGLE_DATE',
  issueDate: '2026-11-12', validUntil: '2026-11-27', deliveryTime: 'INMEDIATO', deliveryPlace: client.address,
  notes: 'Coordinar la entrega con el contacto indicado.', internalNotes: 'Información interna que no debe imprimirse.',
  total: 159.3, status: 'PENDING',
  items: [{ productId: 'product', companyId: 'warehouse', quantity: 6, unitPrice: 26.55, subtotal: 159.3, priceTier: 'price' }],
};
module.exports = { companyInfo, client, products, vendor, quote };

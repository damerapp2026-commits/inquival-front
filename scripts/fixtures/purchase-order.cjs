const details = {
  supplierContact: 'Carlos Cabrera', supplierPhone: '900000000',
  quotationValidUntil: '2026-11-20', deliveryPlace: '',
  deliveryAddress: 'CAL. LINDLEY NRO S/N URB. SANTA ROSA',
  transport: 'Directo (a cargo del proveedor)', transportAddress: '',
  paymentForm: 'LETRA', creditDays: 45,
  requestedBy: 'Área de compras', approvedBy: '',
};
const products = [
  { id: 'hazal', name: 'Hazal x L', activeIngredient: '2,4-D 720 gr/L', unit: 'LITRO', taxType: 'GRAVADO', prices: [], isActive: true },
  { id: 'aplasto', name: 'A_plasto x L', activeIngredient: 'Ametrina 500 gr/L', unit: 'LITRO', taxType: 'GRAVADO', prices: [], isActive: true },
];
const companies = [{ id: 'warehouse', name: 'Almacén 2', address: details.deliveryAddress, isActive: true }];
const fiscalEntity = {
  id: 'fiscal', legalName: 'INVERSIONES QUIVEN S.A.C.', ruc: '20614419631',
  address: details.deliveryAddress, isDefault: true, isActive: true,
};
const order = {
  id: 'example', orderNumber: 'OC-00000001', companyId: 'warehouse', fiscalEntityId: 'fiscal',
  supplier: 'AVGUST PERU S.A.C.', supplierRuc: '20535703214',
  currency: 'USD', totalCost: 1240, totalCostUsd: 1240,
  issueDate: '2026-11-12', dueDate: '2026-12-27', paymentType: 'CREDITO',
  paymentScheduleType: 'SINGLE_DATE', status: 'PENDING', createdAt: '2026-11-12T15:00:00Z',
  items: [
    { companyId: 'warehouse', productId: 'hazal', quantity: 200, unitCost: 3.2, unitPriceConIgv: 3.2, unitPriceSinIgv: 2.71 },
    { companyId: 'warehouse', productId: 'aplasto', quantity: 120, unitCost: 5, unitPriceConIgv: 5, unitPriceSinIgv: 4.24 },
  ],
  notes: `[OC_META]${JSON.stringify(details)}[/OC_META]\nCoordinar la entrega con el área de compras.`,
};
module.exports = { order, products, companies, fiscalEntity, details };

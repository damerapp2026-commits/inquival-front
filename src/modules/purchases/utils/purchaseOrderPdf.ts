import { COMPANY_INFO } from '../../../config/companyInfo';
import type { Company, FiscalEntity, Product, PurchaseOrder } from '../../../shared/types';
import { numberToWords } from '../../quotes/utils/numberToWords';
import { getPurchaseOrderDetails } from './purchaseOrderDetails';

let pdfMakePromise: Promise<any> | null = null;
function loadPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]).then(([pdfMakeMod, pdfFontsMod]) => {
      const pdfMake: any = (pdfMakeMod as any).default || pdfMakeMod;
      const pdfFonts: any = (pdfFontsMod as any).default || pdfFontsMod;
      const vfs = pdfFonts.vfs || pdfFonts.pdfMake?.vfs || pdfFonts;
      if (typeof pdfMake.addVirtualFileSystem === 'function') pdfMake.addVirtualFileSystem(vfs);
      else pdfMake.vfs = vfs;
      return pdfMake;
    });
  }
  return pdfMakePromise;
}

let logoPromise: Promise<string | null> | null = null;
function loadLogoDataUrl(): Promise<string | null> {
  if (!logoPromise) {
    logoPromise = fetch(COMPANY_INFO.logoUrl)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error('logo not found'))))
      .then((blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .catch(() => null);
  }
  return logoPromise;
}

interface PurchaseOrderPdfParams {
  order: PurchaseOrder;
  products: Product[];
  companies: Company[];
  fiscalEntity?: FiscalEntity;
}

interface BuildParams extends PurchaseOrderPdfParams {
  logoDataUrl?: string | null;
}

const BRAND_BLUE = '#25638c';
const BRAND_BLUE_DARK = '#174766';
const SECTION_FILL = '#dbe5ec';
const BORDER_GRAY = '#94a3b8';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#64748b';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const formatDate = (value?: string | Date) => {
  if (!value) return '—';
  const raw = value instanceof Date ? value.toISOString() : value;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
};

const selected = (active: boolean) => active ? '[X]' : '[ ]';

const borderedLayout = {
  hLineColor: () => BORDER_GRAY,
  vLineColor: () => BORDER_GRAY,
  hLineWidth: () => 0.8,
  vLineWidth: () => 0.8,
  paddingTop: () => 3,
  paddingBottom: () => 3,
  paddingLeft: () => 4,
  paddingRight: () => 4,
};

function buildDocDefinition({ order, products, companies, fiscalEntity, logoDataUrl }: BuildParams) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const details = getPurchaseOrderDetails(order);
  const currency = order.currency || (order.totalCostUsd != null ? 'USD' : 'PEN');
  const symbol = currency === 'USD' ? 'US$' : 'S/';
  const total = roundMoney(currency === 'USD' && order.totalCostUsd != null ? order.totalCostUsd : order.totalCost);
  const headerName = fiscalEntity?.legalName || COMPANY_INFO.legalName || 'EMPRESA';
  const headerRuc = fiscalEntity?.ruc || COMPANY_INFO.ruc || '—';
  const headerAddress = fiscalEntity?.address || COMPANY_INFO.address || '';
  const warehouses = [...new Set(order.items.map((item) => item.companyId || order.companyId).filter(Boolean))]
    .map((id) => companyById.get(id))
    .filter((company): company is Company => !!company);
  const warehouseNames = warehouses.map((company) => company.name).join(', ') || 'Almacén indicado por línea';
  const warehouseAddresses = warehouses.map((company) => company.address).filter(Boolean).join(' / ');
  const deliveryPlace = details.deliveryPlace || warehouseNames;
  const deliveryAddress = details.deliveryAddress || warehouseAddresses || headerAddress || 'Por coordinar';
  const transport = details.transport || 'Directo (a cargo del proveedor)';
  const statusLabel: Record<string, string> = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobada',
    CANCELLED: 'Cancelada',
    CONVERTED: 'Convertida',
  };

  let taxableGross = 0;
  let nonTaxableGross = 0;
  const rows = order.items.map((item, index) => {
    const product = productById.get(item.productId);
    const company = companyById.get(item.companyId || order.companyId);
    const unitPrice = Number(item.unitPriceConIgv ?? item.unitCost ?? item.unitPriceSinIgv ?? 0);
    const lineTotal = roundMoney(item.quantity * unitPrice);
    const isTaxable = !product?.taxType || product.taxType === 'GRAVADO';
    if (isTaxable) taxableGross += lineTotal;
    else nonTaxableGross += lineTotal;
    return [
      { text: String(index + 1).padStart(2, '0'), alignment: 'center', fontSize: 7.5 },
      {
        stack: [
          { text: product?.name || item.productId, fontSize: 8, bold: true, color: TEXT_DARK },
          { text: product?.activeIngredient || product?.description || ' ', fontSize: 7, color: TEXT_MUTED },
        ],
      },
      { text: company?.name || '—', fontSize: 7.5 },
      { text: item.quantity.toFixed(2), alignment: 'center', fontSize: 7.5 },
      { text: (product?.unit || 'UND').toUpperCase().slice(0, 8), alignment: 'center', fontSize: 7.5 },
      { text: `${symbol} ${unitPrice.toFixed(2)}`, alignment: 'right', fontSize: 7.5 },
      { text: `${symbol} ${lineTotal.toFixed(2)}`, alignment: 'right', fontSize: 7.5, bold: true },
    ];
  });

  while (rows.length < 4) {
    rows.push([
      { text: ' ', alignment: 'center', fontSize: 7.5 },
      { text: ' ', fontSize: 7.5 },
      { text: ' ', fontSize: 7.5 },
      { text: ' ', alignment: 'center', fontSize: 7.5 },
      { text: ' ', alignment: 'center', fontSize: 7.5 },
      { text: ' ', alignment: 'right', fontSize: 7.5 },
      { text: ' ', alignment: 'right', fontSize: 7.5 },
    ]);
  }

  const calculatedGross = roundMoney(taxableGross + nonTaxableGross);
  const effectiveTaxableGross = calculatedGross > 0 && Math.abs(calculatedGross - total) > 0.02
    ? roundMoney(taxableGross * (total / calculatedGross))
    : roundMoney(taxableGross);
  const effectiveNonTaxableGross = roundMoney(total - effectiveTaxableGross);
  const taxableBase = roundMoney(effectiveTaxableGross / 1.18);
  const subtotal = roundMoney(taxableBase + effectiveNonTaxableGross);
  const igv = roundMoney(total - subtotal);
  const creditDays = details.creditDays ? `${details.creditDays} días` : '—';
  const paymentType = order.paymentType || 'CONTADO';
  const paymentForm = details.paymentForm || 'CONTADO';

  return {
    pageSize: 'A4',
    pageMargins: [32, 28, 32, 34],
    content: [
      {
        columns: [
          {
            width: '*',
            columns: [
              ...(logoDataUrl ? [{ image: logoDataUrl, width: 78, margin: [0, 0, 12, 0] } as any] : []),
              {
                width: '*',
                stack: [
                  { text: headerName.toUpperCase(), bold: true, fontSize: 13, color: TEXT_DARK, margin: [0, 3, 0, 2] },
                  { text: `RUC: ${headerRuc}`, fontSize: 7.5, color: TEXT_DARK },
                  ...(headerAddress ? [{ text: headerAddress, fontSize: 7.5, color: TEXT_DARK }] : []),
                  ...(COMPANY_INFO.phone ? [{ text: `Tel. ${COMPANY_INFO.phone}`, fontSize: 7.5, color: TEXT_DARK }] : []),
                ],
              },
            ],
          },
          {
            width: 190,
            table: {
              widths: ['*'],
              body: [
                [{ text: `RUC: ${headerRuc}`, alignment: 'right', bold: true, fontSize: 8, color: 'white', fillColor: BRAND_BLUE, margin: [4, 1] }],
                [{ text: 'ORDEN DE COMPRA', alignment: 'center', bold: true, fontSize: 15, color: TEXT_DARK, margin: [3, 4, 3, 1] }],
                [{ text: order.orderNumber, alignment: 'center', bold: true, fontSize: 10, color: TEXT_DARK }],
                [{ text: statusLabel[order.status] || order.status, alignment: 'center', fontSize: 8, color: order.status === 'CANCELLED' ? '#dc2626' : BRAND_BLUE_DARK, margin: [3, 0, 3, 4] }],
              ],
            },
            layout: borderedLayout,
          },
        ],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 531, y2: 0, lineWidth: 1.2, lineColor: BRAND_BLUE_DARK }],
        margin: [0, 8, 0, 6],
      },
      {
        table: {
          widths: [75, '*', 55, 115],
          body: [
            [{ text: 'PROVEEDOR', colSpan: 4, style: 'sectionTitle' }, {}, {}, {}],
            [{ text: 'Nombre/Razón Social:', style: 'dataLabel' }, { text: order.supplier, colSpan: 3, style: 'dataValue' }, {}, {}],
            [{ text: 'RUC:', style: 'dataLabel' }, { text: order.supplierRuc || '—', colSpan: 3, style: 'dataValue' }, {}, {}],
            [{ text: 'Contacto:', style: 'dataLabel' }, { text: details.supplierContact || '—', style: 'dataValue' }, { text: 'Teléfono:', style: 'dataLabel' }, { text: details.supplierPhone || '—', style: 'dataValue' }],
          ],
        },
        layout: borderedLayout,
      },
      { text: '', margin: [0, 2] },
      {
        table: {
          widths: [95, '*', 145, '*'],
          body: [
            [{ text: 'FECHA Y MONEDA', colSpan: 4, style: 'sectionTitle' }, {}, {}, {}],
            [{ text: 'Fecha de emisión:', style: 'dataLabel' }, { text: formatDate(order.issueDate || order.createdAt), style: 'dataValue' }, { text: 'Vencimiento de cotización:', style: 'dataLabel' }, { text: formatDate(details.quotationValidUntil), style: 'dataValue' }],
            [{ text: 'Moneda:', style: 'dataLabel' }, { text: currency === 'USD' ? 'USD — Dólares americanos' : 'PEN — Soles', colSpan: 3, style: 'dataValue' }, {}, {}],
          ],
        },
        layout: borderedLayout,
      },
      { text: '', margin: [0, 2] },
      {
        table: {
          widths: [95, '*'],
          body: [
            [{ text: 'PUNTO DE LLEGADA', colSpan: 2, style: 'sectionTitle' }, {}],
            [{ text: 'Entrega / destino:', style: 'dataLabel' }, { text: deliveryPlace, style: 'dataValue' }],
            [{ text: 'Almacén:', style: 'dataLabel' }, { text: warehouseNames, style: 'dataValue' }],
            [{ text: 'Dirección:', style: 'dataLabel' }, { text: deliveryAddress, style: 'dataValue' }],
            [{ text: 'Transporte:', style: 'dataLabel' }, { text: transport, style: 'dataValue' }],
          ],
        },
        layout: borderedLayout,
      },
      { text: '', margin: [0, 2] },
      {
        table: {
          widths: [95, '*'],
          body: [
            [{ text: 'CONDICIONES DE PAGO', colSpan: 2, style: 'sectionTitle' }, {}],
            [{ text: 'Forma de pago:', style: 'dataLabel' }, { text: `${selected(paymentForm === 'CONTADO')} Contado     ${selected(paymentForm === 'LETRA')} Letra     ${selected(paymentForm === 'FACTURA')} Factura`, style: 'dataValue' }],
            [{ text: 'Condición:', style: 'dataLabel' }, { text: `${selected(paymentType === 'CONTADO')} Contado     ${selected(paymentType === 'CREDITO')} Crédito`, style: 'dataValue' }],
            [{ text: 'Plazo:', style: 'dataLabel' }, { text: `${selected(details.creditDays === 30)} 30 días     ${selected(details.creditDays === 60)} 60 días     ${selected(details.creditDays === 150)} 150 días     Vencimiento: ${formatDate(order.dueDate)} (${creditDays})`, style: 'dataValue' }],
          ],
        },
        layout: borderedLayout,
      },
      { text: '', margin: [0, 2] },
      {
        table: {
          widths: [95, '*', 95, 115],
          body: [
            [{ text: 'DATOS DE FACTURACIÓN', colSpan: 4, style: 'sectionTitle' }, {}, {}, {}],
            [{ text: 'Empresa receptora:', style: 'dataLabel' }, { text: headerName, style: 'dataValue' }, { text: 'RUC receptora:', style: 'dataLabel' }, { text: headerRuc, style: 'dataValue' }],
          ],
        },
        layout: borderedLayout,
      },
      { text: '', margin: [0, 3] },
      {
        table: {
          headerRows: 1,
          widths: [24, '*', 73, 34, 35, 55, 61],
          body: [
            [
              { text: 'ÍTEM', style: 'thead' },
              { text: 'DESCRIPCIÓN', style: 'thead' },
              { text: 'ALMACÉN', style: 'thead' },
              { text: 'CANT.', style: 'thead' },
              { text: 'U.M.', style: 'thead' },
              { text: 'P. UNIT.', style: 'thead' },
              { text: 'IMPORTE', style: 'thead' },
            ],
            ...rows,
          ],
        },
        layout: {
          ...borderedLayout,
          fillColor: (row: number) => row === 0 ? SECTION_FILL : null,
        },
      },
      { text: `Son: ${numberToWords(total, currency).toLowerCase()}.`, fontSize: 7.5, color: TEXT_DARK, margin: [0, 5, 0, 3] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'NOTAS IMPORTANTES', bold: true, fontSize: 8, color: TEXT_DARK, margin: [0, 0, 0, 2] },
              { text: '1. Toda guía de remisión o factura deberá incluir el N.° de la orden de compra correspondiente.', fontSize: 7 },
              { text: '2. Los productos con fecha de vencimiento deberán mantener más de un año de vida útil, salvo indicación distinta.', fontSize: 7 },
              { text: '3. La entrega posterior a la fecha acordada podrá ser rechazada.', fontSize: 7 },
              { text: '4. No se aceptará mercadería cuyos precios no figuren en la orden de compra.', fontSize: 7 },
              ...(details.observations ? [{ text: `Observaciones: ${details.observations}`, fontSize: 7, bold: true, margin: [0, 3, 0, 0] }] : []),
            ],
          },
          { width: 10, text: '' },
          {
            width: 185,
            table: {
              widths: ['*', 70],
              body: [
                [{ text: 'RESTRICCIONES Y RESUMEN', colSpan: 2, style: 'sectionTitle' }, {}],
                [{ text: 'Subtotal', fontSize: 8 }, { text: `${symbol} ${subtotal.toFixed(2)}`, alignment: 'right', fontSize: 8 }],
                [{ text: 'I.G.V. (18%)', fontSize: 8 }, { text: `${symbol} ${igv.toFixed(2)}`, alignment: 'right', fontSize: 8 }],
                [{ text: 'Total estimado', bold: true, fontSize: 8.5 }, { text: `${symbol} ${total.toFixed(2)}`, alignment: 'right', bold: true, fontSize: 8.5 }],
              ],
            },
            layout: borderedLayout,
          },
        ],
      },
      { text: '', margin: [0, 12] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: details.requestedBy || ' ', alignment: 'center', bold: true, fontSize: 8, margin: [0, 0, 0, 2] },
              { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 190, y2: 0, lineWidth: 0.7, lineColor: BORDER_GRAY }] },
              { text: 'Solicitado por', alignment: 'center', fontSize: 7.5, color: TEXT_MUTED, margin: [0, 3, 0, 0] },
            ],
          },
          {
            width: '*',
            stack: [
              { text: details.approvedBy || ' ', alignment: 'center', bold: true, fontSize: 8, margin: [0, 0, 0, 2] },
              { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 190, y2: 0, lineWidth: 0.7, lineColor: BORDER_GRAY }] },
              { text: 'Aprobado por', alignment: 'center', fontSize: 7.5, color: TEXT_MUTED, margin: [0, 3, 0, 0] },
            ],
          },
        ],
      },
    ],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: order.orderNumber, color: TEXT_MUTED, fontSize: 7 },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: TEXT_MUTED, fontSize: 7 },
      ],
      margin: [32, 0, 32, 14],
    }),
    styles: {
      sectionTitle: { bold: true, color: TEXT_DARK, fillColor: SECTION_FILL, fontSize: 8, margin: [1, 1] },
      dataLabel: { bold: true, fontSize: 7.5, color: TEXT_DARK },
      dataValue: { fontSize: 7.5, color: TEXT_DARK },
      thead: { bold: true, color: TEXT_DARK, fontSize: 7.5, alignment: 'center' },
    },
    defaultStyle: { fontSize: 8 },
  };
}

export async function downloadPurchaseOrderPdf(params: PurchaseOrderPdfParams) {
  const [pdfMake, logoDataUrl] = await Promise.all([loadPdfMake(), loadLogoDataUrl()]);
  pdfMake.createPdf(buildDocDefinition({ ...params, logoDataUrl })).download(`${params.order.orderNumber}.pdf`);
}

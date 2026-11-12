import { formatDateEs } from '../../../shared/utils/date.util';
import { COMPANY_INFO } from '../../../config/companyInfo';
import type { Company, FiscalEntity, Product, PurchaseOrder } from '../../../shared/types';
import { numberToWords } from '../../quotes/utils/numberToWords';
import { getPurchaseOrderDetails, PURCHASE_ORDER_CONDITIONS } from './purchaseOrderDetails';
import { purchaseOrderAmounts } from './purchaseOrderAmounts';

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

const BRAND_GREEN = '#537c36';
const BRAND_GREEN_DARK = '#365424';
const SECTION_FILL = '#eef3e9';
const BORDER_GRAY = '#94a3b8';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#64748b';

const formatDate = (value?: string | Date) =>
  formatDateEs(value, { day: '2-digit', month: '2-digit', year: 'numeric' }) || '—';

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

export function buildPurchaseOrderPdfDefinition({ order, products, companies, fiscalEntity, logoDataUrl }: BuildParams) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const details = getPurchaseOrderDetails(order);
  const { currency, lines, subtotal, igv, total } = purchaseOrderAmounts(order, products);
  const symbol = currency === 'USD' ? 'US$' : 'S/';
  const headerName = fiscalEntity?.legalName || COMPANY_INFO.legalName || 'EMPRESA';
  const headerRuc = fiscalEntity?.ruc || COMPANY_INFO.ruc || '—';
  const headerAddress = fiscalEntity?.address || COMPANY_INFO.address || '';
  const warehouses = [...new Set(order.items.map((item) => item.companyId || order.companyId).filter(Boolean))]
    .map((id) => companyById.get(id))
    .filter((company): company is Company => !!company);
  const warehouseNames = warehouses.map((company) => company.name).join(', ');
  const warehouseAddresses = warehouses.map((company) => company.address).filter(Boolean).join(' / ');
  const deliveryPlace = details.deliveryPlace === warehouseNames ? '' : details.deliveryPlace;
  const deliveryAddress = details.deliveryAddress || warehouseAddresses || headerAddress || 'Por coordinar';
  const transport = details.transport || 'Directo (a cargo del proveedor)';
  const statusLabel: Record<string, string> = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobada',
    CANCELLED: 'Cancelada',
    CONVERTED: 'Convertida',
  };

  const rows = order.items.map((item, index) => {
    const product = productById.get(item.productId);
    const line = lines[index];
    return [
      { text: String(index + 1).padStart(2, '0'), alignment: 'center', fontSize: 7.5 },
      {
        stack: [
          { text: product?.name || item.productId, fontSize: 8, bold: true, color: TEXT_DARK },
          { text: product?.activeIngredient || product?.description || ' ', fontSize: 7, color: TEXT_MUTED },
        ],
      },
      { text: item.quantity.toFixed(2), alignment: 'center', fontSize: 7.5 },
      { text: (product?.unit || 'UND').toUpperCase().slice(0, 8), alignment: 'center', fontSize: 7.5 },
      { text: `${symbol} ${line.unitPrice.toFixed(2)}`, alignment: 'right', fontSize: 7.5 },
      { text: `${symbol} ${line.igv.toFixed(2)}`, alignment: 'right', fontSize: 7.5 },
      { text: `${symbol} ${line.total.toFixed(2)}`, alignment: 'right', fontSize: 7.5, bold: true },
    ];
  });

  while (rows.length < 4) {
    rows.push([
      { text: ' ', alignment: 'center', fontSize: 7.5 },
      { text: ' ', alignment: 'left', fontSize: 7.5 },
      { text: ' ', alignment: 'center', fontSize: 7.5 },
      { text: ' ', alignment: 'center', fontSize: 7.5 },
      { text: ' ', alignment: 'center', fontSize: 7.5 },
      { text: ' ', alignment: 'right', fontSize: 7.5 },
      { text: ' ', alignment: 'right', fontSize: 7.5 },
    ]);
  }

  const creditDays = details.creditDays ? `${details.creditDays} días` : '—';
  const paymentType = order.paymentType || 'CONTADO';
  const paymentForm = details.paymentForm.charAt(0) + details.paymentForm.slice(1).toLowerCase();
  const paymentCondition = paymentType === 'CREDITO' ? 'Crédito' : paymentType === 'BONIFICACION' ? 'Bonificación' : 'Contado';

  const info = (label: string, value: string) => ({ stack: [
    { text: label, style: 'dataLabel', margin: [0, 0, 0, 2] },
    { text: value, style: 'dataValue' },
  ], margin: [2, 2] });

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
                  { text: 'EMPRESA RECEPTORA', fontSize: 7, color: BRAND_GREEN_DARK, bold: true, margin: [0, 2, 0, 3] },
                  { text: headerName.toUpperCase(), bold: true, fontSize: 12, color: TEXT_DARK, margin: [0, 0, 0, 3] },
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
                [{ text: `RUC: ${headerRuc}`, alignment: 'center', bold: true, fontSize: 10, color: BRAND_GREEN_DARK, fillColor: SECTION_FILL, margin: [4, 2] }],
                [{ text: 'ORDEN DE COMPRA', alignment: 'center', bold: true, fontSize: 15, color: BRAND_GREEN_DARK, margin: [3, 4, 3, 1] }],
                [{ text: order.orderNumber, alignment: 'center', bold: true, fontSize: 10, color: TEXT_DARK }],
                [{ text: statusLabel[order.status] || order.status, alignment: 'center', fontSize: 8, color: order.status === 'CANCELLED' ? '#dc2626' : BRAND_GREEN_DARK, margin: [3, 0, 3, 4] }],
              ],
            },
            layout: borderedLayout,
          },
        ],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 531, y2: 0, lineWidth: 1.2, lineColor: BRAND_GREEN }],
        margin: [0, 8, 0, 6],
      },
      {
        columns: [
          {
            width: '*',
            table: { widths: ['*'], body: [
              [{ text: 'PROVEEDOR', style: 'sectionTitle' }],
              [{ stack: [
                { text: order.supplier, bold: true, fontSize: 9, margin: [0, 1, 0, 3] },
                { text: `RUC: ${order.supplierRuc || '—'}`, style: 'dataValue', margin: [0, 0, 0, 3] },
                { text: `Contacto: ${details.supplierContact || '—'}`, style: 'dataValue', margin: [0, 0, 0, 3] },
                { text: `Teléfono: ${details.supplierPhone || '—'}`, style: 'dataValue' },
              ], margin: [2, 2] }],
            ] }, layout: borderedLayout,
          },
          { width: 12, text: '' },
          {
            width: '*',
            table: { widths: ['*'], body: [
              [{ text: 'PUNTO DE LLEGADA', style: 'sectionTitle' }],
              [{ stack: [
                ...(deliveryPlace ? [{ text: deliveryPlace, bold: true, fontSize: 9, margin: [0, 1, 0, 4] }] : []),
                { text: deliveryAddress, style: 'dataValue', margin: [0, 2, 0, 4] },
              ], margin: [2, 2] }],
            ] }, layout: borderedLayout,
          },
        ],
      },
      { text: '', margin: [0, 4] },
      {
        table: {
          widths: ['*', '*', '*'],
          body: [
            [info('Fecha de pedido', formatDate(order.issueDate || order.createdAt)), info('Moneda', currency === 'USD' ? 'USD — Dólares americanos' : 'PEN — Soles'), info('Condición', paymentCondition)],
            [info('Forma de pago', paymentForm), info('Plazo', paymentType === 'CREDITO' ? creditDays : 'Al contado'), info('Vencimiento de pago', paymentType === 'CREDITO' ? formatDate(order.dueDate) : '—')],
            ...(details.quotationValidUntil ? [[{ ...info('Vencimiento de cotización', formatDate(details.quotationValidUntil)), colSpan: 3 }, {}, {}]] : []),
          ],
        },
        layout: borderedLayout,
      },
      { text: 'PRODUCTOS SOLICITADOS', bold: true, fontSize: 9, color: BRAND_GREEN_DARK, margin: [0, 10, 0, 5] },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [24, '*', 38, 32, 62, 57, 66],
          body: [
            [
              { text: 'ÍTEM', style: 'thead' },
              { text: 'DESCRIPCIÓN', style: 'thead' },
              { text: 'CANT.', style: 'thead' },
              { text: 'U.M.', style: 'thead' },
              { text: 'P. UNIT.\nCON IGV', style: 'thead' },
              { text: 'IGV\nINCLUIDO', style: 'thead' },
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
      { text: 'Precios e importes incluyen IGV cuando corresponde.', fontSize: 7, color: TEXT_MUTED, margin: [0, 4, 0, 0] },
      { text: `Son: ${numberToWords(total, currency).toLowerCase()}.`, fontSize: 7.5, color: TEXT_DARK, margin: [0, 5, 0, 3] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'TRANSPORTE Y OBSERVACIONES', bold: true, fontSize: 8, color: BRAND_GREEN_DARK, margin: [0, 0, 0, 4] },
              { text: `Transporte: ${transport}`, fontSize: 7.5, margin: [0, 0, 0, 3] },
              ...(details.transportAddress ? [{ text: `Dirección del transportista: ${details.transportAddress}`, fontSize: 7.5, margin: [0, 0, 0, 3] }] : []),
              ...(details.observations ? [{ text: `Observaciones: ${details.observations}`, fontSize: 7, bold: true, margin: [0, 3, 0, 0] }] : []),
            ],
          },
          { width: 10, text: '' },
          {
            width: 185,
            table: {
              widths: ['*', 70],
              body: [
                [{ text: 'RESUMEN', colSpan: 2, style: 'sectionTitle' }, {}],
                [{ text: 'Subtotal', fontSize: 8 }, { text: `${symbol} ${subtotal.toFixed(2)}`, alignment: 'right', fontSize: 8 }],
                [{ text: 'I.G.V. (18%)', fontSize: 8 }, { text: `${symbol} ${igv.toFixed(2)}`, alignment: 'right', fontSize: 8 }],
                [{ text: 'Total estimado', bold: true, fontSize: 8.5 }, { text: `${symbol} ${total.toFixed(2)}`, alignment: 'right', bold: true, fontSize: 8.5 }],
              ],
            },
            layout: borderedLayout,
          },
        ],
      },
      {
        stack: [
          { text: 'CONDICIONES DE ENTREGA', bold: true, fontSize: 8, color: BRAND_GREEN_DARK, margin: [0, 0, 0, 4] },
          ...PURCHASE_ORDER_CONDITIONS.map((condition, index) => ({ text: `${index + 1}. ${condition}`, fontSize: 7.5, margin: [0, 0, 0, 3] })),
        ],
        margin: [0, 12, 0, 4],
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
  await pdfMake.createPdf(buildPurchaseOrderPdfDefinition({ ...params, logoDataUrl })).download(`${params.order.orderNumber}.pdf`);
}

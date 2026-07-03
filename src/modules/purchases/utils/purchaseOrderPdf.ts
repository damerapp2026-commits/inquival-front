import { COMPANY_INFO } from '../../../config/companyInfo';
import type { Company, FiscalEntity, Product, PurchaseOrder } from '../../../shared/types';

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
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('logo not found'))))
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

const BRAND_GREEN = '#16a34a';
const BRAND_GREEN_DARK = '#15803d';
const BORDER_GRAY = '#cbd5e1';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#64748b';

const formatDate = (value?: string | Date) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function buildDocDefinition({ order, products, companies, fiscalEntity, logoDataUrl }: BuildParams) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const currency = order.currency || (order.totalCostUsd != null ? 'USD' : 'PEN');
  const symbol = currency === 'USD' ? 'US$' : 'S/';
  const total = currency === 'USD' && order.totalCostUsd != null ? order.totalCostUsd : order.totalCost;
  const headerName = fiscalEntity?.legalName || COMPANY_INFO.legalName || 'EMPRESA';
  const headerRuc = fiscalEntity?.ruc || COMPANY_INFO.ruc || '—';
  const headerAddress = fiscalEntity?.address || COMPANY_INFO.address || '';
  const firstCompany = order.items.find((item) => item.companyId)?.companyId || order.companyId;
  const deliveryCompany = firstCompany ? companyById.get(firstCompany) : undefined;
  const statusLabel: Record<string, string> = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobada',
    CANCELLED: 'Cancelada',
    CONVERTED: 'Convertida',
  };
  const orderBoxLayout = {
    hLineColor: () => BORDER_GRAY,
    vLineColor: () => BORDER_GRAY,
    hLineWidth: () => 1,
    vLineWidth: () => 1,
    paddingTop: () => 0,
    paddingBottom: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 0,
  };

  const rows = order.items.map((item, idx) => {
    const product = productById.get(item.productId);
    const company = item.companyId ? companyById.get(item.companyId) : undefined;
    const unitPrice = item.unitCost ?? item.unitPriceConIgv ?? item.unitPriceSinIgv ?? 0;
    const subtotal = Math.round(item.quantity * unitPrice * 100) / 100;
    return [
      { text: String(idx + 1).padStart(2, '0'), alignment: 'center', fontSize: 8, color: TEXT_MUTED },
      {
        stack: [
          { text: product?.name || item.productId, fontSize: 8.5, bold: true, color: TEXT_DARK },
          { text: product?.activeIngredient || product?.description || ' ', fontSize: 7, color: TEXT_MUTED },
        ],
      },
      { text: company?.name || item.companyId || '—', fontSize: 8 },
      { text: item.quantity.toFixed(2), alignment: 'center', fontSize: 8, bold: true },
      { text: (product?.unit || 'UND').toUpperCase().slice(0, 5), alignment: 'center', fontSize: 8 },
      { text: `${symbol} ${unitPrice.toFixed(2)}`, alignment: 'right', fontSize: 8 },
      { text: `${symbol} ${subtotal.toFixed(2)}`, alignment: 'right', fontSize: 8, bold: true },
    ];
  });

  while (rows.length < 8) {
    rows.push([
      { text: ' ', alignment: 'center', fontSize: 8 },
      { text: ' ', fontSize: 8 },
      { text: ' ', fontSize: 8 },
      { text: ' ', alignment: 'center', fontSize: 8 },
      { text: ' ', alignment: 'center', fontSize: 8 },
      { text: ' ', alignment: 'right', fontSize: 8 },
      { text: ' ', alignment: 'right', fontSize: 8 },
    ]);
  }

  return {
    pageSize: 'A4',
    pageMargins: [34, 32, 34, 34],
    content: [
      {
        columns: [
          {
            width: '*',
            columns: [
              ...(logoDataUrl ? [{ image: logoDataUrl, width: 62, margin: [0, 0, 12, 0] } as any] : []),
              {
                width: '*',
                stack: [
                  { text: headerName, style: 'companyName' },
                  { text: `RUC ${headerRuc}`, style: 'companyDetail' },
                  ...(headerAddress ? [{ text: headerAddress, style: 'companyDetail' }] : []),
                  ...(COMPANY_INFO.phone ? [{ text: `Tel. ${COMPANY_INFO.phone}`, style: 'companyDetail' }] : []),
                  ...(COMPANY_INFO.email ? [{ text: COMPANY_INFO.email, style: 'companyDetail' }] : []),
                ],
              },
            ],
          },
          {
            width: 190,
            stack: [
              { text: 'ORDEN DE COMPRA', alignment: 'right', bold: true, fontSize: 20, color: BRAND_GREEN_DARK },
              { text: order.orderNumber, alignment: 'right', bold: true, fontSize: 13, color: TEXT_DARK, margin: [0, 4, 0, 0] },
              {
                text: statusLabel[order.status] || order.status,
                alignment: 'right',
                fontSize: 9,
                bold: true,
                color: order.status === 'CANCELLED' ? '#dc2626' : order.status === 'CONVERTED' ? BRAND_GREEN_DARK : '#2563eb',
                margin: [0, 5, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 527, y2: 0, lineWidth: 1.5, lineColor: BRAND_GREEN }],
        margin: [0, 14, 0, 12],
      },
      {
        columns: [
          {
            width: '*',
            table: {
              widths: ['*'],
              body: [
                [{ text: 'PROVEEDOR', style: 'sectionTitle' }],
                [{ text: order.supplier.toUpperCase(), style: 'boxMain' }],
                [{ text: `RUC: ${order.supplierRuc || '—'}`, style: 'boxLine' }],
              ],
            },
            layout: orderBoxLayout,
          },
          { width: 12, text: '' },
          {
            width: '*',
            table: {
              widths: ['*'],
              body: [
                [{ text: 'ENTREGA / DESTINO', style: 'sectionTitle' }],
                [{ text: deliveryCompany?.name || 'Almacén indicado por línea', style: 'boxMain' }],
                [{ text: deliveryCompany?.address || headerAddress || 'Dirección por coordinar', style: 'boxLine' }],
              ],
            },
            layout: orderBoxLayout,
          },
        ],
      },
      { text: '', margin: [0, 5] },
      {
        table: {
          widths: ['auto', '*', 'auto', '*', 'auto', '*'],
          body: [
            [
              { text: 'Fecha de emisión', style: 'metaLabel' },
              { text: formatDate(order.createdAt), style: 'metaValue' },
              { text: 'Moneda', style: 'metaLabel' },
              { text: currency, style: 'metaValue' },
              { text: 'Condición', style: 'metaLabel' },
              { text: order.paymentType || '—', style: 'metaValue' },
            ],
            [
              { text: 'Vencimiento', style: 'metaLabel' },
              { text: formatDate(order.dueDate), style: 'metaValue' },
              { text: 'Documento ref.', style: 'metaLabel' },
              { text: [order.documentType, order.documentSeries, order.documentNumber].filter(Boolean).join(' ') || '—', style: 'metaValue' },
              { text: 'T.C.', style: 'metaLabel' },
              { text: order.exchangeRate ? order.exchangeRate.toFixed(3) : '—', style: 'metaValue' },
            ],
          ],
        },
        layout: {
          hLineColor: () => BORDER_GRAY,
          vLineColor: () => BORDER_GRAY,
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 1 : 0),
          vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 1 : 0),
          paddingTop: () => 2,
          paddingBottom: () => 2,
          paddingLeft: () => 4,
          paddingRight: () => 4,
        },
      },
      { text: '', margin: [0, 10] },
      { text: 'PRODUCTOS SOLICITADOS', bold: true, fontSize: 10, color: TEXT_DARK, margin: [0, 0, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: [25, '*', 75, 35, 30, 48, 55],
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
          fillColor: (row: number) => (row === 0 ? '#f1f5f9' : null),
          hLineColor: () => BORDER_GRAY,
          vLineColor: () => BORDER_GRAY,
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0),
          vLineWidth: () => 1,
          paddingTop: () => 4,
          paddingBottom: () => 4,
          paddingLeft: () => 4,
          paddingRight: () => 4,
        },
      },
      { text: '', margin: [0, 6] },
      {
        columns: [
          {
            width: '*',
            table: {
              widths: ['auto', 5, '*'],
              body: [
                [{ text: 'CONDICIONES Y OBSERVACIONES', colSpan: 3, style: 'sectionTitle' }, {}, {}],
                [{ text: 'Notas', style: 'metaLabel' }, { text: ':', fontSize: 8 }, { text: order.notes || ' ', fontSize: 8 }],
                [{ text: 'Importante', style: 'metaLabel' }, { text: ':', fontSize: 8 }, { text: 'Esta orden no confirma ingreso de stock hasta convertirse en compra.', fontSize: 8, color: TEXT_MUTED }],
              ],
            },
            layout: {
              hLineColor: () => BORDER_GRAY,
              vLineColor: () => BORDER_GRAY,
              hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0),
              vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 1 : 0),
              paddingTop: () => 2,
              paddingBottom: () => 2,
              paddingLeft: () => 4,
              paddingRight: () => 4,
            },
          },
          { width: 10, text: '' },
          {
            width: 200,
            table: {
              widths: ['*', 70],
              body: [
                [{ text: 'RESUMEN', colSpan: 2, style: 'sectionTitle' }, {}],
                [{ text: 'Productos', fontSize: 8 }, { text: String(order.items.length), fontSize: 8, alignment: 'right' }],
                [{ text: 'Total estimado', bold: true, fontSize: 10 }, { text: `${symbol} ${total.toFixed(2)}`, alignment: 'right', bold: true, fontSize: 10, color: BRAND_GREEN_DARK }],
              ],
            },
            layout: {
              hLineColor: () => BORDER_GRAY,
              vLineColor: () => BORDER_GRAY,
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              paddingTop: () => 4,
              paddingBottom: () => 4,
              paddingLeft: () => 5,
              paddingRight: () => 5,
            },
          },
        ],
      },
      { text: '', margin: [0, 18] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 180, y2: 0, lineWidth: 0.8, lineColor: BORDER_GRAY }] },
              { text: 'Solicitado por', alignment: 'center', fontSize: 8, color: TEXT_MUTED, margin: [0, 5, 0, 0] },
            ],
          },
          {
            width: '*',
            stack: [
              { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 180, y2: 0, lineWidth: 0.8, lineColor: BORDER_GRAY }] },
              { text: 'Aprobado por', alignment: 'center', fontSize: 8, color: TEXT_MUTED, margin: [0, 5, 0, 0] },
            ],
          },
        ],
      },
    ],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `OC ${order.orderNumber}`, color: TEXT_MUTED, fontSize: 7 },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: TEXT_MUTED, fontSize: 7 },
      ],
      margin: [34, 0, 34, 16],
    }),
    styles: {
      companyName: { fontSize: 14, bold: true, color: '#111827' },
      companyDetail: { fontSize: 8, color: '#374151', margin: [0, 1, 0, 0] },
      sectionTitle: { bold: true, color: TEXT_DARK, fillColor: '#f1f5f9', fontSize: 8, margin: [5, 4] },
      boxMain: { bold: true, fontSize: 9, color: TEXT_DARK, margin: [5, 5, 5, 1] },
      boxLine: { fontSize: 8, color: TEXT_MUTED, margin: [5, 1, 5, 5] },
      metaLabel: { bold: true, fontSize: 8, color: TEXT_MUTED },
      metaValue: { fontSize: 8, color: TEXT_DARK },
      thead: { bold: true, color: TEXT_DARK, fontSize: 8, alignment: 'center' },
    },
    defaultStyle: { fontSize: 9 },
  };
}

export async function downloadPurchaseOrderPdf(params: PurchaseOrderPdfParams) {
  const [pdfMake, logoDataUrl] = await Promise.all([loadPdfMake(), loadLogoDataUrl()]);
  pdfMake.createPdf(buildDocDefinition({ ...params, logoDataUrl })).download(`${params.order.orderNumber}.pdf`);
}

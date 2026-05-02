import type { Quote, Product, Company, Client } from '../../../shared/types';
import { numberToWords } from './numberToWords';
import { COMPANY_INFO } from '../../../config/companyInfo';

let pdfMakePromise: Promise<any> | null = null;
function loadPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]).then(([pdfMakeMod, pdfFontsMod]) => {
      const pdfMake: any = (pdfMakeMod as any).default || pdfMakeMod;
      const pdfFonts: any = (pdfFontsMod as any).default || pdfFontsMod;
      pdfMake.vfs = pdfFonts.vfs || pdfFonts.pdfMake?.vfs;
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

interface GenerateParams {
  quote: Quote;
  products: Product[];
  company?: Company;
  client?: Client;
  vendor?: { name?: string; phone?: string; email?: string };
  currency?: 'PEN' | 'USD';
}

interface BuildParams extends GenerateParams {
  logoDataUrl?: string | null;
}

const formatDate = (d?: string | Date) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const IGV_RATE = 0.18;
const BRAND_GREEN = '#16a34a';
const BRAND_GREEN_DARK = '#15803d';
const BORDER_GRAY = '#94a3b8';

function labeledCell(label: string, value: string) {
  return [
    { text: label, bold: true, fontSize: 8 },
    { text: ':', fontSize: 8, alignment: 'center' },
    { text: value || ' ', fontSize: 8 },
  ];
}

function buildPaymentMethodsBlock(): any[] {
  const { bankAccounts, yape, plin } = COMPANY_INFO;
  const hasAny = (bankAccounts && bankAccounts.length > 0) || yape || plin;
  if (!hasAny) return [];

  const bankRows: any[] = [];
  bankAccounts?.forEach((acc) => {
    bankRows.push([
      { text: `${acc.bank} (${acc.currency})`, bold: true, fontSize: 8 },
      { text: 'Cuenta', fontSize: 8, color: '#6b7280' },
      { text: acc.accountNumber || '—', fontSize: 8 },
      { text: 'CCI', fontSize: 8, color: '#6b7280' },
      { text: acc.cci || '—', fontSize: 8 },
    ]);
    bankRows.push([
      { text: '', fontSize: 8 },
      { text: 'Titular', fontSize: 8, color: '#6b7280' },
      { text: acc.holder || '—', fontSize: 8, colSpan: 3 }, {}, {},
    ]);
  });

  const walletRows: any[] = [];
  if (yape) walletRows.push([
    { text: 'Yape', bold: true, fontSize: 8, fillColor: '#f3e8ff' },
    { text: yape.number, fontSize: 8 },
    { text: yape.holder, fontSize: 8, color: '#6b7280' },
  ]);
  if (plin) walletRows.push([
    { text: 'Plin', bold: true, fontSize: 8, fillColor: '#cffafe' },
    { text: plin.number, fontSize: 8 },
    { text: plin.holder, fontSize: 8, color: '#6b7280' },
  ]);

  return [
    { text: '', margin: [0, 8] },
    {
      table: {
        widths: ['*'],
        body: [[{ text: 'FORMAS DE PAGO', bold: true, color: 'white', fillColor: BRAND_GREEN, fontSize: 9, margin: [4, 3] }]],
      },
      layout: 'noBorders',
    },
    ...(bankRows.length > 0 ? [{
      table: { widths: ['auto', 'auto', '*', 'auto', '*'], body: bankRows },
      layout: {
        hLineColor: () => BORDER_GRAY, vLineColor: () => BORDER_GRAY,
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 1 : 0),
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 1 : 0),
        paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 4, paddingRight: () => 4,
      },
    }] : []),
    ...(walletRows.length > 0 ? [
      { text: '', margin: [0, 3] },
      {
        table: { widths: ['auto', 'auto', '*'], body: walletRows },
        layout: {
          hLineColor: () => BORDER_GRAY, vLineColor: () => BORDER_GRAY,
          hLineWidth: () => 1, vLineWidth: () => 1,
          paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 6, paddingRight: () => 6,
        },
      },
    ] : []),
  ];
}

function buildDocDefinition({ quote, products, company, client, vendor, currency = 'PEN', logoDataUrl }: BuildParams) {
  const getProduct = (id: string) => products.find(p => p.id === id);
  const currencySymbol = currency === 'USD' ? 'US$' : 'S/';
  const headerName = COMPANY_INFO.legalName || company?.name || 'EMPRESA';
  const headerAddress = COMPANY_INFO.address || company?.address || '';
  const headerPhone = COMPANY_INFO.phone || company?.phone || '';
  const headerRuc = COMPANY_INFO.ruc || company?.ruc || '—';
  const headerEmail = COMPANY_INFO.email || '';

  const subtotal = Math.round((quote.total / (1 + IGV_RATE)) * 100) / 100;
  const igv = Math.round((quote.total - subtotal) * 100) / 100;

  const itemsRows = quote.items.map((it, idx) => {
    const p = getProduct(it.productId);
    return [
      { text: idx + 1, alignment: 'center', fontSize: 8 },
      { text: (p?.id || '').slice(-10).toUpperCase() || '—', alignment: 'center', fontSize: 8 },
      { text: p?.name || '—', alignment: 'left', fontSize: 8 },
      { text: it.quantity.toFixed(2), alignment: 'center', fontSize: 8 },
      { text: (p?.unit || 'UND').toUpperCase().slice(0, 4), alignment: 'center', fontSize: 8 },
      { text: it.unitPrice.toFixed(2), alignment: 'right', fontSize: 8 },
      { text: it.subtotal.toFixed(2), alignment: 'right', fontSize: 8 },
    ];
  });

  while (itemsRows.length < 8) {
    itemsRows.push([
      { text: ' ', alignment: 'center', fontSize: 8 }, { text: ' ', alignment: 'center', fontSize: 8 }, { text: ' ', alignment: 'left', fontSize: 8 },
      { text: ' ', alignment: 'center', fontSize: 8 }, { text: ' ', alignment: 'center', fontSize: 8 }, { text: ' ', alignment: 'right', fontSize: 8 }, { text: ' ', alignment: 'right', fontSize: 8 },
    ]);
  }

  return {
    pageSize: 'A4',
    pageMargins: [30, 30, 30, 30],
    content: [
      // ===== HEADER =====
      {
        columns: [
          ...(logoDataUrl
            ? [{ image: logoDataUrl, width: 70, margin: [0, 4, 10, 0] } as any]
            : []),
          {
            width: '*',
            stack: [
              { text: headerName, style: 'companyName' },
              ...(headerAddress ? [{ text: `Dirección : ${headerAddress}`, style: 'companyDetail' }] : []),
              ...(headerPhone ? [{ text: `Teléfonos : ${headerPhone}`, style: 'companyDetail' }] : []),
              ...(headerEmail ? [{ text: `E-mail : ${headerEmail}`, style: 'companyDetail' }] : []),
            ],
            margin: [0, 10, 0, 0],
          },
          {
            width: 200,
            stack: [
              {
                table: { widths: ['*'], body: [[{ text: `R.U.C. ${headerRuc}`, alignment: 'center', bold: true, fontSize: 10, margin: [0, 4] }]] },
                layout: { hLineColor: () => BRAND_GREEN, vLineColor: () => BRAND_GREEN, hLineWidth: () => 1, vLineWidth: () => 1 },
              },
              { text: '', margin: [0, 3] },
              {
                table: { widths: ['*'], body: [[{ text: 'COTIZACIÓN', alignment: 'center', bold: true, fontSize: 12, color: 'white', fillColor: BRAND_GREEN, margin: [0, 5] }]] },
                layout: 'noBorders',
              },
              { text: '', margin: [0, 3] },
              {
                table: { widths: ['*'], body: [[{ text: `NRO-${String(quote.number || 0).padStart(8, '0')}`, alignment: 'center', bold: true, fontSize: 11, color: BRAND_GREEN_DARK, margin: [0, 4] }]] },
                layout: { hLineColor: () => BRAND_GREEN, vLineColor: () => BRAND_GREEN, hLineWidth: () => 1, vLineWidth: () => 1 },
              },
            ],
          },
        ],
      },

      { text: '', margin: [0, 8] },

      // ===== CLIENT BLOCK =====
      {
        table: {
          widths: ['auto', 5, '*', 'auto', 5, '*'],
          body: [
            [
              { text: 'R.U.C. / D.N.I.', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: client?.documentNumber || '—', fontSize: 8, colSpan: 4 }, {}, {}, {},
            ],
            [
              { text: 'Cliente', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: (client?.name || quote.clientName || '—').toUpperCase(), fontSize: 8, colSpan: 4 }, {}, {}, {},
            ],
            [
              { text: 'Dirección', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: client?.address || '—', fontSize: 8, colSpan: 4 }, {}, {}, {},
            ],
            [
              { text: 'Contacto', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: ' ', fontSize: 8 },
              { text: 'Vendedor', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: (vendor?.name || '—').toUpperCase(), fontSize: 8 },
            ],
            [
              { text: 'Teléfono', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: client?.phone || ' ', fontSize: 8 },
              { text: 'Teléfono', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: vendor?.phone || ' ', fontSize: 8 },
            ],
            [
              { text: 'E-mail', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: client?.email || ' ', fontSize: 8 },
              { text: 'E-mail', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: vendor?.email || ' ', fontSize: 8 },
            ],
            [
              { text: 'Fecha Emisión', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: formatDate(quote.issueDate), fontSize: 8 },
              { text: 'Fecha Vencimiento', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: formatDate(quote.validUntil), fontSize: 8 },
            ],
          ],
        },
        layout: {
          hLineColor: () => BORDER_GRAY, vLineColor: () => BORDER_GRAY,
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 1 : 0),
          vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 1 : 0),
          paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 4, paddingRight: () => 4,
        },
      },

      { text: '', margin: [0, 8] },

      // ===== ITEMS TABLE =====
      {
        table: {
          headerRows: 1,
          widths: [25, 60, '*', 35, 30, 45, 50],
          body: [
            [
              { text: 'ÍTEM', style: 'thead' },
              { text: 'CÓDIGO', style: 'thead' },
              { text: 'DESCRIPCIÓN', style: 'thead' },
              { text: 'CANT.', style: 'thead' },
              { text: 'U.M.', style: 'thead' },
              { text: 'V. UNIT.', style: 'thead' },
              { text: 'IMPORTE', style: 'thead' },
            ],
            ...itemsRows,
          ],
        },
        layout: {
          fillColor: (row: number) => (row === 0 ? BRAND_GREEN : null),
          hLineColor: () => BORDER_GRAY, vLineColor: () => BORDER_GRAY,
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0),
          vLineWidth: () => 1,
          paddingTop: () => 3, paddingBottom: () => 3,
        },
      },

      { text: '', margin: [0, 4] },

      // ===== AMOUNT IN WORDS =====
      {
        text: [
          { text: 'SON: ', bold: true, fontSize: 8 },
          { text: numberToWords(quote.total, currency), fontSize: 8 },
        ],
        margin: [2, 2, 2, 2],
      },

      { text: '', margin: [0, 6] },

      // ===== COMMERCIAL CONDITIONS + TOTALS =====
      {
        columns: [
          {
            width: '*',
            table: {
              widths: ['auto', 5, '*'],
              body: [
                [{ text: 'CONDICIONES COMERCIALES', colSpan: 3, bold: true, color: 'white', fillColor: BRAND_GREEN, fontSize: 9, margin: [4, 3] }, {}, {}],
                [{ text: 'Forma de pago', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: 'CONTADO', fontSize: 8 }],
                [{ text: 'Tiempo de Entrega', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: 'INMEDIATO', fontSize: 8 }],
                [{ text: 'Lugar de Entrega', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: client?.address || ' ', fontSize: 8 }],
                [{ text: 'Nota', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: quote.notes || ' ', fontSize: 8 }],
                [{ text: 'Observaciones', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: ' ', fontSize: 8 }],
              ],
            },
            layout: {
              hLineColor: () => BORDER_GRAY, vLineColor: () => BORDER_GRAY,
              hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0),
              vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 1 : 0),
              paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 4, paddingRight: () => 4,
            },
          },
          { width: 10, text: '' },
          {
            width: 200,
            table: {
              widths: ['*', 30, 60],
              body: [
                [
                  { text: 'OP. GRAVADAS', bold: true, color: 'white', fillColor: BRAND_GREEN, fontSize: 9, alignment: 'right', margin: [4, 3] },
                  { text: currencySymbol, fontSize: 9, alignment: 'center', margin: [0, 3] },
                  { text: subtotal.toFixed(2), fontSize: 9, alignment: 'right', margin: [0, 3] },
                ],
                [
                  { text: 'I.G.V. 18%', bold: true, color: 'white', fillColor: BRAND_GREEN, fontSize: 9, alignment: 'right', margin: [4, 3] },
                  { text: currencySymbol, fontSize: 9, alignment: 'center', margin: [0, 3] },
                  { text: igv.toFixed(2), fontSize: 9, alignment: 'right', margin: [0, 3] },
                ],
                [
                  { text: 'IMPORTE TOTAL', bold: true, color: 'white', fillColor: BRAND_GREEN, fontSize: 10, alignment: 'right', margin: [4, 3] },
                  { text: currencySymbol, fontSize: 10, alignment: 'center', bold: true, margin: [0, 3] },
                  { text: quote.total.toFixed(2), fontSize: 10, alignment: 'right', bold: true, margin: [0, 3] },
                ],
              ],
            },
            layout: {
              hLineColor: () => BORDER_GRAY, vLineColor: () => BORDER_GRAY,
              hLineWidth: () => 1, vLineWidth: () => 1,
            },
          },
        ],
      },

      ...buildPaymentMethodsBlock(),
    ],
    styles: {
      companyName: { fontSize: 14, bold: true, color: '#111827' },
      companyDetail: { fontSize: 8, color: '#374151', margin: [0, 1, 0, 0] },
      thead: { bold: true, color: 'white', fontSize: 9, alignment: 'center' },
    },
    defaultStyle: { fontSize: 9 },
  };
}

export async function downloadQuotePdf(params: GenerateParams) {
  const [pdfMake, logoDataUrl] = await Promise.all([loadPdfMake(), loadLogoDataUrl()]);
  pdfMake.createPdf(buildDocDefinition({ ...params, logoDataUrl })).download(`${params.quote.quoteNumber}.pdf`);
}

export async function printQuotePdf(params: GenerateParams) {
  const [pdfMake, logoDataUrl] = await Promise.all([loadPdfMake(), loadLogoDataUrl()]);
  pdfMake.createPdf(buildDocDefinition({ ...params, logoDataUrl })).open();
}

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Quote, Product, Company, Client } from '../../../shared/types';
import { numberToWords } from './numberToWords';

(pdfMake as any).vfs = (pdfFonts as any).vfs || (pdfFonts as any).pdfMake?.vfs;

interface GenerateParams {
  quote: Quote;
  products: Product[];
  company?: Company;
  client?: Client;
  vendor?: { name?: string; phone?: string; email?: string };
  currency?: 'PEN' | 'USD';
}

const formatDate = (d?: string | Date) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const IGV_RATE = 0.18;
const BRAND_BLUE = '#1e3a8a';
const BRAND_BLUE_LIGHT = '#dbeafe';
const BORDER_GRAY = '#94a3b8';

function labeledCell(label: string, value: string) {
  return [
    { text: label, bold: true, fontSize: 8 },
    { text: ':', fontSize: 8, alignment: 'center' },
    { text: value || ' ', fontSize: 8 },
  ];
}

function buildDocDefinition({ quote, products, company, client, vendor, currency = 'PEN' }: GenerateParams) {
  const getProduct = (id: string) => products.find(p => p.id === id);
  const currencySymbol = currency === 'USD' ? 'US$' : 'S/';

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
          {
            width: '*',
            stack: [
              { text: company?.name || 'EMPRESA', style: 'companyName' },
              { text: company?.address ? `Dirección : ${company.address}` : '', style: 'companyDetail' },
              { text: company?.phone ? `Teléfonos : ${company.phone}` : '', style: 'companyDetail' },
            ],
            margin: [0, 10, 0, 0],
          },
          {
            width: 200,
            stack: [
              {
                table: { widths: ['*'], body: [[{ text: `R.U.C. ${company?.ruc || '—'}`, alignment: 'center', bold: true, fontSize: 10, margin: [0, 4] }]] },
                layout: { hLineColor: () => BRAND_BLUE, vLineColor: () => BRAND_BLUE, hLineWidth: () => 1, vLineWidth: () => 1 },
              },
              { text: '', margin: [0, 3] },
              {
                table: { widths: ['*'], body: [[{ text: 'COTIZACIÓN', alignment: 'center', bold: true, fontSize: 12, color: 'white', fillColor: BRAND_BLUE, margin: [0, 5] }]] },
                layout: 'noBorders',
              },
              { text: '', margin: [0, 3] },
              {
                table: { widths: ['*'], body: [[{ text: `NRO-${String(quote.number || 0).padStart(8, '0')}`, alignment: 'center', bold: true, fontSize: 11, color: BRAND_BLUE, margin: [0, 4] }]] },
                layout: { hLineColor: () => BRAND_BLUE, vLineColor: () => BRAND_BLUE, hLineWidth: () => 1, vLineWidth: () => 1 },
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
          fillColor: (row: number) => (row === 0 ? BRAND_BLUE : null),
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
                [{ text: 'CONDICIONES COMERCIALES', colSpan: 3, bold: true, color: 'white', fillColor: BRAND_BLUE, fontSize: 9, margin: [4, 3] }, {}, {}],
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
                  { text: 'OP. GRAVADAS', bold: true, color: 'white', fillColor: BRAND_BLUE, fontSize: 9, alignment: 'right', margin: [4, 3] },
                  { text: currencySymbol, fontSize: 9, alignment: 'center', margin: [0, 3] },
                  { text: subtotal.toFixed(2), fontSize: 9, alignment: 'right', margin: [0, 3] },
                ],
                [
                  { text: 'I.G.V. 18%', bold: true, color: 'white', fillColor: BRAND_BLUE, fontSize: 9, alignment: 'right', margin: [4, 3] },
                  { text: currencySymbol, fontSize: 9, alignment: 'center', margin: [0, 3] },
                  { text: igv.toFixed(2), fontSize: 9, alignment: 'right', margin: [0, 3] },
                ],
                [
                  { text: 'IMPORTE TOTAL', bold: true, color: 'white', fillColor: BRAND_BLUE, fontSize: 10, alignment: 'right', margin: [4, 3] },
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
    ],
    styles: {
      companyName: { fontSize: 14, bold: true, color: '#111827' },
      companyDetail: { fontSize: 8, color: '#374151', margin: [0, 1, 0, 0] },
      thead: { bold: true, color: 'white', fontSize: 9, alignment: 'center' },
    },
    defaultStyle: { fontSize: 9 },
  };
}

export function downloadQuotePdf(params: GenerateParams) {
  pdfMake.createPdf(buildDocDefinition(params)).download(`${params.quote.quoteNumber}.pdf`);
}

export function printQuotePdf(params: GenerateParams) {
  pdfMake.createPdf(buildDocDefinition(params)).open();
}

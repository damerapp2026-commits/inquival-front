import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Quote, Product, Company } from '../../../shared/types';

(pdfMake as any).vfs = (pdfFonts as any).vfs || (pdfFonts as any).pdfMake?.vfs;

interface GenerateParams {
  quote: Quote;
  products: Product[];
  company?: Company;
}

const formatDate = (d?: string | Date) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function buildDocDefinition({ quote, products, company }: GenerateParams): any {
  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;
  const getProductUnit = (id: string) => products.find(p => p.id === id)?.unit || '';

  const itemsRows = quote.items.map((it, idx) => [
    { text: idx + 1, alignment: 'center' },
    { text: getProductName(it.productId), alignment: 'left' },
    { text: getProductUnit(it.productId), alignment: 'center' },
    { text: it.quantity.toString(), alignment: 'right' },
    { text: `S/ ${it.unitPrice.toFixed(2)}`, alignment: 'right' },
    { text: `S/ ${it.subtotal.toFixed(2)}`, alignment: 'right' },
  ]);

  return {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      {
        columns: [
          [
            { text: company?.name || 'Empresa', style: 'companyName' },
            { text: company?.ruc ? `RUC: ${company.ruc}` : '', style: 'companyDetail' },
            { text: company?.address || '', style: 'companyDetail' },
            { text: company?.phone ? `Tel: ${company.phone}` : '', style: 'companyDetail' },
          ],
          {
            width: 200,
            stack: [
              { text: 'PROFORMA', style: 'docTitle', alignment: 'center' },
              {
                table: {
                  widths: ['*'],
                  body: [[{ text: quote.quoteNumber, alignment: 'center', bold: true, fontSize: 14, color: '#166534' }]],
                },
                layout: { fillColor: () => '#f0fdf4', hLineColor: () => '#16a34a', vLineColor: () => '#16a34a' },
                margin: [0, 6, 0, 0],
              },
            ],
          },
        ],
      },
      { text: '', margin: [0, 15] },
      {
        columns: [
          {
            width: '*',
            table: {
              widths: ['auto', '*'],
              body: [
                [{ text: 'Cliente:', bold: true }, { text: quote.clientName || '—' }],
                [{ text: 'Emisión:', bold: true }, { text: formatDate(quote.issueDate) }],
                [{ text: 'Válida hasta:', bold: true, color: '#dc2626' }, { text: formatDate(quote.validUntil), color: '#dc2626', bold: true }],
              ],
            },
            layout: 'noBorders',
          },
        ],
      },
      { text: '', margin: [0, 10] },
      {
        table: {
          headerRows: 1,
          widths: [25, '*', 50, 40, 60, 70],
          body: [
            [
              { text: '#', style: 'tableHeader' },
              { text: 'Descripción', style: 'tableHeader' },
              { text: 'Unidad', style: 'tableHeader' },
              { text: 'Cant.', style: 'tableHeader' },
              { text: 'P. Unit.', style: 'tableHeader' },
              { text: 'Subtotal', style: 'tableHeader' },
            ],
            ...itemsRows,
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#16a34a' : rowIndex % 2 === 0 ? '#f9fafb' : null),
          hLineColor: () => '#e5e7eb',
          vLineColor: () => '#e5e7eb',
        },
      },
      { text: '', margin: [0, 10] },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 220,
            table: {
              widths: ['*', 90],
              body: [
                [{ text: 'TOTAL', bold: true, alignment: 'right', fontSize: 13 }, { text: `S/ ${quote.total.toFixed(2)}`, bold: true, alignment: 'right', fontSize: 13, color: '#166534' }],
              ],
            },
            layout: { fillColor: () => '#f0fdf4', hLineColor: () => '#16a34a', vLineColor: () => '#16a34a' },
          },
        ],
      },
      quote.notes ? { text: '', margin: [0, 15] } : '',
      quote.notes ? { text: 'Observaciones', bold: true, fontSize: 10, margin: [0, 0, 0, 3] } : '',
      quote.notes ? { text: quote.notes, fontSize: 9, color: '#4b5563' } : '',
      { text: '', margin: [0, 20] },
      {
        text: `Esta proforma no constituye comprobante de pago. Válida hasta el ${formatDate(quote.validUntil)}.`,
        fontSize: 8,
        italics: true,
        color: '#6b7280',
        alignment: 'center',
      },
    ],
    styles: {
      companyName: { fontSize: 16, bold: true, color: '#166534' },
      companyDetail: { fontSize: 9, color: '#6b7280' },
      docTitle: { fontSize: 20, bold: true, color: '#166534' },
      tableHeader: { bold: true, color: 'white', fontSize: 10 },
    },
    defaultStyle: { fontSize: 10 },
  };
}

export function downloadQuotePdf(params: GenerateParams) {
  const doc = buildDocDefinition(params);
  pdfMake.createPdf(doc).download(`${params.quote.quoteNumber}.pdf`);
}

export function printQuotePdf(params: GenerateParams) {
  const doc = buildDocDefinition(params);
  pdfMake.createPdf(doc).open();
}

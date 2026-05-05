import { COMPANY_INFO } from '../../../config/companyInfo';
import type { VoucherSnapshot } from '../components/VoucherPreviewModal';

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
      if (typeof pdfMake.addVirtualFileSystem === 'function') {
        pdfMake.addVirtualFileSystem(vfs);
      } else {
        pdfMake.vfs = vfs;
      }
      return pdfMake;
    });
  }
  return pdfMakePromise;
}

export function shortVoucherNumber(id: string): string {
  return `NV-${(id || '').slice(-8).toUpperCase().padStart(8, '0')}`;
}

export function voucherTitle(type: string): string {
  if (type === 'BOLETA') return 'Boleta de venta';
  if (type === 'FACTURA') return 'Factura';
  return 'Nota de venta';
}

function formatDate(d: Date): string {
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function dashedLine(width = 206) {
  return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, dash: { length: 2 }, lineWidth: 0.5, lineColor: '#000' }], margin: [0, 4, 0, 4] };
}

function buildTicketDocDef(sale: VoucherSnapshot): any {
  const c = COMPANY_INFO;
  const itemRows: any[] = [];
  sale.items.forEach((i) => {
    itemRows.push([
      { text: String(i.quantity), bold: true },
      { text: i.name, colSpan: 3 },
      {},
      {},
    ]);
    itemRows.push([
      {},
      {},
      { text: `S/ ${i.unitPrice.toFixed(2)}`, alignment: 'right' },
      { text: `S/ ${i.subtotal.toFixed(2)}`, alignment: 'right' },
    ]);
  });

  const content: any[] = [
    { text: c.legalName, alignment: 'center', bold: true, fontSize: 11 },
  ];
  if (c.ruc) content.push({ text: `RUC ${c.ruc}`, alignment: 'center', fontSize: 8, color: '#555' });
  if (c.address) content.push({ text: c.address, alignment: 'center', fontSize: 8, color: '#555' });
  if (c.phone) content.push({ text: `Tel. ${c.phone}`, alignment: 'center', fontSize: 8, color: '#555' });

  content.push(dashedLine());
  content.push({ text: voucherTitle(sale.voucherType).toUpperCase(), alignment: 'center', bold: true });
  content.push({ text: `N° ${shortVoucherNumber(sale.id)}`, alignment: 'center', bold: true, fontSize: 11 });
  content.push({ text: formatDate(sale.date), alignment: 'center', fontSize: 8, color: '#555' });
  content.push(dashedLine());

  if (sale.clientName) content.push({ columns: [{ text: 'Cliente:', bold: true, width: 55 }, { text: sale.clientName }] });
  if (sale.clientDocument) content.push({ columns: [{ text: 'Doc:', bold: true, width: 55 }, { text: sale.clientDocument }] });
  content.push({ columns: [{ text: 'Vendedor:', bold: true, width: 55 }, { text: sale.sellerName || 'Sin asignar' }] });

  content.push(dashedLine());
  content.push({
    table: {
      widths: [22, '*', 'auto', 'auto'],
      headerRows: 1,
      body: [
        [
          { text: 'Can', bold: true, fontSize: 8 },
          { text: 'Descripción', bold: true, fontSize: 8 },
          { text: 'P.Unit', bold: true, alignment: 'right', fontSize: 8 },
          { text: 'Total', bold: true, alignment: 'right', fontSize: 8 },
        ],
        ...itemRows,
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 1 ? 0.5 : 0),
      vLineWidth: () => 0,
      hLineColor: () => '#000',
      paddingLeft: () => 1,
      paddingRight: () => 1,
      paddingTop: () => 1,
      paddingBottom: () => 1,
    },
    fontSize: 9,
  });
  content.push(dashedLine());

  if (typeof sale.baseImponible === 'number') {
    content.push({ columns: [{ text: 'Subtotal' }, { text: `S/ ${sale.baseImponible.toFixed(2)}`, alignment: 'right' }] });
  }
  if (typeof sale.igv === 'number' && sale.igv > 0) {
    content.push({ columns: [{ text: 'IGV (18%)' }, { text: `S/ ${sale.igv.toFixed(2)}`, alignment: 'right' }] });
  }
  content.push({
    columns: [
      { text: 'TOTAL', bold: true, fontSize: 14 },
      { text: `S/ ${sale.total.toFixed(2)}`, bold: true, fontSize: 14, alignment: 'right' },
    ],
    margin: [0, 4, 0, 4],
  });

  if (sale.payments.length) {
    content.push(dashedLine());
    content.push({ text: 'Forma de pago', bold: true });
    sale.payments.forEach((p) => {
      content.push({ columns: [{ text: p.methodName }, { text: `S/ ${p.amount.toFixed(2)}`, alignment: 'right' }] });
    });
  }

  content.push(dashedLine());
  content.push({ text: '¡Gracias por su preferencia!', alignment: 'center', fontSize: 9, color: '#555' });
  if (c.website) content.push({ text: c.website, alignment: 'center', fontSize: 8, color: '#555' });

  return {
    pageSize: { width: 226.77, height: 'auto' },
    pageMargins: [10, 10, 10, 10],
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9 },
  };
}

export async function buildVoucherPdfBlob(sale: VoucherSnapshot): Promise<Blob> {
  const pdfMake = await loadPdfMake();
  const docDef = buildTicketDocDef(sale);
  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDef).getBlob((blob: Blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PDF vacio'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

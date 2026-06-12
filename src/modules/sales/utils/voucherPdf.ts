import { COMPANY_INFO } from '../../../config/companyInfo';
import { numberToWords } from '../../quotes/utils/numberToWords';
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

export type VoucherFormat = 'TICKET' | 'A4' | 'A5';

export function shortVoucherNumber(id: string): string {
  return `NV-${(id || '').slice(-8).toUpperCase().padStart(8, '0')}`;
}

export function displayVoucherNumber(sale: VoucherSnapshot): string {
  return sale.voucherNumber || shortVoucherNumber(sale.id);
}

export function voucherTitle(type: string): string {
  if (type === 'BOLETA') return 'Boleta de venta';
  if (type === 'FACTURA') return 'Factura';
  return 'Nota de venta';
}

function formatDate(d: Date): string {
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const BRAND_GREEN = '#16a34a';
const BRAND_GREEN_DARK = '#15803d';
const BORDER_GRAY = '#94a3b8';

function dashedLine(width = 206) {
  return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, dash: { length: 2 }, lineWidth: 0.5, lineColor: '#000' }], margin: [0, 4, 0, 4] };
}

function buildTicketDocDef(sale: VoucherSnapshot, logoDataUrl: string | null): any {
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

  const content: any[] = [];
  if (logoDataUrl) {
    content.push({ image: logoDataUrl, width: 90, alignment: 'center', margin: [0, 0, 0, 4] });
  }
  content.push({ text: c.legalName, alignment: 'center', bold: true, fontSize: 11 });
  if (c.ruc) content.push({ text: `RUC ${c.ruc}`, alignment: 'center', fontSize: 8, color: '#555' });
  if (c.address) content.push({ text: c.address, alignment: 'center', fontSize: 8, color: '#555' });
  if (c.phone) content.push({ text: `Tel. ${c.phone}`, alignment: 'center', fontSize: 8, color: '#555' });

  content.push(dashedLine());
  content.push({ text: voucherTitle(sale.voucherType).toUpperCase(), alignment: 'center', bold: true });
  content.push({ text: `N° ${displayVoucherNumber(sale)}`, alignment: 'center', bold: true, fontSize: 11 });
  content.push({ text: formatDate(sale.date), alignment: 'center', fontSize: 8, color: '#555' });
  content.push(dashedLine());

  if (sale.clientName) content.push({ columns: [{ text: 'Cliente:', bold: true, width: 55 }, { text: sale.clientName }] });
  if (sale.clientDocument) content.push({ columns: [{ text: 'Doc:', bold: true, width: 55 }, { text: sale.clientDocument }] });
  if (sale.clientLocation) content.push({ columns: [{ text: 'Ubicación:', bold: true, width: 55 }, { text: sale.clientLocation }] });
  content.push({ columns: [{ text: 'R. Comercial:', bold: true, width: 55 }, { text: sale.sellerName || 'Sin asignar' }] });

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

  const anticipoSum = sale.payments.reduce((s, p) => s + p.amount, 0);
  const paidSoFar = sale.creditPaidAmount ?? anticipoSum;
  const pendingAmount = Math.max(0, sale.total - paidSoFar);

  if (sale.isCredit) {
    content.push(dashedLine());
    content.push({ text: 'VENTA A CRÉDITO', alignment: 'center', bold: true, color: '#b91c1c' });
    if (anticipoSum > 0) {
      content.push({ text: 'Abonado a la fecha', bold: true, margin: [0, 3, 0, 0] });
      sale.payments.forEach((p) => {
        content.push({ columns: [{ text: p.methodName }, { text: `S/ ${p.amount.toFixed(2)}`, alignment: 'right' }] });
      });
      const posteriores = paidSoFar - anticipoSum;
      if (posteriores > 0.001) {
        content.push({ columns: [{ text: 'Abonos posteriores' }, { text: `S/ ${posteriores.toFixed(2)}`, alignment: 'right' }] });
      }
      content.push({ columns: [{ text: 'Total abonado', bold: true }, { text: `S/ ${paidSoFar.toFixed(2)}`, bold: true, alignment: 'right' }] });
    } else {
      content.push({ text: 'Sin abono inicial', color: '#555', italics: true, margin: [0, 2, 0, 2] });
    }
    content.push({
      columns: [
        { text: 'SALDO PENDIENTE', bold: true, fontSize: 11, color: '#b91c1c' },
        { text: `S/ ${pendingAmount.toFixed(2)}`, bold: true, fontSize: 11, color: '#b91c1c', alignment: 'right' },
      ],
      margin: [0, 4, 0, 2],
    });
    if (sale.creditDueDate) {
      const due = new Date(sale.creditDueDate).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      content.push({ columns: [{ text: 'Vence el', bold: true }, { text: due, alignment: 'right' }] });
    }
  } else if (sale.payments.length) {
    content.push(dashedLine());
    content.push({ text: 'Forma de pago', bold: true });
    sale.payments.forEach((p) => {
      content.push({ columns: [{ text: p.methodName }, { text: `S/ ${p.amount.toFixed(2)}`, alignment: 'right' }] });
    });
    if (sale.payments.length > 1) {
      content.push({
        columns: [
          { text: 'Total pagado', bold: true },
          { text: `S/ ${anticipoSum.toFixed(2)}`, bold: true, alignment: 'right' },
        ],
        margin: [0, 2, 0, 0],
      });
    }
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

function buildBankAndWalletBlock(): any[] {
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

function buildA4DocDef(sale: VoucherSnapshot, logoDataUrl: string | null): any {
  const c = COMPANY_INFO;
  const headerName = c.legalName || 'EMPRESA';
  const headerRuc = c.ruc || '—';
  const title = voucherTitle(sale.voucherType).toUpperCase();
  const number = displayVoucherNumber(sale);

  const subtotal = typeof sale.baseImponible === 'number'
    ? sale.baseImponible
    : Math.round((sale.total / 1.18) * 100) / 100;
  const igv = typeof sale.igv === 'number'
    ? sale.igv
    : Math.round((sale.total - subtotal) * 100) / 100;

  const itemsRows = sale.items.map((it, idx) => [
    { text: idx + 1, alignment: 'center', fontSize: 8 },
    { text: it.name, alignment: 'left', fontSize: 8 },
    { text: String(it.quantity), alignment: 'center', fontSize: 8 },
    { text: it.unitPrice.toFixed(2), alignment: 'right', fontSize: 8 },
    { text: it.subtotal.toFixed(2), alignment: 'right', fontSize: 8 },
  ]);

  while (itemsRows.length < 8) {
    itemsRows.push([
      { text: ' ', alignment: 'center', fontSize: 8 },
      { text: ' ', alignment: 'left', fontSize: 8 },
      { text: ' ', alignment: 'center', fontSize: 8 },
      { text: ' ', alignment: 'right', fontSize: 8 },
      { text: ' ', alignment: 'right', fontSize: 8 },
    ]);
  }

  const anticipoSumA4 = sale.payments.reduce((s, p) => s + p.amount, 0);
  const paidSoFarA4 = sale.creditPaidAmount ?? anticipoSumA4;
  const pendingAmountA4 = Math.max(0, sale.total - paidSoFarA4);

  const paymentsBody: any[] = [
    [{
      text: sale.isCredit ? 'FORMA DE PAGO · CRÉDITO' : 'FORMA DE PAGO',
      colSpan: 3, bold: true, color: 'white',
      fillColor: sale.isCredit ? '#b91c1c' : BRAND_GREEN,
      fontSize: 9, margin: [4, 3],
    }, {}, {}],
    ...sale.payments.map((p) => [
      { text: p.methodName, bold: true, fontSize: 8 },
      { text: ':', fontSize: 8 },
      { text: `S/ ${p.amount.toFixed(2)}`, alignment: 'right', fontSize: 8 },
    ]),
  ];
  if (sale.isCredit) {
    const posteriores = paidSoFarA4 - anticipoSumA4;
    if (posteriores > 0.001) {
      paymentsBody.push([
        { text: 'Abonos posteriores', bold: true, fontSize: 8 },
        { text: ':', fontSize: 8 },
        { text: `S/ ${posteriores.toFixed(2)}`, alignment: 'right', fontSize: 8 },
      ]);
    }
    if (paidSoFarA4 > 0) {
      paymentsBody.push([
        { text: 'Total abonado', bold: true, fontSize: 8 },
        { text: ':', fontSize: 8 },
        { text: `S/ ${paidSoFarA4.toFixed(2)}`, alignment: 'right', bold: true, fontSize: 8 },
      ]);
    }
    paymentsBody.push([
      { text: 'SALDO PENDIENTE', bold: true, fontSize: 9, color: '#b91c1c' },
      { text: ':', fontSize: 9, color: '#b91c1c' },
      { text: `S/ ${pendingAmountA4.toFixed(2)}`, alignment: 'right', bold: true, fontSize: 9, color: '#b91c1c' },
    ]);
    if (sale.creditDueDate) {
      const due = new Date(sale.creditDueDate).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      paymentsBody.push([
        { text: 'Vence el', bold: true, fontSize: 8 },
        { text: ':', fontSize: 8 },
        { text: due, alignment: 'right', fontSize: 8 },
      ]);
    }
  } else if (sale.payments.length > 1) {
    paymentsBody.push([
      { text: 'Total pagado', bold: true, fontSize: 8 },
      { text: ':', fontSize: 8 },
      { text: `S/ ${anticipoSumA4.toFixed(2)}`, alignment: 'right', bold: true, fontSize: 8 },
    ]);
  }
  if (paymentsBody.length === 1) {
    paymentsBody.push([{ text: ' ', fontSize: 8 }, { text: ' ', fontSize: 8 }, { text: ' ', fontSize: 8 }]);
  }

  return {
    pageSize: 'A4',
    pageMargins: [30, 30, 30, 30],
    content: [
      // Header
      {
        columns: [
          ...(logoDataUrl
            ? [{ image: logoDataUrl, width: 70, margin: [0, 4, 10, 0] } as any]
            : []),
          {
            width: '*',
            stack: [
              { text: headerName, style: 'companyName' },
              ...(c.address ? [{ text: `Dirección : ${c.address}`, style: 'companyDetail' }] : []),
              ...(c.phone ? [{ text: `Teléfonos : ${c.phone}`, style: 'companyDetail' }] : []),
              ...(c.email ? [{ text: `E-mail : ${c.email}`, style: 'companyDetail' }] : []),
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
                table: { widths: ['*'], body: [[{ text: title, alignment: 'center', bold: true, fontSize: 12, color: 'white', fillColor: BRAND_GREEN, margin: [0, 5] }]] },
                layout: 'noBorders',
              },
              { text: '', margin: [0, 3] },
              {
                table: { widths: ['*'], body: [[{ text: number, alignment: 'center', bold: true, fontSize: 11, color: BRAND_GREEN_DARK, margin: [0, 4] }]] },
                layout: { hLineColor: () => BRAND_GREEN, vLineColor: () => BRAND_GREEN, hLineWidth: () => 1, vLineWidth: () => 1 },
              },
            ],
          },
        ],
      },

      { text: '', margin: [0, 8] },

      // Client / seller block
      {
        table: {
          widths: ['auto', 5, '*', 'auto', 5, '*'],
          body: [
            [
              { text: 'R.U.C. / D.N.I.', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: sale.clientDocument || '—', fontSize: 8, colSpan: 4 }, {}, {}, {},
            ],
            [
              { text: 'Cliente', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: (sale.clientName || 'Consumidor final').toUpperCase(), fontSize: 8, colSpan: 4 }, {}, {}, {},
            ],
            [
              { text: 'Teléfono', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: sale.clientPhone || ' ', fontSize: 8 },
              { text: 'R. Comercial', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: (sale.sellerName || '—').toUpperCase(), fontSize: 8 },
            ],
            ...(sale.clientLocation ? [[
              { text: 'Ubicación', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: sale.clientLocation.toUpperCase(), fontSize: 8, colSpan: 4 }, {}, {}, {},
            ]] : []),
            [
              { text: 'Fecha Emisión', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: formatDate(sale.date), fontSize: 8, colSpan: 4 }, {}, {}, {},
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

      // Items table
      {
        table: {
          headerRows: 1,
          widths: [25, '*', 40, 60, 70],
          body: [
            [
              { text: 'ÍTEM', style: 'thead' },
              { text: 'DESCRIPCIÓN', style: 'thead' },
              { text: 'CANT.', style: 'thead' },
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

      // Amount in words
      {
        text: [
          { text: 'SON: ', bold: true, fontSize: 8 },
          { text: numberToWords(sale.total, 'PEN'), fontSize: 8 },
        ],
        margin: [2, 2, 2, 2],
      },

      { text: '', margin: [0, 6] },

      // Payments + totals
      {
        columns: [
          {
            width: '*',
            table: {
              widths: ['auto', 5, '*'],
              body: paymentsBody,
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
                  { text: 'S/', fontSize: 9, alignment: 'center', margin: [0, 3] },
                  { text: subtotal.toFixed(2), fontSize: 9, alignment: 'right', margin: [0, 3] },
                ],
                [
                  { text: 'I.G.V. 18%', bold: true, color: 'white', fillColor: BRAND_GREEN, fontSize: 9, alignment: 'right', margin: [4, 3] },
                  { text: 'S/', fontSize: 9, alignment: 'center', margin: [0, 3] },
                  { text: igv.toFixed(2), fontSize: 9, alignment: 'right', margin: [0, 3] },
                ],
                [
                  { text: 'IMPORTE TOTAL', bold: true, color: 'white', fillColor: BRAND_GREEN, fontSize: 10, alignment: 'right', margin: [4, 3] },
                  { text: 'S/', fontSize: 10, alignment: 'center', bold: true, margin: [0, 3] },
                  { text: sale.total.toFixed(2), fontSize: 10, alignment: 'right', bold: true, margin: [0, 3] },
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

      ...buildBankAndWalletBlock(),
    ],
    styles: {
      companyName: { fontSize: 14, bold: true, color: '#111827' },
      companyDetail: { fontSize: 8, color: '#374151', margin: [0, 1, 0, 0] },
      thead: { bold: true, color: 'white', fontSize: 9, alignment: 'center' },
    },
    defaultStyle: { fontSize: 9 },
  };
}

function buildA5DocDef(sale: VoucherSnapshot, logoDataUrl: string | null): any {
  const def = buildA4DocDef(sale, logoDataUrl);
  def.pageSize = 'A5';
  def.pageMargins = [20, 20, 20, 20];
  return def;
}

async function buildPdf(sale: VoucherSnapshot, format: VoucherFormat) {
  const [pdfMake, logoDataUrl] = await Promise.all([loadPdfMake(), loadLogoDataUrl()]);
  if (format === 'A4') return pdfMake.createPdf(buildA4DocDef(sale, logoDataUrl));
  if (format === 'A5') return pdfMake.createPdf(buildA5DocDef(sale, logoDataUrl));
  return pdfMake.createPdf(buildTicketDocDef(sale, logoDataUrl));
}

export async function downloadVoucherPdf(sale: VoucherSnapshot, format: VoucherFormat = 'TICKET') {
  const pdf = await buildPdf(sale, format);
  pdf.download(`${displayVoucherNumber(sale)}.pdf`);
}

export async function openVoucherPdf(sale: VoucherSnapshot, format: VoucherFormat = 'TICKET') {
  const pdf = await buildPdf(sale, format);
  pdf.open();
}

export async function buildVoucherPdfBlob(sale: VoucherSnapshot, format: VoucherFormat = 'TICKET'): Promise<Blob> {
  const pdf = await buildPdf(sale, format);
  return new Promise((resolve, reject) => {
    try {
      pdf.getBlob((blob: Blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PDF vacio'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

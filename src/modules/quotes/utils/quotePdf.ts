import type { Quote, Product, Company, Client } from '../../../shared/types';
import { numberToWords } from './numberToWords';
import { COMPANY_INFO } from '../../../config/companyInfo';
import { getQuoteItemProductName, getQuoteItemProductUnit } from './quoteItemDetails';
import { getQuoteCommercialDetails } from './quoteDetails';

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
  const raw = d instanceof Date ? d.toISOString() : d;
  const dateKey = raw.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return '—';
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const IGV_RATE = 0.18;
const BRAND_GREEN_DARK = '#15803d';
const BORDER_GRAY = '#94a3b8';
const TABLE_HEADER_FILL = '#dcfce7';

function buildPaymentMethodsBlock(): any[] {
  const { bankAccounts, detraccionAccount, yape, plin } = COMPANY_INFO;
  const hasAny = (bankAccounts && bankAccounts.length > 0) || detraccionAccount?.accountNumber || yape || plin;
  if (!hasAny) return [];

  const bankRows: any[] = (bankAccounts || []).map((acc) => [
    { text: `${acc.bank} (${acc.currency})`, bold: true, fontSize: 8, alignment: 'center' },
    { text: acc.accountNumber || '—', fontSize: 8, alignment: 'center' },
    { text: acc.cci || '—', fontSize: 8, alignment: 'center' },
    { text: acc.holder || '—', fontSize: 8, alignment: 'center' },
  ]);

  const walletRows: any[] = [];
  if (yape?.number) walletRows.push([
    { text: 'Yape', bold: true, fontSize: 8, fillColor: '#f3e8ff' },
    { text: yape.number || '—', fontSize: 8 },
    { text: yape.holder || '—', fontSize: 8, color: '#6b7280' },
  ]);
  if (plin?.number) walletRows.push([
    { text: 'Plin', bold: true, fontSize: 8, fillColor: '#cffafe' },
    { text: plin.number || '—', fontSize: 8 },
    { text: plin.holder || '—', fontSize: 8, color: '#6b7280' },
  ]);

  return [
    { text: '', margin: [0, 6] },
    { text: 'FORMAS DE PAGO', bold: true, alignment: 'center', fontSize: 9, margin: [0, 0, 0, 2] },
    ...(bankRows.length > 0 ? [{
      table: {
        widths: [75, 100, 135, '*'],
        body: [
          [
            { text: '', fontSize: 8 },
            { text: 'Cuenta:', bold: true, fontSize: 8, alignment: 'center' },
            { text: 'CCI:', bold: true, fontSize: 8, alignment: 'center' },
            { text: 'Titular:', bold: true, fontSize: 8, alignment: 'center' },
          ],
          ...bankRows,
        ],
      },
      layout: {
        hLineColor: () => BRAND_GREEN_DARK, vLineColor: () => BRAND_GREEN_DARK,
        hLineWidth: () => 0.8, vLineWidth: () => 0.8,
        paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 4, paddingRight: () => 4,
      },
    }] : []),
    ...(detraccionAccount?.accountNumber ? [
      { text: '', margin: [0, 2] },
      {
        table: {
          widths: [105, 145, '*'],
          body: [[
            { text: 'Cta. Detracciones:', bold: true, fontSize: 8 },
            { text: `${detraccionAccount.bank}:`, fontSize: 8 },
            { text: detraccionAccount.accountNumber, fontSize: 8, alignment: 'center' },
          ]],
        },
        layout: {
          hLineColor: () => BRAND_GREEN_DARK, vLineColor: () => BRAND_GREEN_DARK,
          hLineWidth: () => 0.8, vLineWidth: () => 0.8,
          paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 4, paddingRight: () => 4,
        },
      },
    ] : []),
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

function buildPaymentsBlock(quote: any, currencySymbol: string): any[] {
  const payments: { paymentMethodName: string; amount: number }[] = quote.payments || [];
  if (!payments.length) return [];

  const paid = Math.round(payments.reduce((s: number, p: any) => s + p.amount, 0) * 100) / 100;
  const saldo = Math.round((quote.total - paid) * 100) / 100;

  const paymentRows = payments.map((p) => [
    { text: p.paymentMethodName, fontSize: 8, color: '#374151' },
    { text: `${currencySymbol} ${p.amount.toFixed(2)}`, fontSize: 8, alignment: 'right', color: '#374151' },
  ]);

  return [
    { text: '', margin: [0, 6] },
    {
      table: {
        widths: ['*', 120],
        body: [
          [
            { text: 'A CUENTA', bold: true, color: 'white', fillColor: '#16a34a', fontSize: 9, margin: [4, 3] },
            { text: `${currencySymbol} ${paid.toFixed(2)}`, bold: true, color: 'white', fillColor: '#16a34a', fontSize: 9, alignment: 'right', margin: [4, 3] },
          ],
          ...paymentRows,
          [
            { text: 'SALDO', bold: true, fontSize: 9, color: saldo > 0 ? '#dc2626' : '#16a34a', margin: [4, 3] },
            { text: `${currencySymbol} ${saldo.toFixed(2)}`, bold: true, fontSize: 9, alignment: 'right', color: saldo > 0 ? '#dc2626' : '#16a34a', margin: [4, 3] },
          ],
        ],
      },
      layout: {
        hLineColor: () => BORDER_GRAY, vLineColor: () => BORDER_GRAY,
        hLineWidth: () => 1, vLineWidth: () => 1,
        paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 4, paddingRight: () => 4,
      },
    },
  ];
}

export function buildQuotePdfDefinition({ quote, products, company, client, vendor, currency, logoDataUrl }: BuildParams) {
  const getProduct = (id: string) => products.find(p => p.id === id);
  const commercial = getQuoteCommercialDetails(quote);
  const effectiveCurrency = quote.currency || currency || 'PEN';
  const currencySymbol = effectiveCurrency === 'USD' ? 'US$' : 'S/';
  const tcRate = quote.exchangeRate || 0;
  const headerName = COMPANY_INFO.legalName || company?.name || 'EMPRESA';
  const headerAddress = COMPANY_INFO.address || company?.address || '';
  const headerPhone = COMPANY_INFO.phone || company?.phone || '';
  const headerRuc = COMPANY_INFO.ruc || company?.ruc || '—';
  const headerEmail = COMPANY_INFO.email || '';
  const clientName = quote.clientName || client?.name || '—';
  const clientDocumentNumber = quote.clientDocumentNumber || client?.documentNumber || '—';
  const clientAddress = quote.clientAddress || client?.address || '—';
  const clientPhone = quote.clientPhone || client?.phone || '—';
  const clientEmail = quote.clientEmail || client?.email || '—';
  const clientContact = quote.clientContact || '—';
  const vendorName = quote.sellerName || vendor?.name || 'Equipo Comercial';
  const vendorPhone = vendor?.phone || headerPhone || '—';
  const salesEmail = COMPANY_INFO.salesEmail || vendor?.email || headerEmail || '—';
  const creditInstallments = [...(quote.installments || [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const hasInstallments = commercial.paymentTerm === 'CRÉDITO'
    && quote.paymentScheduleType === 'INSTALLMENTS'
    && creditInstallments.length > 0;
  const commercialNoteParts = [`Forma de pago: ${commercial.paymentTerm}`];
  if (commercial.paymentTerm === 'CRÉDITO') {
    commercialNoteParts.push(`Plazo: ${quote.creditDays ? `${quote.creditDays} días` : '—'}`);
    commercialNoteParts.push(`Cuotas: ${hasInstallments ? creditInstallments.length : 1}`);
  }
  const commercialNote = `${commercialNoteParts.join(', ')}${commercial.observations ? `. ${commercial.observations}` : ''}`;

  const isExonerado = (taxType?: string) => taxType === 'EXONERADO' || taxType === 'INAFECTO';
  const gravadoTotal = quote.items.filter(it => !isExonerado(getProduct(it.productId)?.taxType)).reduce((s, it) => s + it.subtotal, 0);
  const exoneradoTotal = quote.items.filter(it => isExonerado(getProduct(it.productId)?.taxType)).reduce((s, it) => s + it.subtotal, 0);
  const opGravadas = Math.round((gravadoTotal / (1 + IGV_RATE)) * 100) / 100;
  const igv = Math.round((gravadoTotal - opGravadas) * 100) / 100;

  const itemsRows = quote.items.map((it, idx) => {
    const p = getProduct(it.productId);
    return [
      { text: idx + 1, alignment: 'center', fontSize: 8 },
      { text: getQuoteItemProductName(it, p), alignment: 'left', fontSize: 8 },
      { text: it.quantity.toFixed(2), alignment: 'center', fontSize: 8 },
      { text: (getQuoteItemProductUnit(it, p) || 'UND').toUpperCase().slice(0, 4), alignment: 'center', fontSize: 8 },
      { text: it.unitPrice.toFixed(2), alignment: 'right', fontSize: 8 },
      { text: it.subtotal.toFixed(2), alignment: 'right', fontSize: 8 },
    ];
  });

  while (itemsRows.length < 6) {
    itemsRows.push([
      { text: ' ', alignment: 'center', fontSize: 8 }, { text: ' ', alignment: 'left', fontSize: 8 },
      { text: ' ', alignment: 'center', fontSize: 8 }, { text: ' ', alignment: 'center', fontSize: 8 }, { text: ' ', alignment: 'right', fontSize: 8 }, { text: ' ', alignment: 'right', fontSize: 8 },
    ]);
  }

  return {
    pageSize: 'A4',
    pageMargins: [24, 18, 24, 24],
    content: [
      // ===== HEADER =====
      {
        columns: [
          ...(logoDataUrl
            ? [{
              image: logoDataUrl,
              // El archivo del logo es cuadrado y tiene bastante espacio blanco.
              // `cover` recorta ese margen al mostrarlo para que la marca se vea
              // realmente más grande sin aumentar la altura del encabezado.
              cover: { width: 170, height: 88, align: 'center', valign: 'center' },
              margin: [0, 0, 6, 0],
            } as any]
            : []),
          {
            width: '*',
            stack: [
              { text: headerName, style: 'companyName' },
              ...(headerAddress ? [{ text: `Dirección : ${headerAddress}`, style: 'companyDetail' }] : []),
              ...(headerPhone ? [{ text: `Teléfonos : ${headerPhone}`, style: 'companyDetail' }] : []),
              ...(headerEmail ? [{ text: `E-mail : ${headerEmail}`, style: 'companyDetail' }] : []),
            ],
            margin: [0, 7, 4, 0],
          },
          {
            width: 175,
            table: {
              widths: ['*'],
              body: [
                [{ text: `R.U.C. ${headerRuc}`, alignment: 'center', bold: true, fontSize: 10, margin: [0, 3] }],
                [{ text: 'COTIZACIÓN', alignment: 'center', bold: true, fontSize: 13, fillColor: TABLE_HEADER_FILL, margin: [0, 4] }],
                [{ text: `NRO-${String(quote.number || 0).padStart(8, '0')}`, alignment: 'center', bold: true, fontSize: 10, margin: [0, 3] }],
              ],
            },
            layout: {
              hLineColor: () => BRAND_GREEN_DARK, vLineColor: () => BRAND_GREEN_DARK,
              hLineWidth: () => 0.8, vLineWidth: () => 0.8,
            },
          },
        ],
      },

      { text: '', margin: [0, 4] },

      // ===== CLIENT BLOCK =====
      { text: 'DATOS DEL CLIENTE', bold: true, fontSize: 9, margin: [2, 0, 0, 2] },
      {
        table: {
          widths: [62, 5, '*', 82, 5, 95],
          body: [
            [
              { text: 'Cliente', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: clientName.toUpperCase(), fontSize: 8, colSpan: 4 }, {}, {}, {},
            ],
            [
              { text: 'R.U.C. / D.N.I.', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: clientDocumentNumber, fontSize: 8, colSpan: 4 }, {}, {}, {},
            ],
            [
              { text: 'Dirección', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: clientAddress, fontSize: 8 },
              { text: 'Vendedor', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: vendorName.toUpperCase(), fontSize: 8 },
            ],
            [
              { text: 'Contacto', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: clientContact, fontSize: 8 },
              { text: 'Teléfono', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: vendorPhone, fontSize: 8 },
            ],
            [
              { text: 'Teléfono', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: clientPhone, fontSize: 8 },
              { text: 'E-mail', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: salesEmail, fontSize: 7 },
            ],
            [
              { text: 'E-mail', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: clientEmail, fontSize: 8 },
              { text: '', fontSize: 8 }, { text: '', fontSize: 8 }, { text: '', fontSize: 8 },
            ],
            [
              { text: 'Fecha Emisión', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: formatDate(quote.issueDate), fontSize: 8 },
              { text: 'Fecha Vencimiento', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: formatDate(quote.validUntil), fontSize: 8 },
            ],
          ],
        },
        layout: {
          hLineColor: () => BORDER_GRAY, vLineColor: () => BORDER_GRAY,
          hLineWidth: () => 0.6, vLineWidth: () => 0.6,
          paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 4, paddingRight: () => 4,
        },
      },

      {
        stack: [
          { text: 'Estimado(s) Sr(s):', fontSize: 9 },
          { text: 'Reciba nuestro más cordial saludo, a la vez, aprovechamos en hacer llegar la cotización solicitada.', fontSize: 8, color: '#374151', margin: [0, 2, 0, 0] },
        ],
        margin: [2, 5, 2, 5],
      },

      // ===== ITEMS TABLE =====
      {
        table: {
          headerRows: 1,
          widths: [25, '*', 35, 30, 45, 50],
          body: [
            [
              { text: 'ÍTEM', style: 'thead' },
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
          fillColor: (row: number) => (row === 0 ? TABLE_HEADER_FILL : null),
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
          { text: numberToWords(quote.total, effectiveCurrency), fontSize: 8 },
        ],
        margin: [2, 2, 2, 2],
      },

      { text: '', margin: [0, 6] },

      // ===== COMMERCIAL CONDITIONS + TOTALS =====
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'CONDICIONES COMERCIALES', bold: true, fontSize: 9, margin: [2, 0, 0, 2] },
              {
                table: {
                  widths: [90, 5, '*'],
                  body: [
                    [{ text: 'Condición de Venta', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: commercial.paymentTerm, fontSize: 8 }],
                    [{ text: 'Tiempo de Entrega', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: commercial.deliveryTime || '—', fontSize: 8 }],
                    [{ text: 'Lugar de Entrega', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: commercial.deliveryPlace || clientAddress, fontSize: 8 }],
                    [{ text: 'Nota', bold: true, fontSize: 8 }, { text: ':', fontSize: 8 }, { text: commercialNote, fontSize: 8 }],
                  ],
                },
                layout: {
                  hLineColor: () => BORDER_GRAY, vLineColor: () => BORDER_GRAY,
                  hLineWidth: () => 0.6, vLineWidth: () => 0.6,
                  paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 4, paddingRight: () => 4,
                },
              },
            ],
          },
          { width: 10, text: '' },
          {
            width: 200,
            table: {
              widths: ['*', 30, 60],
              body: [
                [
                  { text: 'OP. GRAVADAS', bold: true, fillColor: TABLE_HEADER_FILL, fontSize: 9, alignment: 'right', margin: [4, 3] },
                  { text: currencySymbol, fontSize: 9, alignment: 'center', margin: [0, 3] },
                  { text: opGravadas.toFixed(2), fontSize: 9, alignment: 'right', margin: [0, 3] },
                ],
                ...(exoneradoTotal > 0 ? [[
                  { text: 'OP. EXONERADAS', bold: true, fillColor: TABLE_HEADER_FILL, fontSize: 9, alignment: 'right', margin: [4, 3] },
                  { text: currencySymbol, fontSize: 9, alignment: 'center', margin: [0, 3] },
                  { text: exoneradoTotal.toFixed(2), fontSize: 9, alignment: 'right', margin: [0, 3] },
                ]] : []),
                [
                  { text: 'I.G.V. 18%', bold: true, fillColor: TABLE_HEADER_FILL, fontSize: 9, alignment: 'right', margin: [4, 3] },
                  { text: currencySymbol, fontSize: 9, alignment: 'center', margin: [0, 3] },
                  { text: igv.toFixed(2), fontSize: 9, alignment: 'right', margin: [0, 3] },
                ],
                [
                  { text: 'IMPORTE TOTAL', bold: true, fillColor: TABLE_HEADER_FILL, fontSize: 10, alignment: 'right', margin: [4, 3] },
                  { text: currencySymbol, fontSize: 10, alignment: 'center', bold: true, margin: [0, 3] },
                  { text: quote.total.toFixed(2), fontSize: 10, alignment: 'right', bold: true, margin: [0, 3] },
                ],
                ...(effectiveCurrency === 'USD' && tcRate > 0 ? [[
                  { text: `T.C. ${tcRate.toFixed(2)} — Equiv. S/`, fontSize: 8, color: '#6b7280', alignment: 'right', margin: [4, 2] },
                  { text: 'S/', fontSize: 8, color: '#6b7280', alignment: 'center', margin: [0, 2] },
                  { text: (quote.total * tcRate).toFixed(2), fontSize: 8, color: '#6b7280', alignment: 'right', margin: [0, 2] },
                ]] : []),
              ],
            },
            layout: {
              hLineColor: () => BORDER_GRAY, vLineColor: () => BORDER_GRAY,
              hLineWidth: () => 1, vLineWidth: () => 1,
            },
          },
        ],
      },

      ...(hasInstallments ? [
        { text: '', margin: [0, 5] },
        {
          table: {
            headerRows: 1,
            widths: [35, '*', 90],
            body: [
              [
                { text: 'CUOTA', style: 'thead' },
                { text: 'FECHA DE VENCIMIENTO', style: 'thead' },
                { text: 'MONTO', style: 'thead' },
              ],
              ...creditInstallments.map((installment, index) => [
                { text: index + 1, alignment: 'center', fontSize: 8 },
                { text: formatDate(installment.dueDate), alignment: 'center', fontSize: 8 },
                { text: `${currencySymbol} ${installment.amount.toFixed(2)}`, alignment: 'right', fontSize: 8 },
              ]),
            ],
          },
          layout: {
            fillColor: (row: number) => (row === 0 ? TABLE_HEADER_FILL : null),
            hLineColor: () => BORDER_GRAY,
            vLineColor: () => BORDER_GRAY,
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            paddingTop: () => 2,
            paddingBottom: () => 2,
          },
        },
      ] : []),

      ...buildPaymentsBlock(quote, currencySymbol),
      ...buildPaymentMethodsBlock(),
      {
        unbreakable: true,
        stack: [
          { text: 'Sin otro particular me despido pendiente de su requerimiento.', alignment: 'center', fontSize: 8, color: '#374151' },
          { text: `Atte: ${vendorName} - Área de Ventas, email: ${salesEmail}`, alignment: 'center', fontSize: 8, margin: [0, 3, 0, 0] },
        ],
        margin: [2, 8, 2, 0],
      },
    ],
    styles: {
      companyName: { fontSize: 18, bold: true, color: '#111827', margin: [0, 0, 0, 2] },
      companyDetail: { fontSize: 10, color: '#1f2937', margin: [0, 1.5, 0, 0], lineHeight: 1.1 },
      thead: { bold: true, color: '#111827', fontSize: 9, alignment: 'center' },
    },
    defaultStyle: { fontSize: 9 },
  };
}

export async function downloadQuotePdf(params: GenerateParams) {
  const [pdfMake, logoDataUrl] = await Promise.all([loadPdfMake(), loadLogoDataUrl()]);
  pdfMake.createPdf(buildQuotePdfDefinition({ ...params, logoDataUrl })).download(`${params.quote.quoteNumber}.pdf`);
}

export async function printQuotePdf(params: GenerateParams) {
  const [pdfMake, logoDataUrl] = await Promise.all([loadPdfMake(), loadLogoDataUrl()]);
  pdfMake.createPdf(buildQuotePdfDefinition({ ...params, logoDataUrl })).open();
}

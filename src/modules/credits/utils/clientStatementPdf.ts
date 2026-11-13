import type { Client, CreditAccount, CreditPayment, Sale } from '../../../shared/types';
import { formatDateEs, getTodayDateString, toLocalDateString } from '../../../shared/utils/date.util';
import { creditCurrency, saleCurrencyAmount as saleAmount, type MoneyCurrency } from './money';
import { COMPANY_INFO, type CompanyInfo } from '../../../config/companyInfo';
import { selectClientStatementData, type ClientStatementPeriod } from './clientStatementPeriod';

interface StatementParams {
  client: Client;
  credits: CreditAccount[];
  sales?: Sale[];
  mode?: 'summary' | 'detailed';
  now?: Date;
  company?: CompanyInfo;
  logoDataUrl?: string | null;
  logoHasPadding?: boolean;
  displayFont?: string;
  period?: ClientStatementPeriod;
  creditIds?: string[];
}

const INK = '#123c32';
const GREEN = '#137547';
const TEAL = '#155d72';
const GOLD = '#efc664';
const MUTED = '#53665e';
const LINE = '#cdded2';
const PALE = '#edf6ee';
const AMBER = '#a7600e';
const RED = '#b6412c';
const BODY_WIDTH = 531.28;
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
const amount = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value?: string) => formatDateEs(value, DATE_OPTIONS) || '—';
const money = (value: number, currency?: string) => `${creditCurrency(currency) === 'USD' ? 'US$' : 'S/'} ${amount.format(value || 0)}`;
const dayKey = (value?: string) => value ? toLocalDateString(value) || '9999-12-31' : '9999-12-31';
const saleRef = (sale: Pick<Sale, 'id' | 'saleNumber'>) => sale.saleNumber || `NV-${sale.id.slice(-6).toUpperCase()}`;

function status(credit: CreditAccount, today: string) {
  if (credit.pendingAmount <= 0) return { text: 'Pagado', color: GREEN };
  if (credit.dueDate && dayKey(credit.dueDate) < today) return { text: 'Vencido', color: RED };
  return { text: credit.paidAmount > 0 ? 'Pago parcial' : 'Pendiente', color: AMBER };
}

function heading(number: number, title: string, description: string, newPage = false) {
  return {
    headlineLevel: 1,
    ...(newPage ? { pageBreak: 'before' } : {}),
    stack: [
      { table: { widths: [27, '*'], body: [[
        { text: String(number).padStart(2, '0'), style: 'display', bold: true, fontSize: 11, color: 'white', fillColor: GREEN, alignment: 'center', margin: [0, 3, 0, 3] },
        { text: title, style: 'display', bold: true, fontSize: 13, color: INK, margin: [7, 2, 0, 0] },
      ]] }, layout: 'noBorders' },
      { text: description, fontSize: 9, color: MUTED, margin: [0, 4, 0, 0] },
    ],
    margin: [0, newPage ? 6 : 10, 0, 8],
  };
}

const tableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0,
  hLineColor: () => LINE,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 8,
  paddingBottom: () => 8,
};

const th = (text: string, alignment = 'left') => ({ text, bold: true, fontSize: 8.5, color: 'white', fillColor: GREEN, alignment });
const spanning = (node: any, count: number) => [{ ...node, colSpan: count }, ...Array.from({ length: count - 1 }, () => ({}))];

function metrics(total: number, paid: number, pending: number, currency: MoneyCurrency) {
  return {
    columns: [
      { stack: [{ text: 'Monto al crédito', style: 'label' }, { text: money(total, currency), style: 'metric' }] },
      { stack: [{ text: 'Abonos aplicados', style: 'label' }, { text: money(paid, currency), style: 'metric', color: GREEN }] },
      { stack: [{ text: 'Saldo por pagar', style: 'label' }, { text: money(pending, currency), style: 'metric', color: pending > 0 ? AMBER : GREEN }] },
    ],
    columnGap: 12,
  };
}

function creditReferences(credit: CreditAccount, salesById: Map<string, Sale>): string[] {
  const details = new Map((credit.saleDetails || []).map(sale => [sale.saleId, sale]));
  const ids = new Set([...(credit.saleIds || []), ...details.keys()]);
  return [...ids].filter(Boolean).map(id => {
    const sale = salesById.get(id);
    return sale ? saleRef(sale) : details.get(id)?.saleNumber || saleRef({ id });
  });
}

function summary(credits: CreditAccount[], today: string) {
  const currencies = (['PEN', 'USD'] as const).filter(currency => credits.some(c => creditCurrency(c.currency) === currency));
  return currencies.map(currency => {
    const accounts = credits.filter(c => creditCurrency(c.currency) === currency);
    const total = accounts.reduce((sum, c) => sum + c.totalAmount, 0);
    const paid = accounts.reduce((sum, c) => sum + c.paidAmount, 0);
    const pending = accounts.reduce((sum, c) => sum + c.pendingAmount, 0);
    const open = accounts.filter(c => c.pendingAmount > 0);
    const overdue = open.filter(c => status(c, today).text === 'Vencido').reduce((sum, c) => sum + c.pendingAmount, 0);
    const paidPercent = total > 0 ? Math.max(0, Math.min(100, paid / total * 100)) : 0;
    const balance = money(pending, currency);
    const accent = currency === 'USD' ? TEAL : GREEN;
    return {
      table: {
        widths: [176, '*'],
        body: [[{
          stack: [
            { text: currency === 'USD' ? 'DÓLARES · USD' : 'SOLES · PEN', fontSize: 8.5, bold: true, characterSpacing: 1, color: 'white' },
            { text: balance, style: 'display', bold: true, fontSize: balance.length > 13 ? 20 : 25, color: GOLD, margin: [0, 7, 0, 3] },
            { text: 'SALDO POR PAGAR', fontSize: 9, bold: true, color: 'white' },
          ],
          fillColor: accent,
          margin: [8, 6, 7, 6],
        }, {
          stack: [
            { columns: [
              { stack: [{ text: 'Monto al crédito', style: 'label' }, { text: money(total, currency), style: 'metric' }] },
              { stack: [{ text: 'Abonos aplicados', style: 'label' }, { text: money(paid, currency), style: 'metric', color: GREEN }] },
            ], columnGap: 10 },
            { canvas: [
              { type: 'rect', x: 0, y: 0, w: 262, h: 4, color: LINE },
              { type: 'rect', x: 0, y: 0, w: 262 * paidPercent / 100, h: 4, color: accent },
            ], margin: [0, 6, 0, 4] },
            { text: open.length ? `${paidPercent.toFixed(0)}% abonado · ${open.length} cuenta${open.length === 1 ? '' : 's'} con saldo` : 'Sin saldo pendiente en estas cuentas', fontSize: 8.5, color: MUTED },
            ...(overdue > 0 ? [{ text: `${money(overdue, currency)} vencidos`, fontSize: 8.5, bold: true, color: RED, margin: [0, 3, 0, 0] }] : []),
          ], fillColor: currency === 'USD' ? '#edf5f8' : PALE, margin: [10, 6, 6, 6],
        }]],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 6],
      unbreakable: true,
    };
  });
}

function purchaseTable(sales: Sale[], accountBySale: Map<string, number>) {
  const totals = (['PEN', 'USD'] as const).filter(currency => sales.some(sale => creditCurrency(sale.currency) === currency)).map(currency => {
    const values = sales.filter(sale => creditCurrency(sale.currency) === currency).map(sale => saleAmount(sale, sale.total, sale.totalUsd));
    const total = values.every(value => value != null) ? money(values.reduce<number>((sum, value) => sum + value!, 0), currency) : 'No disponible';
    return `Compras en ${currency === 'USD' ? 'dólares' : 'soles'}: ${total}`;
  });
  return {
    stack: [
      { text: totals.join('   ·   '), fontSize: 10, bold: true, color: GREEN, margin: [0, 0, 0, 14] },
      ...sales.map(sale => {
        const total = saleAmount(sale, sale.total, sale.totalUsd);
        const initialParts = (sale.payments || []).map(p => saleAmount(sale, p.amount, p.amountUsd));
        const initial = initialParts.every(p => p != null) ? initialParts.reduce<number>((sum, p) => sum + p!, 0) : undefined;
        const account = accountBySale.get(sale.id);
        const methods = [...new Set((sale.payments || []).map(p => p.paymentMethodName).filter(Boolean))];
        const voucher = sale.voucherType === 'FACTURA' ? 'Factura' : sale.voucherType === 'BOLETA' ? 'Boleta' : 'Nota de venta';
        const condition = sale.isCourtesy ? 'Cortesía' : sale.isCredit ? 'AL CRÉDITO' : 'AL CONTADO';
        const productRows: any[][] = sale.items?.length ? sale.items.map((item, index) => {
          const unit = saleAmount(sale, item.unitPrice, item.unitPriceUsd);
          const subtotal = saleAmount(sale, item.subtotal, item.subtotalUsd);
          const fillColor = index % 2 ? '#f4f8f5' : 'white';
          return [
            { text: item.productName || 'Producto', fillColor },
            { text: String(item.quantity), alignment: 'center', bold: true, fillColor },
            { text: unit == null ? 'No registrado' : money(unit, sale.currency), alignment: 'right', fillColor },
            { text: subtotal == null ? 'No registrado' : money(subtotal, sale.currency), alignment: 'right', bold: true, fillColor },
          ];
        }) : [spanning({ text: 'Sin detalle de productos registrado.', color: MUTED }, 4)];
        const paymentLines: any[] = [];
        if (sale.isCredit && initial != null) {
          paymentLines.push({ text: initial > 0 ? `Inicial: ${money(initial, sale.currency)}` : 'Sin pago inicial', bold: true, color: TEAL });
          if (initial > 0 && methods.length) paymentLines.push({ text: `Método de la inicial: ${methods.join(' + ')}`, color: MUTED });
          if (total != null) paymentLines.push({ text: `Importe financiado de esta venta: ${money(total - initial, sale.currency)}`, color: INK });
        } else if (!sale.isCourtesy && initial != null) {
          paymentLines.push({ text: `Pagado al comprar: ${money(initial, sale.currency)}`, bold: true, color: GREEN });
          if (methods.length) paymentLines.push({ text: `Método de pago: ${methods.join(' + ')}`, color: MUTED });
        }
        if (account != null) paymentLines.push({ text: `Los abonos posteriores están en la cuenta ${String(account).padStart(2, '0')}.`, color: MUTED });
        if (sale.sellerName) paymentLines.push({ text: `Atendido por: ${sale.sellerName}`, color: MUTED });
        return {
          table: {
            headerRows: 2, keepWithHeaderRows: 1,
            widths: ['*', 36, 87, 87],
            body: [
              spanning({ stack: [
                { columns: [
                  { text: saleRef(sale), style: 'display', bold: true, fontSize: 14, color: 'white' },
                  { text: date(sale.date), bold: true, fontSize: 11, color: 'white', alignment: 'right' },
                ] },
                { text: `${voucher}${sale.series && sale.number != null ? ` ${sale.series}-${String(sale.number).padStart(8, '0')}` : ''}  ·  ${condition}`, color: '#d9eddf', fontSize: 9, margin: [0, 4, 0, 0] },
              ], fillColor: INK, margin: [2, 3, 2, 3] }, 4),
              [th('Producto / Presentación'), th('Cant.', 'center'), th('Precio unitario', 'right'), th('Subtotal', 'right')],
              ...productRows,
              [
                ...spanning({ text: 'TOTAL DE LA COMPRA', fontSize: 9, bold: true, color: INK, fillColor: '#f9efd3', alignment: 'right' }, 3),
                { text: total == null ? 'USD sin importe registrado' : money(total, sale.currency), alignment: 'right', style: 'display', fontSize: 12, bold: true, color: INK, fillColor: '#f9efd3' },
              ],
              ...(paymentLines.length ? [spanning({ stack: paymentLines, fontSize: 9, lineHeight: 1.25, margin: [0, 2, 0, 2] }, 4)] : []),
            ],
          },
          layout: tableLayout,
          unbreakable: (sale.items?.length || 0) <= 5 && (sale.items || []).every(item => (item.productName || '').length < 180) && paymentLines.every(line => line.text.length < 250),
          margin: [0, 0, 0, 15],
        };
      }),
    ],
  };
}

function accountSummary(credits: CreditAccount[], salesById: Map<string, Sale>, today: string) {
  return {
    table: {
      headerRows: 1,
      keepWithHeaderRows: 1,
      dontBreakRows: true,
      widths: ['*', 74, 78, 78],
      body: [
        [th('Cuenta / Vencimiento'), th('Monto al crédito', 'right'), th('Abonos aplicados', 'right'), th('Por pagar', 'right')],
        ...credits.map((credit, index) => {
          const badge = status(credit, today);
          return [
            { stack: [
              { text: `Cuenta ${String(index + 1).padStart(2, '0')}${credit.name ? ` · ${credit.name}` : ''}`, bold: true, fontSize: 10 },
              { text: creditReferences(credit, salesById).join(' · ') || 'Crédito sin venta asociada', fontSize: 8, color: MUTED, margin: [0, 3, 0, 0] },
              { text: `${badge.text} · ${credit.dueDate ? `Vence: ${date(credit.dueDate)}` : 'Sin vencimiento registrado'}`, fontSize: 8, color: badge.color, margin: [0, 3, 0, 0] },
            ] },
            { text: money(credit.totalAmount, credit.currency), alignment: 'right' },
            { text: money(credit.paidAmount, credit.currency), alignment: 'right', color: GREEN },
            { text: money(credit.pendingAmount, credit.currency), alignment: 'right', bold: true, color: badge.color },
          ];
        }),
      ],
    },
    layout: { ...tableLayout, paddingTop: () => 5, paddingBottom: () => 5 },
  };
}

function paymentDetail(payment: CreditPayment, credit: CreditAccount): string {
  const lines: string[] = [];
  if (payment.paymentCurrency && creditCurrency(payment.paymentCurrency) !== creditCurrency(credit.currency) && payment.receivedAmount != null) {
    lines.push(`Recibido: ${money(payment.receivedAmount, payment.paymentCurrency)}`);
    if (payment.exchangeRate) lines.push(`Tipo de cambio: ${payment.exchangeRate}`);
  }
  if (payment.receivedByName) lines.push(`Recibió: ${payment.receivedByName}`);
  if (payment.notes) lines.push(payment.notes);
  return lines.join('\n') || '—';
}

function accountDetail(credit: CreditAccount, index: number, salesById: Map<string, Sale>, today: string, includeProducts: boolean) {
  const badge = status(credit, today);
  const payments = [...(credit.payments || [])].sort((a, b) => dayKey(a.paymentDate).localeCompare(dayKey(b.paymentDate)));
  const refs = creditReferences(credit, salesById);
  const previousPaid = Math.round((credit.paidAmount - payments.reduce((sum, p) => sum + p.amount, 0)) * 100) / 100;
  const body: any[][] = [
    spanning({
      stack: [
        { columns: [
          { text: `Cuenta ${String(index + 1).padStart(2, '0')}${credit.name ? ` · ${credit.name}` : ''}`, style: 'display', bold: true, fontSize: 12, color: 'white', width: '*' },
          { text: badge.text, bold: true, color: GOLD, alignment: 'right', width: 78, fontSize: 9 },
        ], columnGap: 10 },
        { text: `Fecha: ${date(credit.createdAt)}   ·   ${credit.dueDate ? `Vencimiento: ${date(credit.dueDate)}` : 'Sin vencimiento registrado'}`, fontSize: 8.5, color: '#d9eddf', margin: [0, 6, 0, 0] },
      ],
      fillColor: INK,
    }, 4),
    spanning({ ...metrics(credit.totalAmount, credit.paidAmount, credit.pendingAmount, creditCurrency(credit.currency)), fillColor: PALE, margin: [0, 5, 0, 5] }, 4),
    [th('Fecha de pago'), th('Método de pago'), th('Monto aplicado', 'right'), th('Detalle del abono')],
  ];
  if (refs.length) body.push(spanning({ text: `Ventas de esta cuenta: ${refs.join(' · ')}`, fontSize: 9, bold: true, color: TEAL, fillColor: '#edf5f8' }, 4));
  if (includeProducts) {
    for (const sale of credit.saleDetails || []) {
      if (sale.items?.length) body.push(spanning({
        text: sale.items.map(item => `${item.quantity} × ${item.productName}`).join(' · '), fontSize: 8.5, color: MUTED,
      }, 4));
    }
  }
  body.push(...payments.map(payment => [
    { text: date(payment.paymentDate), bold: true },
    { text: payment.paymentMethodName || 'No registrado' },
    { text: money(payment.amount, credit.currency), alignment: 'right', bold: true, color: GREEN },
    { text: paymentDetail(payment, credit), fontSize: 9, color: MUTED },
  ]));
  if (previousPaid > 0.01) {
    body.push(spanning({ text: `Los abonos aplicados incluyen ${money(previousPaid, credit.currency)} sin detalle individual registrado.`, fontSize: 9, color: MUTED, fillColor: '#fff7e6' }, 4));
  } else if (!payments.length) {
    body.push(spanning({ text: 'Sin abonos registrados en esta cuenta.', color: MUTED, fontSize: 9 }, 4));
  }
  // Normal payment rows stay together; exceptionally long notes may flow across pages.
  const keepRowsTogether = body.every(row => row.every(cell => typeof cell.text !== 'string' || cell.text.length < 1000));
  return {
    table: { headerRows: 3, keepWithHeaderRows: 1, dontBreakRows: keepRowsTogether, widths: [65, 91, 86, '*'], body },
    layout: tableLayout,
    margin: [0, 0, 0, 14],
  };
}

function brandedHeader(company: CompanyInfo, logoDataUrl: string | null | undefined, mode: 'summary' | 'detailed', logoHasPadding: boolean) {
  const contact = [
    company.ruc && `RUC: ${company.ruc}`, company.address,
    company.phone && `Tel.: ${company.phone}`, company.email || company.salesEmail, company.website,
  ].filter(Boolean);
  return [
    {
      table: {
        widths: [174, '*'],
        body: [[
          {
            stack: [
              ...(logoDataUrl ? [{ image: 'statementLogo', ...(logoHasPadding ? { cover: { width: 166, height: 76, align: 'center', valign: 'center' } } : { fit: [166, 76] }) }] : []),
              { text: company.legalName, style: 'display', bold: true, fontSize: logoDataUrl ? 11 : 23, alignment: 'center', color: GREEN, margin: [0, logoDataUrl ? 1 : 24, 0, 6] },
            ], fillColor: 'white', margin: [3, 0, 3, 0],
          },
          {
            stack: [
              { text: mode === 'summary' ? 'RESUMEN  /  CLIENTES' : 'REPORTE DETALLADO  /  CLIENTES', color: GOLD, bold: true, fontSize: 8, characterSpacing: 1 },
              { text: 'ESTADO DE\nCUENTA', style: 'display', bold: true, fontSize: 25, color: 'white', lineHeight: 1, margin: [0, 5, 0, 4] },
              { text: 'Compras · Créditos · Pagos', fontSize: 9, color: '#d9eddf' },
            ], fillColor: INK, margin: [14, 6, 10, 6],
          },
        ]],
      },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
    },
    { canvas: [{ type: 'rect', x: 0, y: 0, w: BODY_WIDTH, h: 4, color: GOLD }], margin: [0, 0, 0, 7] },
    ...(contact.length ? [{ text: contact.join('   ·   '), fontSize: 8, color: MUTED, margin: [0, 0, 0, 9] }] : []),
  ];
}

/** Client-facing report: each credit and its payments appear once, even for grouped sales. */
export function buildClientStatementDocument({
  client, credits: inputCredits, sales: inputSales, mode = 'detailed', now = new Date(),
  company = COMPANY_INFO, logoDataUrl, logoHasPadding = false, displayFont = 'Roboto', period, creditIds,
}: StatementParams) {
  const today = getTodayDateString(now);
  const selection = selectClientStatementData(inputCredits, inputSales, period, creditIds);
  const credits = [...new Map(selection.credits.map(c => [c.id, c])).values()].sort((a, b) => dayKey(a.createdAt).localeCompare(dayKey(b.createdAt)));
  const sales = selection.sales.sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)));
  const salesById = new Map(sales.map(s => [s.id, s]));
  const accountBySale = new Map<string, number>();
  credits.forEach((credit, index) => (credit.saleIds || []).forEach(id => accountBySale.set(id, index + 1)));
  const dates = [...sales.map(s => dayKey(s.date)), ...credits.flatMap(c => [dayKey(c.createdAt), ...(c.payments || []).map(p => dayKey(p.paymentDate))])].filter(d => d !== '9999-12-31').sort();
  const openCount = credits.filter(c => c.pendingAmount > 0).length;
  const contact = [client.phone && `Teléfono: ${client.phone}`, client.email].filter(Boolean).join(' · ');
  const content: any[] = [
    ...brandedHeader(company, logoDataUrl, mode, logoHasPadding),
    {
      table: {
        widths: ['*', 135],
        body: [[
          { stack: [
            { text: 'CLIENTE', style: 'eyebrow' },
            { text: client.name, style: 'display', bold: true, fontSize: 13, color: INK, margin: [0, 3, 0, 3] },
            ...(client.documentNumber ? [{ text: `Documento: ${client.documentNumber}`, fontSize: 9 }] : []),
            ...(client.address ? [{ text: client.address, fontSize: 9, color: MUTED, margin: [0, 3, 0, 0] }] : []),
            ...(contact ? [{ text: contact, fontSize: 9, color: MUTED, margin: [0, 3, 0, 0] }] : []),
          ], fillColor: PALE },
          { stack: [
            { text: 'FECHA DE EMISIÓN', style: 'eyebrow' },
            { text: date(today), style: 'display', bold: true, fontSize: 12, margin: [0, 3, 0, 5] },
            { text: period ? 'PERIODO SELECCIONADO' : 'OPERACIONES INCLUIDAS', style: 'eyebrow' },
            { text: period ? `${date(period.from)} al ${date(period.to)}` : dates.length ? `${date(dates[0])} al ${date(dates[dates.length - 1])}` : 'Sin movimientos', fontSize: 8.5, color: MUTED, margin: [0, 3, 0, 0] },
          ], fillColor: PALE },
        ]],
      },
      layout: { hLineWidth: () => 0, vLineWidth: (i: number) => i === 0 ? 3 : 0, vLineColor: () => GOLD, paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 8, paddingBottom: () => 8 },
    },
    { text: `${inputSales ? `${sales.length} compras   ·   ` : ''}${credits.length} cuentas   ·   ${openCount} con saldo   ·   ${credits.reduce((sum, c) => sum + (c.payments?.length || 0), 0)} abonos con detalle`, fontSize: 9, bold: true, color: GREEN, margin: [0, 6, 0, 0] },
    ...(period ? [{ text: 'El periodo selecciona las cuentas por su fecha de creación y las compras por su fecha de venta. Los abonos y saldos de las cuentas seleccionadas están actualizados a la fecha de emisión de este reporte.', style: 'note', margin: [0, 5, 0, 0] }] : []),
    ...(creditIds !== undefined ? [{ text: 'Este reporte incluye únicamente las cuentas seleccionadas y sus compras asociadas dentro del periodo.', style: 'note', margin: [0, 5, 0, 0] }] : []),
    heading(1, 'Resumen financiero', 'Monto al crédito − Abonos aplicados = Saldo por pagar'),
    ...summary(credits, today),
    { text: credits.length ? 'El monto al crédito es lo financiado después de la inicial. Los abonos reducen esa deuda; las compras al contado no aumentan el saldo. Soles y dólares se presentan por separado.' : 'No hay cuentas de crédito incluidas en este reporte.', style: 'note' },
  ];
  let section = 2;
  if (credits.length) {
    content.push(heading(section++, 'Tus cuentas de crédito', 'Consulta el estado, el vencimiento y lo que falta pagar de cada cuenta.'), accountSummary(credits, salesById, today));
  }
  if (mode === 'detailed' && sales.length) {
    content.push(heading(section++, 'Detalle de compras', 'Productos, cantidades y precios. Cada venta indica su inicial y su forma de pago.', true), purchaseTable(sales, accountBySale));
  }
  if (mode === 'detailed' && credits.length) {
    content.push(heading(section, 'Abonos por cuenta', 'Fecha, método, monto y observaciones de cada abono. Las cuentas agrupadas se muestran una sola vez.', true));
    content.push(...credits.map((credit, index) => accountDetail(credit, index, salesById, today, inputSales === undefined)));
  }
  if (!sales.length && !credits.length) content.push({ text: 'No hay operaciones para mostrar.', margin: [0, 20, 0, 0], color: MUTED });
  return {
    pageSize: 'A4',
    pageMargins: [32, 40, 32, 50],
    info: { title: `Estado de cuenta · ${client.name}`, author: company.legalName, subject: 'Compras, créditos y pagos del cliente' },
    ...(logoDataUrl ? { images: { statementLogo: logoDataUrl } } : {}),
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: INK, lineHeight: 1.15 },
    background: (_page: number, size: { width: number }) => ({ canvas: [
      { type: 'rect', x: 0, y: 0, w: size.width, h: 8, color: GREEN },
      { type: 'rect', x: size.width - 155, y: 0, w: 155, h: 8, color: GOLD },
    ] }),
    pageBreakBefore: (node: any, container: any) => node.headlineLevel === 1
      && !container.getFollowingNodesOnPage().some((following: any) => following.table)
      && container.getNodesOnNextPage().some((following: any) => following.table),
    styles: {
      display: { font: displayFont },
      eyebrow: { fontSize: 8, bold: true, color: GREEN, characterSpacing: 0.5 },
      label: { fontSize: 8.5, color: MUTED, margin: [0, 0, 0, 4] },
      metric: { font: displayFont, fontSize: 14, bold: true, color: INK },
      note: { fontSize: 8.5, color: MUTED, lineHeight: 1.25, margin: [0, 2, 0, 0] },
    },
    header: (page: number) => page > 1 ? {
      columns: [
        { text: company.legalName.toUpperCase(), font: displayFont, bold: true, fontSize: 9, color: GREEN, width: 135 },
        { text: 'ESTADO DE CUENTA  /  ' + (mode === 'summary' ? 'RESUMEN' : 'DETALLADO'), bold: true, fontSize: 8, color: MUTED, alignment: 'right' },
      ], margin: [32, 18, 32, 0],
    } : null,
    footer: (page: number, pages: number) => ({
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: BODY_WIDTH, y2: 0, lineWidth: 1, lineColor: GREEN }] },
        { columns: [
          { text: client.name.length > 85 ? `${client.name.slice(0, 82)}…` : client.name, width: '*', color: MUTED },
          { text: `Página ${page} de ${pages}`, width: 92, alignment: 'right', color: GREEN, bold: true },
        ], margin: [0, 7, 0, 0], columnGap: 12 },
      ], fontSize: 8, margin: [32, 14, 32, 0],
    }),
  };
}

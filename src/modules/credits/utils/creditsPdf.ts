import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { CreditAccount, Client } from '../../../shared/types';

(pdfMake as any).vfs = (pdfFonts as any).vfs || (pdfFonts as any).pdfMake?.vfs;

const BRAND = '#16a34a';
const BRAND_LIGHT = '#dcfce7';
const BORDER = '#94a3b8';
const GRAY = '#6b7280';

const formatDate = (d?: string | Date) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const money = (n: number) => `S/ ${(n || 0).toFixed(2)}`;

const statusLabel = (s: string) =>
  s === 'PAID' ? 'Pagado' : s === 'PARTIAL' ? 'Parcial' : 'Pendiente';

const statusColor = (s: string) =>
  s === 'PAID' ? '#059669' : s === 'PARTIAL' ? '#2563eb' : '#d97706';

interface ExportParams {
  credits: CreditAccount[];
  clients: Client[];
  title?: string;
  subtitle?: string;
  filters?: {
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  };
}

function baseHeader(title: string, filters?: ExportParams['filters'], subtitle?: string) {
  const filterLines: string[] = [];
  if (filters?.status) filterLines.push(`Estado: ${statusLabel(filters.status)}`);
  if (filters?.search) filterLines.push(`Cliente: ${filters.search}`);
  if (filters?.startDate || filters?.endDate) {
    filterLines.push(`Rango: ${filters.startDate || '—'} → ${filters.endDate || '—'}`);
  }
  const now = new Date().toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' });

  const nodes: any[] = [
    {
      columns: [
        { text: title, fontSize: 16, bold: true, color: BRAND },
        { text: `Generado: ${now}`, fontSize: 8, color: GRAY, alignment: 'right' },
      ],
      margin: [0, 0, 0, subtitle ? 2 : 4],
    },
  ];
  if (subtitle) {
    nodes.push({ text: subtitle, fontSize: 10, bold: true, color: '#374151', margin: [0, 0, 0, 4] });
  }
  nodes.push(
    filterLines.length > 0
      ? { text: filterLines.join(' · '), fontSize: 8, color: GRAY, margin: [0, 0, 0, 8] }
      : { text: '', margin: [0, 0, 0, 4] },
  );
  return nodes;
}

function summaryTotals(credits: CreditAccount[]) {
  const total = credits.reduce((s, c) => s + c.totalAmount, 0);
  const paid = credits.reduce((s, c) => s + c.paidAmount, 0);
  const pending = credits.reduce((s, c) => s + c.pendingAmount, 0);
  return { total, paid, pending, count: credits.length };
}

function summaryCards(credits: CreditAccount[]) {
  const t = summaryTotals(credits);
  return {
    columns: [
      {
        table: {
          widths: ['*'],
          body: [[{ text: 'CUENTAS', style: 'cardHead' }], [{ text: String(t.count), style: 'cardValue' }]],
        },
        layout: { hLineColor: () => BORDER, vLineColor: () => BORDER, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
      },
      { width: 6, text: '' },
      {
        table: {
          widths: ['*'],
          body: [[{ text: 'TOTAL', style: 'cardHead' }], [{ text: money(t.total), style: 'cardValue' }]],
        },
        layout: { hLineColor: () => BORDER, vLineColor: () => BORDER, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
      },
      { width: 6, text: '' },
      {
        table: {
          widths: ['*'],
          body: [[{ text: 'PAGADO', style: 'cardHead' }], [{ text: money(t.paid), style: 'cardValueGreen' }]],
        },
        layout: { hLineColor: () => BORDER, vLineColor: () => BORDER, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
      },
      { width: 6, text: '' },
      {
        table: {
          widths: ['*'],
          body: [[{ text: 'PENDIENTE', style: 'cardHead' }], [{ text: money(t.pending), style: 'cardValueRed' }]],
        },
        layout: { hLineColor: () => BORDER, vLineColor: () => BORDER, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
      },
    ],
    margin: [0, 0, 0, 10],
  };
}

function buildSummaryByDate({ credits, clients, filters, title, subtitle }: ExportParams) {
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const getClientName = (id: string) => clientById.get(id)?.name || 'N/A';

  // Agrupar por fecha (YYYY-MM-DD) de createdAt
  const byDate = new Map<string, CreditAccount[]>();
  for (const credit of credits) {
    const d = new Date(credit.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const arr = byDate.get(key) || [];
    arr.push(credit);
    byDate.set(key, arr);
  }
  const sortedDates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));

  const groupSections: any[] = [];
  for (const date of sortedDates) {
    const group = byDate.get(date)!;
    const t = summaryTotals(group);

    const rows: any[] = group
      .sort((a, b) => b.pendingAmount - a.pendingAmount)
      .map((c) => [
        { text: getClientName(c.clientId), fontSize: 8 },
        { text: c.name || '—', fontSize: 8, color: GRAY, italics: !c.name },
        { text: money(c.totalAmount), fontSize: 8, alignment: 'right' },
        { text: money(c.paidAmount), fontSize: 8, alignment: 'right', color: '#059669' },
        { text: money(c.pendingAmount), fontSize: 8, alignment: 'right', color: '#dc2626', bold: true },
        {
          text: statusLabel(c.status),
          fontSize: 7,
          alignment: 'center',
          color: 'white',
          fillColor: statusColor(c.status),
        },
      ]);

    groupSections.push({
      margin: [0, 4, 0, 0],
      stack: [
        {
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [[
              { text: formatDate(date), bold: true, color: 'white', fillColor: BRAND, fontSize: 10, margin: [4, 3] },
              { text: `${t.count} cuenta(s)`, fontSize: 8, color: 'white', fillColor: BRAND, alignment: 'right', margin: [4, 3] },
              { text: `Total: ${money(t.total)}`, fontSize: 8, color: 'white', fillColor: BRAND, alignment: 'right', margin: [4, 3] },
              { text: `Pendiente: ${money(t.pending)}`, fontSize: 8, color: 'white', fillColor: BRAND, bold: true, alignment: 'right', margin: [4, 3] },
            ]],
          },
          layout: 'noBorders',
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 100, 60, 60, 60, 50],
            body: [
              [
                { text: 'Cliente', style: 'thead' },
                { text: 'Cuenta', style: 'thead' },
                { text: 'Total', style: 'thead', alignment: 'right' },
                { text: 'Pagado', style: 'thead', alignment: 'right' },
                { text: 'Pendiente', style: 'thead', alignment: 'right' },
                { text: 'Estado', style: 'thead', alignment: 'center' },
              ],
              ...rows,
            ],
          },
          layout: {
            fillColor: (i: number) => (i === 0 ? '#e5e7eb' : null),
            hLineColor: () => BORDER,
            vLineColor: () => BORDER,
            hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.3),
            vLineWidth: () => 0.3,
            paddingTop: () => 3,
            paddingBottom: () => 3,
            paddingLeft: () => 4,
            paddingRight: () => 4,
          },
        },
      ],
    });
  }

  return {
    pageSize: 'A4',
    pageMargins: [30, 30, 30, 30],
    content: [
      ...baseHeader(title || 'Reporte de Créditos — Resumen por fecha', filters, subtitle),
      summaryCards(credits),
      ...groupSections,
      credits.length === 0
        ? { text: 'No hay créditos para exportar.', alignment: 'center', color: GRAY, margin: [0, 30] }
        : { text: '', margin: [0, 0] },
    ],
    styles: {
      thead: { bold: true, color: 'white', fillColor: BRAND, fontSize: 9, alignment: 'left' },
      cardHead: { fontSize: 7, color: GRAY, alignment: 'center', bold: true, margin: [0, 3] },
      cardValue: { fontSize: 11, bold: true, alignment: 'center', margin: [0, 3] },
      cardValueGreen: { fontSize: 11, bold: true, alignment: 'center', color: '#059669', margin: [0, 3] },
      cardValueRed: { fontSize: 11, bold: true, alignment: 'center', color: '#dc2626', margin: [0, 3] },
    },
    defaultStyle: { fontSize: 9 },
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: GRAY,
      margin: [0, 10],
    }),
  };
}

function buildDetailed({ credits, clients, filters, title, subtitle }: ExportParams) {
  const clientById = new Map(clients.map((c) => [c.id, c]));

  // Agrupar por cliente
  const byClient = new Map<string, CreditAccount[]>();
  for (const credit of credits) {
    const arr = byClient.get(credit.clientId) || [];
    arr.push(credit);
    byClient.set(credit.clientId, arr);
  }

  const sections: any[] = [];
  const sortedClients = Array.from(byClient.entries()).sort((a, b) => {
    const na = clientById.get(a[0])?.name || '';
    const nb = clientById.get(b[0])?.name || '';
    return na.localeCompare(nb);
  });

  for (const [clientId, clientCredits] of sortedClients) {
    const client = clientById.get(clientId);
    const t = summaryTotals(clientCredits);

    sections.push({
      stack: [
        {
          table: {
            widths: ['*', 'auto'],
            body: [[
              {
                stack: [
                  { text: client?.name || 'Cliente sin nombre', fontSize: 11, bold: true, color: 'white' },
                  client?.documentNumber ? { text: `Doc: ${client.documentNumber}`, fontSize: 8, color: '#dcfce7' } : null,
                ].filter(Boolean),
                fillColor: BRAND,
                margin: [6, 4],
              },
              {
                stack: [
                  { text: `${t.count} cuenta(s) · Pendiente: ${money(t.pending)}`, fontSize: 9, color: 'white', alignment: 'right' },
                  { text: `Total: ${money(t.total)} · Pagado: ${money(t.paid)}`, fontSize: 8, color: '#dcfce7', alignment: 'right' },
                ],
                fillColor: BRAND,
                margin: [6, 4],
              },
            ]],
          },
          layout: 'noBorders',
          margin: [0, 10, 0, 0],
        },
      ],
    });

    for (const credit of clientCredits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())) {
      // Encabezado del crédito
      sections.push({
        table: {
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: [[
            { text: credit.name || 'Sin nombre', fontSize: 9, bold: true, italics: !credit.name, color: credit.name ? '#111827' : GRAY },
            { text: `Creado: ${formatDate(credit.createdAt)}`, fontSize: 8, color: GRAY, alignment: 'right' },
            { text: `Total: ${money(credit.totalAmount)}`, fontSize: 8, alignment: 'right' },
            { text: `Pend: ${money(credit.pendingAmount)}`, fontSize: 8, alignment: 'right', color: '#dc2626', bold: true },
            {
              text: statusLabel(credit.status),
              fontSize: 8,
              alignment: 'center',
              color: 'white',
              fillColor: statusColor(credit.status),
              margin: [4, 0],
            },
          ]],
        },
        layout: {
          fillColor: () => BRAND_LIGHT,
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
          hLineWidth: () => 0.3,
          vLineWidth: () => 0.3,
          paddingTop: () => 3,
          paddingBottom: () => 3,
          paddingLeft: () => 4,
          paddingRight: () => 4,
        },
        margin: [0, 3, 0, 0],
      });

      // Detalle de productos
      const saleDetails = credit.saleDetails || [];
      if (saleDetails.length > 0) {
        const itemRows: any[] = [];
        for (const sale of saleDetails) {
          itemRows.push([
            {
              text: `Venta ${formatDate(sale.date)} · ${money(sale.total)}`,
              fontSize: 7,
              color: GRAY,
              italics: true,
              colSpan: 5,
              fillColor: '#f9fafb',
            },
            {}, {}, {}, {},
          ]);
          for (const item of sale.items) {
            itemRows.push([
              { text: item.productName, fontSize: 7.5 },
              { text: item.companyName, fontSize: 7.5, color: GRAY },
              { text: item.quantity.toString(), fontSize: 7.5, alignment: 'right' },
              { text: money(item.unitPrice), fontSize: 7.5, alignment: 'right' },
              { text: money(item.subtotal), fontSize: 7.5, alignment: 'right', bold: true },
            ]);
          }
        }
        sections.push({
          table: {
            headerRows: 1,
            widths: ['*', 80, 40, 50, 50],
            body: [
              [
                { text: 'Producto', style: 'itemHead' },
                { text: 'Empresa', style: 'itemHead' },
                { text: 'Cant.', style: 'itemHead', alignment: 'right' },
                { text: 'P.U.', style: 'itemHead', alignment: 'right' },
                { text: 'Subtotal', style: 'itemHead', alignment: 'right' },
              ],
              ...itemRows,
            ],
          },
          layout: {
            fillColor: (i: number) => (i === 0 ? '#e5e7eb' : null),
            hLineColor: () => BORDER,
            vLineColor: () => BORDER,
            hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.3 : 0.15),
            vLineWidth: () => 0.15,
            paddingTop: () => 2,
            paddingBottom: () => 2,
            paddingLeft: () => 3,
            paddingRight: () => 3,
          },
        });
      }

      // Historial de pagos
      if (credit.payments && credit.payments.length > 0) {
        const paymentRows: any[] = credit.payments.map((p: any) => [
          { text: formatDate(p.paymentDate), fontSize: 7 },
          { text: p.paymentMethodName || '—', fontSize: 7, color: GRAY },
          { text: money(p.amount), fontSize: 7, alignment: 'right', bold: true, color: '#059669' },
          { text: p.notes || '', fontSize: 7, color: GRAY, italics: true },
        ]);
        sections.push({
          table: {
            headerRows: 1,
            widths: [55, 80, 50, '*'],
            body: [
              [
                { text: 'Fecha pago', style: 'itemHead' },
                { text: 'Método', style: 'itemHead' },
                { text: 'Monto', style: 'itemHead', alignment: 'right' },
                { text: 'Notas', style: 'itemHead' },
              ],
              ...paymentRows,
            ],
          },
          layout: {
            fillColor: (i: number) => (i === 0 ? '#f0fdf4' : null),
            hLineColor: () => '#d1fae5',
            vLineColor: () => '#d1fae5',
            hLineWidth: () => 0.2,
            vLineWidth: () => 0.2,
            paddingTop: () => 2,
            paddingBottom: () => 2,
            paddingLeft: () => 3,
            paddingRight: () => 3,
          },
          margin: [0, 2, 0, 0],
        });
      }
    }
  }

  return {
    pageSize: 'A4',
    pageMargins: [30, 30, 30, 30],
    content: [
      ...baseHeader(title || 'Reporte de Créditos — Detallado', filters, subtitle),
      summaryCards(credits),
      ...sections,
      credits.length === 0
        ? { text: 'No hay créditos para exportar.', alignment: 'center', color: GRAY, margin: [0, 30] }
        : { text: '', margin: [0, 0] },
    ],
    styles: {
      thead: { bold: true, color: 'white', fillColor: BRAND, fontSize: 9, alignment: 'left' },
      itemHead: { bold: true, fontSize: 7, color: '#111827', alignment: 'left' },
      cardHead: { fontSize: 7, color: GRAY, alignment: 'center', bold: true, margin: [0, 3] },
      cardValue: { fontSize: 11, bold: true, alignment: 'center', margin: [0, 3] },
      cardValueGreen: { fontSize: 11, bold: true, alignment: 'center', color: '#059669', margin: [0, 3] },
      cardValueRed: { fontSize: 11, bold: true, alignment: 'center', color: '#dc2626', margin: [0, 3] },
    },
    defaultStyle: { fontSize: 9 },
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: GRAY,
      margin: [0, 10],
    }),
  };
}

export function downloadCreditsSummaryPdf(params: ExportParams) {
  const stamp = new Date().toISOString().slice(0, 10);
  pdfMake.createPdf(buildSummaryByDate(params)).download(`creditos_resumen_${stamp}.pdf`);
}

export function downloadCreditsDetailedPdf(params: ExportParams) {
  const stamp = new Date().toISOString().slice(0, 10);
  pdfMake.createPdf(buildDetailed(params)).download(`creditos_detallado_${stamp}.pdf`);
}

interface ClientStatementParams {
  client: Client;
  credits: CreditAccount[];
  mode: 'summary' | 'detailed';
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

export function downloadClientStatementPdf({ client, credits, mode }: ClientStatementParams) {
  const stamp = new Date().toISOString().slice(0, 10);
  const fileStem = `estado_cuenta_${slugify(client.name || 'cliente')}_${stamp}`;

  const docDef =
    mode === 'summary'
      ? buildSummaryByDate({
          credits,
          clients: [client],
          title: 'Estado de cuenta — Resumen',
          subtitle: `${client.name}${client.documentNumber ? ` · ${client.documentNumber}` : ''}`,
        })
      : buildDetailed({
          credits,
          clients: [client],
          title: 'Estado de cuenta',
          subtitle: `${client.name}${client.documentNumber ? ` · ${client.documentNumber}` : ''}`,
        });

  pdfMake.createPdf(docDef).download(`${fileStem}.pdf`);
}

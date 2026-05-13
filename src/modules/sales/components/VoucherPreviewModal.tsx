import { useEffect, useMemo, useRef, useState } from 'react';
import { X, FileText, Smartphone, FileText as FileIcon, Printer, ExternalLink, MessageCircle, Download, Loader2 } from 'lucide-react';
import { COMPANY_INFO } from '../../../config/companyInfo';
import { buildVoucherPdfBlob, downloadVoucherPdf, openVoucherPdf } from '../utils/voucherPdf';
import { numberToWords } from '../../quotes/utils/numberToWords';

export interface VoucherSnapshot {
  id: string;
  total: number;
  voucherType: 'NONE' | 'BOLETA' | 'FACTURA' | string;
  date: Date;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  payments: { methodName: string; amount: number }[];
  sellerName: string;
  clientName?: string;
  clientDocument?: string;
  clientPhone?: string;
  igv?: number;
  baseImponible?: number;
  voucherNumber?: string;
  /** Marca venta a crédito — el comprobante muestra el saldo pendiente. */
  isCredit?: boolean;
  /** Total ya abonado al crédito (anticipo inicial + pagos posteriores). Si no se
   *  pasa, se usa la suma de `payments` como aproximación. */
  creditPaidAmount?: number;
  /** Fecha de vencimiento del crédito (ISO o Date). Opcional. */
  creditDueDate?: string | Date;
}

type Format = 'TICKET' | 'A4';

function escapeHtml(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function shortVoucherNumber(id: string): string {
  return `NV-${(id || '').slice(-8).toUpperCase().padStart(8, '0')}`;
}

function displayVoucherNumber(sale: VoucherSnapshot): string {
  return sale.voucherNumber || shortVoucherNumber(sale.id);
}

function voucherTitle(type: string): string {
  if (type === 'BOLETA') return 'Boleta de venta';
  if (type === 'FACTURA') return 'Factura';
  return 'Nota de venta';
}

function formatDate(d: Date): string {
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildTicketHtml(sale: VoucherSnapshot): string {
  const number = displayVoucherNumber(sale);
  const title = voucherTitle(sale.voucherType).toUpperCase();
  const company = COMPANY_INFO;
  const itemsRows = sale.items.map((i) => `
    <tr class="item">
      <td class="qty">${i.quantity}</td>
      <td class="desc" colspan="3">${escapeHtml(i.name)}</td>
    </tr>
    <tr class="item-prices">
      <td></td>
      <td></td>
      <td class="right">S/ ${i.unitPrice.toFixed(2)}</td>
      <td class="right">S/ ${i.subtotal.toFixed(2)}</td>
    </tr>
  `).join('');
  const paymentsRows = sale.payments.map((p) => `
    <div class="kv"><span>${escapeHtml(p.methodName)}</span><span>S/ ${p.amount.toFixed(2)}</span></div>
  `).join('');

  const paidSoFar = sale.creditPaidAmount ?? sale.payments.reduce((s, p) => s + p.amount, 0);
  const pendingAmount = Math.max(0, sale.total - paidSoFar);
  const dueDateFmt = sale.creditDueDate
    ? new Date(sale.creditDueDate).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  const creditBlock = sale.isCredit ? `
    <div class="hr"></div>
    <div class="center bold credit-banner">VENTA A CRÉDITO</div>
    ${paidSoFar > 0 ? `
      <div class="bold" style="margin-top: 4px;">Abonado a la fecha</div>
      ${sale.payments.map((p) => `
        <div class="kv"><span>${escapeHtml(p.methodName)}</span><span>S/ ${p.amount.toFixed(2)}</span></div>
      `).join('')}
      ${sale.creditPaidAmount !== undefined && sale.creditPaidAmount > sale.payments.reduce((s, p) => s + p.amount, 0) ? `
        <div class="kv"><span>Abonos posteriores</span><span>S/ ${(sale.creditPaidAmount - sale.payments.reduce((s, p) => s + p.amount, 0)).toFixed(2)}</span></div>
      ` : ''}
      <div class="kv bold"><span>Total abonado</span><span>S/ ${paidSoFar.toFixed(2)}</span></div>
    ` : `
      <div class="muted" style="margin-top:2px;">Sin abono inicial</div>
    `}
    <div class="kv bold lg" style="margin-top: 4px; color: #b91c1c;"><span>SALDO PENDIENTE</span><span>S/ ${pendingAmount.toFixed(2)}</span></div>
    ${dueDateFmt ? `<div class="kv"><span class="bold">Vence el</span><span>${dueDateFmt}</span></div>` : ''}
  ` : '';

  const cashPaymentBlock = !sale.isCredit && paymentsRows ? `
    <div class="hr"></div>
    <div class="bold">Forma de pago</div>
    ${paymentsRows}
    ${sale.payments.length > 1 ? `<div class="kv bold" style="margin-top:2px;"><span>Total pagado</span><span>S/ ${sale.payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}</span></div>` : ''}
  ` : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${number}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', 'Menlo', monospace; font-size: 12px; color: #000; margin: 0; padding: 12px; line-height: 1.35; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .lg { font-size: 13px; }
  .xl { font-size: 17px; }
  .muted { color: #555; }
  .hr { border-top: 1px dashed #000; margin: 8px 0; }
  .kv { display: flex; justify-content: space-between; gap: 8px; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { font-weight: 700; text-align: left; padding: 0 2px 4px; font-size: 11px; border-bottom: 1px dashed #000; }
  table.items th.right { text-align: right; }
  table.items td { padding: 1px 2px; vertical-align: top; }
  table.items td.qty { width: 24px; font-weight: 700; }
  table.items td.right { text-align: right; white-space: nowrap; }
  table.items td.desc { word-break: break-word; }
  table.items tr.item-prices td { padding-bottom: 5px; }
  .total { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; margin-top: 6px; }
  .credit-banner { letter-spacing: 1px; padding: 4px; border: 1px dashed #b91c1c; color: #b91c1c; }
  .logo-wrap { text-align: center; margin-bottom: 6px; }
  .logo-wrap img { max-width: 56mm; max-height: 22mm; object-fit: contain; }
</style></head>
<body>
  ${company.logoUrl ? `<div class="logo-wrap"><img src="${escapeHtml(company.logoUrl)}" alt="" onerror="this.parentNode.style.display='none'" /></div>` : ''}
  <div class="center bold lg">${escapeHtml(company.legalName)}</div>
  ${company.ruc ? `<div class="center muted">RUC ${escapeHtml(company.ruc)}</div>` : ''}
  ${company.address ? `<div class="center muted">${escapeHtml(company.address)}</div>` : ''}
  ${company.phone ? `<div class="center muted">Tel. ${escapeHtml(company.phone)}</div>` : ''}
  <div class="hr"></div>
  <div class="center bold">${title}</div>
  <div class="center bold lg">N° ${number}</div>
  <div class="center muted">${formatDate(sale.date)}</div>
  <div class="hr"></div>
  ${sale.clientName ? `<div class="kv"><span class="bold">Cliente:</span><span>${escapeHtml(sale.clientName)}</span></div>` : ''}
  ${sale.clientDocument ? `<div class="kv"><span class="bold">Doc:</span><span>${escapeHtml(sale.clientDocument)}</span></div>` : ''}
  <div class="kv"><span class="bold">Vendedor:</span><span>${escapeHtml(sale.sellerName)}</span></div>
  <div class="hr"></div>
  <table class="items">
    <thead>
      <tr>
        <th style="width:24px">Can</th>
        <th>Descripción</th>
        <th class="right">P.Unit</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <div class="hr"></div>
  ${typeof sale.baseImponible === 'number' ? `<div class="kv"><span>Subtotal</span><span>S/ ${sale.baseImponible.toFixed(2)}</span></div>` : ''}
  ${typeof sale.igv === 'number' && sale.igv > 0 ? `<div class="kv"><span>IGV (18%)</span><span>S/ ${sale.igv.toFixed(2)}</span></div>` : ''}
  <div class="total bold xl"><span>TOTAL</span><span>S/ ${sale.total.toFixed(2)}</span></div>
  ${creditBlock}
  ${cashPaymentBlock}
  <div class="hr"></div>
  <div class="center muted">¡Gracias por su preferencia!</div>
  ${company.website ? `<div class="center muted">${escapeHtml(company.website)}</div>` : ''}
</body></html>`;
}

function buildA4Html(sale: VoucherSnapshot): string {
  const number = displayVoucherNumber(sale);
  const title = voucherTitle(sale.voucherType).toUpperCase();
  const c = COMPANY_INFO;
  const headerName = c.legalName || 'INQUIVEN';
  const headerRuc = c.ruc || '—';

  const subtotal = typeof sale.baseImponible === 'number'
    ? sale.baseImponible
    : Math.round((sale.total / 1.18) * 100) / 100;
  const igv = typeof sale.igv === 'number'
    ? sale.igv
    : Math.round((sale.total - subtotal) * 100) / 100;

  const blankItemRows = Math.max(0, 8 - sale.items.length);
  const itemsRows = sale.items.map((i, idx) => `
    <tr>
      <td class="c">${idx + 1}</td>
      <td class="l">${escapeHtml(i.name)}</td>
      <td class="c">${i.quantity}</td>
      <td class="r">${i.unitPrice.toFixed(2)}</td>
      <td class="r">${i.subtotal.toFixed(2)}</td>
    </tr>
  `).join('') + Array.from({ length: blankItemRows }).map(() => `
    <tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td></tr>
  `).join('');

  const paymentsRows = sale.payments.map((p) => `
    <tr><td class="kv-key">${escapeHtml(p.methodName)}</td><td class="kv-sep">:</td><td class="kv-val r">S/ ${p.amount.toFixed(2)}</td></tr>
  `).join('');

  const paidSoFarA4 = sale.creditPaidAmount ?? sale.payments.reduce((s, p) => s + p.amount, 0);
  const pendingAmountA4 = Math.max(0, sale.total - paidSoFarA4);
  const dueDateFmtA4 = sale.creditDueDate
    ? new Date(sale.creditDueDate).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  const creditExtraA4 = sale.isCredit ? `
    <tr><td colspan="3" class="credit-banner-a4">VENTA A CRÉDITO</td></tr>
    ${paidSoFarA4 > 0 && sale.creditPaidAmount !== undefined && sale.creditPaidAmount > sale.payments.reduce((s, p) => s + p.amount, 0) ? `
      <tr><td class="kv-key">Abonos posteriores</td><td class="kv-sep">:</td><td class="kv-val r">S/ ${(sale.creditPaidAmount - sale.payments.reduce((s, p) => s + p.amount, 0)).toFixed(2)}</td></tr>
    ` : ''}
    <tr><td class="kv-key">Total abonado</td><td class="kv-sep">:</td><td class="kv-val r"><b>S/ ${paidSoFarA4.toFixed(2)}</b></td></tr>
    <tr><td class="kv-key" style="color:#b91c1c;"><b>SALDO PENDIENTE</b></td><td class="kv-sep">:</td><td class="kv-val r" style="color:#b91c1c;"><b>S/ ${pendingAmountA4.toFixed(2)}</b></td></tr>
    ${dueDateFmtA4 ? `<tr><td class="kv-key">Vence el</td><td class="kv-sep">:</td><td class="kv-val r">${dueDateFmtA4}</td></tr>` : ''}
  ` : '';

  const bankRows = (c.bankAccounts || []).map((acc) => `
    <tr>
      <td class="kv-key">${escapeHtml(acc.bank)} (${acc.currency})</td>
      <td class="kv-mini">Cuenta</td>
      <td>${escapeHtml(acc.accountNumber || '—')}</td>
      <td class="kv-mini">CCI</td>
      <td>${escapeHtml(acc.cci || '—')}</td>
    </tr>
    <tr>
      <td></td>
      <td class="kv-mini">Titular</td>
      <td colspan="3">${escapeHtml(acc.holder || '—')}</td>
    </tr>
  `).join('');

  const walletRows = [
    c.yape ? `<tr><td class="wallet-yape">Yape</td><td>${escapeHtml(c.yape.number)}</td><td class="kv-mini">${escapeHtml(c.yape.holder)}</td></tr>` : '',
    c.plin ? `<tr><td class="wallet-plin">Plin</td><td>${escapeHtml(c.plin.number)}</td><td class="kv-mini">${escapeHtml(c.plin.holder)}</td></tr>` : '',
  ].join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${number}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 9px; color: #111827; margin: 0; padding: 14mm 14mm; line-height: 1.35; }
  h1, h2, h3 { margin: 0; }
  table { border-collapse: collapse; width: 100%; }
  td, th { vertical-align: top; }
  .l { text-align: left; }
  .c { text-align: center; }
  .r { text-align: right; }

  /* Header */
  .header { display: flex; gap: 12px; align-items: flex-start; }
  .header .info { flex: 1; padding-top: 4px; }
  .header .brand { font-size: 16px; font-weight: 800; color: #15803d; margin-bottom: 4px; letter-spacing: 0.5px; }
  .header .detail { font-size: 8px; color: #374151; margin-top: 1px; }
  .header .docs { width: 200px; display: flex; flex-direction: column; gap: 4px; }
  .doc-box { border: 1px solid #16a34a; padding: 4px 0; text-align: center; font-weight: 700; font-size: 10px; color: #111827; }
  .doc-title { background: #16a34a; color: #fff; padding: 5px 0; text-align: center; font-weight: 700; font-size: 12px; letter-spacing: 0.4px; }
  .doc-num { border: 1px solid #16a34a; padding: 4px 0; text-align: center; font-weight: 700; font-size: 11px; color: #15803d; }

  /* Client/seller block */
  .info-block { margin-top: 14px; border: 1px solid #94a3b8; }
  .info-block table { font-size: 8.5px; }
  .info-block td { padding: 4px 6px; }
  .info-block .lbl { font-weight: 700; width: 70px; }
  .info-block .sep { width: 6px; }
  .info-block .lbl-r { font-weight: 700; width: 80px; }

  /* Items table */
  .items { margin-top: 14px; border: 1px solid #94a3b8; border-collapse: collapse; }
  .items th { background: #16a34a; color: #fff; font-weight: 700; font-size: 9px; padding: 6px 6px; border-right: 1px solid #94a3b8; }
  .items th:last-child { border-right: none; }
  .items td { padding: 5px 8px; border-right: 1px solid #94a3b8; border-top: 0; font-size: 8.5px; }
  .items td:last-child { border-right: none; }
  .items tbody tr:first-child td { border-top: 1px solid #94a3b8; }
  .col-num { width: 30px; }
  .col-qty { width: 40px; }
  .col-unit { width: 60px; }
  .col-tot { width: 70px; }

  .amount-words { padding: 6px 4px; font-size: 9px; margin-top: 6px; }
  .amount-words .b { font-weight: 700; }

  /* Conditions + totals */
  .two-col { display: flex; gap: 12px; margin-top: 8px; }
  .two-col .col-l { flex: 1; }
  .two-col .col-r { width: 200px; }

  .panel { border: 1px solid #94a3b8; }
  .panel-title { background: #16a34a; color: #fff; padding: 5px 8px; font-weight: 700; font-size: 9px; letter-spacing: 0.4px; }
  .panel table td { padding: 4px 8px; font-size: 8.5px; }
  .panel .kv-key { font-weight: 700; }
  .panel .kv-sep { width: 6px; }

  .totals .totals-row { display: grid; grid-template-columns: 1fr 30px 70px; }
  .totals .totals-row > div { padding: 5px 8px; background: #16a34a; color: #fff; font-weight: 700; }
  .totals .totals-row > div.cur { background: #16a34a; text-align: center; }
  .totals .totals-row > div.val { background: #fff; color: #111827; text-align: right; font-weight: 600; border: 1px solid #94a3b8; border-left: 0; border-bottom: 0; }
  .totals .totals-row.first > div.lbl { border-top: 1px solid #94a3b8; }
  .totals .totals-row.first > div.cur { border-top: 1px solid #94a3b8; }
  .totals .totals-row.last > div.val { border-bottom: 1px solid #94a3b8; }
  .totals .totals-row.last > div.lbl, .totals .totals-row.last > div.val { font-size: 10px; }

  /* Payments + footer */
  .pay-block { margin-top: 14px; }
  .pay-rows td { padding: 4px 8px; font-size: 8.5px; }
  .wallet-yape { background: #f3e8ff; font-weight: 700; padding: 4px 8px; }
  .wallet-plin { background: #cffafe; font-weight: 700; padding: 4px 8px; }
  .kv-mini { color: #6b7280; }

  .footer { margin-top: 24px; text-align: center; color: #6b7280; font-size: 9px; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
  .credit-banner-a4 { background: #fef2f2; color: #b91c1c; font-weight: 700; text-align: center; letter-spacing: 1px; padding: 5px; border-top: 1px dashed #b91c1c; border-bottom: 1px dashed #b91c1c; }
</style></head>
<body>
  <div class="header">
    <img src="${escapeHtml(c.logoUrl)}" alt="" style="width: 70px; height: 70px; object-fit: contain;" onerror="this.style.display='none'" />
    <div class="info">
      <div class="brand">${escapeHtml(headerName)}</div>
      ${c.address ? `<div class="detail">Dirección : ${escapeHtml(c.address)}</div>` : ''}
      ${c.phone ? `<div class="detail">Teléfonos : ${escapeHtml(c.phone)}</div>` : ''}
      ${c.email ? `<div class="detail">E-mail : ${escapeHtml(c.email)}</div>` : ''}
    </div>
    <div class="docs">
      <div class="doc-box">R.U.C. ${escapeHtml(headerRuc)}</div>
      <div class="doc-title">${title}</div>
      <div class="doc-num">${escapeHtml(number)}</div>
    </div>
  </div>

  <div class="info-block">
    <table>
      <tr>
        <td class="lbl">R.U.C. / D.N.I.</td><td class="sep">:</td>
        <td colspan="4">${escapeHtml(sale.clientDocument || '—')}</td>
      </tr>
      <tr>
        <td class="lbl">Cliente</td><td class="sep">:</td>
        <td colspan="4">${escapeHtml((sale.clientName || 'Consumidor final').toUpperCase())}</td>
      </tr>
      <tr>
        <td class="lbl">Teléfono</td><td class="sep">:</td>
        <td>${escapeHtml(sale.clientPhone || ' ')}</td>
        <td class="lbl-r">Vendedor</td><td class="sep">:</td>
        <td>${escapeHtml((sale.sellerName || '—').toUpperCase())}</td>
      </tr>
      <tr>
        <td class="lbl">Fecha Emisión</td><td class="sep">:</td>
        <td colspan="4">${formatDate(sale.date)}</td>
      </tr>
    </table>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="col-num">ÍTEM</th>
        <th>DESCRIPCIÓN</th>
        <th class="col-qty">CANT.</th>
        <th class="col-unit">V. UNIT.</th>
        <th class="col-tot">IMPORTE</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <div class="amount-words"><span class="b">SON: </span>${escapeHtml(numberToWords(sale.total, 'PEN'))}</div>

  <div class="two-col">
    <div class="col-l">
      ${(paymentsRows || sale.isCredit) ? `
        <div class="panel">
          <div class="panel-title">${sale.isCredit ? 'FORMA DE PAGO · CRÉDITO' : 'FORMA DE PAGO'}</div>
          <table class="pay-rows"><tbody>
            ${paymentsRows}
            ${sale.payments.length > 1 && !sale.isCredit ? `<tr><td class="kv-key"><b>Total pagado</b></td><td class="kv-sep">:</td><td class="kv-val r"><b>S/ ${sale.payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}</b></td></tr>` : ''}
            ${creditExtraA4}
          </tbody></table>
        </div>
      ` : ''}
    </div>
    <div class="col-r totals">
      <div class="totals-row first">
        <div class="lbl r">OP. GRAVADAS</div>
        <div class="cur">S/</div>
        <div class="val">${subtotal.toFixed(2)}</div>
      </div>
      <div class="totals-row">
        <div class="lbl r">I.G.V. 18%</div>
        <div class="cur">S/</div>
        <div class="val">${igv.toFixed(2)}</div>
      </div>
      <div class="totals-row last">
        <div class="lbl r">IMPORTE TOTAL</div>
        <div class="cur">S/</div>
        <div class="val">${sale.total.toFixed(2)}</div>
      </div>
    </div>
  </div>

  ${(bankRows || walletRows) ? `
    <div class="pay-block">
      <div class="panel-title">FORMAS DE PAGO</div>
      ${bankRows ? `<table class="panel" style="border:1px solid #94a3b8; border-top: 0;"><tbody>${bankRows}</tbody></table>` : ''}
      ${walletRows ? `<table class="panel" style="border:1px solid #94a3b8; margin-top: 4px;"><tbody>${walletRows}</tbody></table>` : ''}
    </div>
  ` : ''}

  <div class="footer">
    ¡Gracias por su preferencia!
    ${c.website ? `<div>${escapeHtml(c.website)}</div>` : ''}
  </div>
</body></html>`;
}

function buildWhatsappText(sale: VoucherSnapshot): string {
  const lines: string[] = [];
  lines.push(`*${voucherTitle(sale.voucherType)}* — ${displayVoucherNumber(sale)}`);
  lines.push(`${COMPANY_INFO.legalName}`);
  lines.push(`Fecha: ${formatDate(sale.date)}`);
  if (sale.clientName) lines.push(`Cliente: ${sale.clientName}`);
  lines.push(`Vendedor: ${sale.sellerName}`);
  lines.push('');
  lines.push('*Productos:*');
  sale.items.forEach((i) => {
    lines.push(`• ${i.quantity} × ${i.name} — S/ ${i.subtotal.toFixed(2)}`);
  });
  lines.push('');
  lines.push(`*TOTAL: S/ ${sale.total.toFixed(2)}*`);
  if (sale.payments.length) {
    lines.push('');
    lines.push('Forma de pago:');
    sale.payments.forEach((p) => lines.push(`• ${p.methodName}: S/ ${p.amount.toFixed(2)}`));
  }
  lines.push('');
  lines.push('¡Gracias por su preferencia!');
  return lines.join('\n');
}

interface Props {
  sale: VoucherSnapshot | null;
  onClose: () => void;
}

export function VoucherPreviewModal({ sale, onClose }: Props) {
  const [format, setFormat] = useState<Format>('TICKET');
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<null | 'download' | 'open'>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const html = useMemo(() => {
    if (!sale) return '';
    return format === 'TICKET' ? buildTicketHtml(sale) : buildA4Html(sale);
  }, [sale, format]);

  useEffect(() => {
    if (!sale) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sale, onClose]);

  if (!sale) return null;

  const number = displayVoucherNumber(sale);
  const title = voucherTitle(sale.voucherType);

  const handlePrint = () => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  const handleOpenInNewTab = async () => {
    setPdfBusy('open');
    try {
      await openVoucherPdf(sale, format);
    } catch (err) {
      console.error('No se pudo abrir el PDF', err);
    } finally {
      setPdfBusy(null);
    }
  };

  const handleDownload = async () => {
    setPdfBusy('download');
    try {
      await downloadVoucherPdf(sale, format);
    } catch (err) {
      console.error('No se pudo descargar el PDF', err);
    } finally {
      setPdfBusy(null);
    }
  };

  const handleWhatsapp = async () => {
    const text = buildWhatsappText(sale);
    const phone = (sale.clientPhone || '').replace(/\D/g, '');
    const encodedText = encodeURIComponent(text);
    const waUrl = phone ? `https://wa.me/${phone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;

    // Probe whether this browser can share files (mobile yes; desktop almost never).
    const probe = new File([new Blob(['x'])], 'probe.pdf', { type: 'application/pdf' });
    const canShareFiles =
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function' &&
      (() => { try { return navigator.canShare({ files: [probe] }); } catch { return false; } })();

    if (!canShareFiles) {
      // Desktop path: open WhatsApp Web immediately (preserves popup permission),
      // then download the PDF so the user can drag it into the chat.
      window.open(waUrl, '_blank');
      setWhatsappLoading(true);
      try {
        const blob = await buildVoucherPdfBlob(sale, format);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // PDF generation failed; WhatsApp tab is already open with the text.
      } finally {
        setWhatsappLoading(false);
      }
      return;
    }

    // Mobile path: native share sheet with PDF + text attached.
    setWhatsappLoading(true);
    try {
      const blob = await buildVoucherPdfBlob(sale);
      const file = new File([blob], `${number}.pdf`, { type: 'application/pdf' });
      const data: ShareData = { files: [file], text, title: `${title} ${number}` };
      if (!navigator.canShare(data)) {
        window.open(waUrl, '_blank');
        return;
      }
      try {
        await navigator.share(data);
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // user canceled the native share sheet
        window.open(waUrl, '_blank');
      }
    } catch {
      window.open(waUrl, '_blank');
    } finally {
      setWhatsappLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${format === 'TICKET' ? 'max-w-xl' : 'max-w-4xl'} h-[92vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
              <FileText size={18} />
            </span>
            <div className="min-w-0">
              <div className="text-base font-bold text-gray-900 truncate">{title} · {number}</div>
              <div className="text-xs text-gray-500">Vista previa del comprobante</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Format toggle */}
        <div className="px-6 pt-4 pb-3 flex items-center gap-2 shrink-0">
          <div className="inline-flex p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setFormat('TICKET')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                format === 'TICKET' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Smartphone size={15} /> Ticket 80mm
            </button>
            <button
              type="button"
              onClick={() => setFormat('A4')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                format === 'A4' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileIcon size={15} /> A4
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 min-h-0 overflow-hidden px-6 pb-4">
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl border border-gray-200 overflow-auto flex justify-center py-6">
            <iframe
              key={format}
              ref={iframeRef}
              title="Vista previa"
              srcDoc={html}
              className={`bg-white shadow-xl rounded-sm ${
                format === 'TICKET'
                  ? 'w-[340px] h-[640px]'
                  : 'w-full max-w-[820px] h-[1100px]'
              }`}
            />
          </div>
        </div>

        {/* Meta strip */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-4 text-sm bg-gray-50/60 shrink-0">
          <div className="flex items-center gap-4 text-gray-500 text-xs">
            <span>{formatDate(sale.date)}</span>
            <span>{sale.items.length} producto{sale.items.length === 1 ? '' : 's'}</span>
            {sale.clientName && <span className="text-gray-700 font-medium">· {sale.clientName}</span>}
          </div>
          <div className="text-base font-bold text-primary-700 tabular-nums">S/ {sale.total.toFixed(2)}</div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center gap-2 justify-end shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            disabled={pdfBusy !== null}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-60 disabled:cursor-wait text-sm font-semibold transition-colors"
          >
            {pdfBusy === 'download' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {pdfBusy === 'download' ? 'Generando...' : 'Descargar'}
          </button>
          <button
            type="button"
            onClick={handleOpenInNewTab}
            disabled={pdfBusy !== null}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-60 disabled:cursor-wait text-sm font-semibold transition-colors"
          >
            {pdfBusy === 'open' ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
            {pdfBusy === 'open' ? 'Generando...' : 'Abrir PDF'}
          </button>
          <button
            type="button"
            onClick={handleWhatsapp}
            disabled={whatsappLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl hover:bg-[#1ebe57] disabled:opacity-60 disabled:cursor-wait text-sm font-semibold transition-colors shadow-sm"
          >
            {whatsappLoading ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
            {whatsappLoading ? 'Preparando...' : 'WhatsApp'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-semibold transition-colors shadow-sm"
          >
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

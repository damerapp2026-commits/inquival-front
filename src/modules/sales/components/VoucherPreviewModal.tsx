import { useEffect, useMemo, useRef, useState } from 'react';
import { X, FileText, Smartphone, FileText as FileIcon, Printer, ExternalLink, MessageCircle, Download } from 'lucide-react';
import { COMPANY_INFO } from '../../../config/companyInfo';

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
}

type Format = 'TICKET' | 'A4';

function escapeHtml(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function shortVoucherNumber(id: string): string {
  return `NV-${(id || '').slice(-8).toUpperCase().padStart(8, '0')}`;
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
  const number = shortVoucherNumber(sale.id);
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
</style></head>
<body>
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
  ${paymentsRows ? `<div class="hr"></div><div class="bold">Forma de pago</div>${paymentsRows}` : ''}
  <div class="hr"></div>
  <div class="center muted">¡Gracias por su preferencia!</div>
  ${company.website ? `<div class="center muted">${escapeHtml(company.website)}</div>` : ''}
</body></html>`;
}

function buildA4Html(sale: VoucherSnapshot): string {
  const number = shortVoucherNumber(sale.id);
  const title = voucherTitle(sale.voucherType).toUpperCase();
  const company = COMPANY_INFO;
  const itemsRows = sale.items.map((i, idx) => `
    <tr>
      <td class="num">${idx + 1}</td>
      <td class="num">${i.quantity}</td>
      <td>${escapeHtml(i.name)}</td>
      <td class="right">S/ ${i.unitPrice.toFixed(2)}</td>
      <td class="right">S/ ${i.subtotal.toFixed(2)}</td>
    </tr>
  `).join('');
  const paymentsRows = sale.payments.map((p) => `
    <tr><td>${escapeHtml(p.methodName)}</td><td class="right">S/ ${p.amount.toFixed(2)}</td></tr>
  `).join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${number}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 12px; color: #1f2937; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid #16a34a; }
  .brand { font-size: 22px; font-weight: 800; color: #15803d; margin: 0 0 4px; }
  .muted { color: #6b7280; font-size: 11px; }
  .voucher-box { border: 2px solid #16a34a; border-radius: 8px; padding: 12px 18px; text-align: center; min-width: 220px; }
  .voucher-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #15803d; font-weight: 700; }
  .voucher-box .num { font-size: 18px; font-weight: 800; color: #111827; margin-top: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 18px 0; font-size: 12px; }
  .meta strong { color: #374151; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  thead th { background: #f0fdf4; color: #15803d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px; text-align: left; border-bottom: 2px solid #16a34a; }
  tbody td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
  .right { text-align: right; }
  .num { text-align: center; width: 48px; }
  .totals { margin-top: 20px; margin-left: auto; width: 320px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 12px; }
  .totals .total { background: #16a34a; color: #fff; font-size: 16px; font-weight: 800; border-radius: 6px; padding: 10px 12px; margin-top: 6px; }
  .pay { margin-top: 24px; }
  .pay h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin: 0 0 6px; }
  .pay table { font-size: 12px; }
  .footer { margin-top: 36px; text-align: center; color: #6b7280; font-size: 11px; border-top: 1px dashed #d1d5db; padding-top: 14px; }
</style></head>
<body>
  <div class="header">
    <div>
      <h1 class="brand">${escapeHtml(company.legalName)}</h1>
      ${company.ruc ? `<div class="muted">RUC ${escapeHtml(company.ruc)}</div>` : ''}
      ${company.address ? `<div class="muted">${escapeHtml(company.address)}</div>` : ''}
      ${company.phone ? `<div class="muted">Tel. ${escapeHtml(company.phone)}</div>` : ''}
      ${company.email ? `<div class="muted">${escapeHtml(company.email)}</div>` : ''}
    </div>
    <div class="voucher-box">
      <div class="label">${title}</div>
      <div class="num">N° ${number}</div>
      <div class="muted" style="margin-top:6px">${formatDate(sale.date)}</div>
    </div>
  </div>

  <div class="meta">
    <div><strong>Cliente:</strong> ${escapeHtml(sale.clientName) || 'Consumidor final'}</div>
    ${sale.clientDocument ? `<div><strong>Documento:</strong> ${escapeHtml(sale.clientDocument)}</div>` : ''}
    <div><strong>Vendedor:</strong> ${escapeHtml(sale.sellerName)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Cant</th>
        <th>Descripción</th>
        <th class="right">P. Unit.</th>
        <th class="right">Subtotal</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <div class="totals">
    ${typeof sale.baseImponible === 'number' ? `<div class="row"><span>Subtotal</span><span>S/ ${sale.baseImponible.toFixed(2)}</span></div>` : ''}
    ${typeof sale.igv === 'number' && sale.igv > 0 ? `<div class="row"><span>IGV (18%)</span><span>S/ ${sale.igv.toFixed(2)}</span></div>` : ''}
    <div class="total"><span>TOTAL</span><span>S/ ${sale.total.toFixed(2)}</span></div>
  </div>

  ${paymentsRows ? `<div class="pay"><h3>Forma de pago</h3><table><tbody>${paymentsRows}</tbody></table></div>` : ''}

  <div class="footer">
    ¡Gracias por su preferencia!
    ${company.website ? `<div>${escapeHtml(company.website)}</div>` : ''}
  </div>
</body></html>`;
}

function buildWhatsappText(sale: VoucherSnapshot): string {
  const lines: string[] = [];
  lines.push(`*${voucherTitle(sale.voucherType)}* — ${shortVoucherNumber(sale.id)}`);
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

  const number = shortVoucherNumber(sale.id);
  const title = voucherTitle(sale.voucherType);

  const handlePrint = () => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  const handleOpenInNewTab = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleWhatsapp = () => {
    const text = encodeURIComponent(buildWhatsappText(sale));
    const phone = (sale.clientPhone || '').replace(/\D/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
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
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-semibold transition-colors"
          >
            <Download size={15} /> Descargar
          </button>
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-semibold transition-colors"
          >
            <ExternalLink size={15} /> Abrir PDF
          </button>
          <button
            type="button"
            onClick={handleWhatsapp}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl hover:bg-[#1ebe57] text-sm font-semibold transition-colors shadow-sm"
          >
            <MessageCircle size={15} /> WhatsApp
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

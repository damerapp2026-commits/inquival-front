import type { Product } from '../../../shared/types';
import { COMPANY_INFO } from '../../../config/companyInfo';

interface CatalogProduct extends Product {
  categoryName?: string;
  laboratoryName?: string;
}

interface GenerateOptions {
  products: CatalogProduct[];
  withPrices?: boolean;
  priceTierId?: string;
  priceTierLabel?: string;
  currency?: 'PEN' | 'USD';
  includeImages?: boolean;
  /** Kept for API compatibility; HTML rendering is fast so progress is unused. */
  onProgress?: (loaded: number, total: number, phase: 'images' | 'rendering') => void;
}

const BRAND = '#16a34a';
const BRAND_DARK = '#15803d';

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function priceFor(p: CatalogProduct, opts: GenerateOptions): string {
  if (!opts.withPrices || !opts.priceTierId) return '';
  const entry = (p.prices || []).find((x) => x.priceTierId === opts.priceTierId && !x.companyId);
  if (!entry) return '';
  const symbol = opts.currency === 'USD' ? 'US$' : 'S/';
  return `${symbol} ${entry.price.toFixed(2)}`;
}

function renderProductCard(p: CatalogProduct, opts: GenerateOptions): string {
  const img = opts.includeImages !== false && p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" loading="lazy" alt="" />`
    : '<div class="img-placeholder"></div>';
  const ingredient = (p.activeIngredient || '').trim();
  const lab = p.laboratoryName?.trim();
  const description = (p.description || '').trim();
  const price = priceFor(p, opts);
  return `
    <div class="card">
      <div class="card-img">${img}</div>
      <div class="card-name">${escapeHtml(p.name)}</div>
      ${ingredient ? `<div class="card-ingredient">${escapeHtml(ingredient)}</div>` : ''}
      ${lab ? `<div class="card-meta">Lab: ${escapeHtml(lab)}</div>` : ''}
      ${description ? `<div class="card-desc">${escapeHtml(description)}</div>` : ''}
      <div class="card-meta">Presentación: ${escapeHtml(p.unit || '—')}</div>
      ${price ? `<div class="card-price">${escapeHtml(price)}</div>` : ''}
    </div>`;
}

function renderListRow(p: CatalogProduct, opts: GenerateOptions): string {
  const ingredient = (p.activeIngredient || '').trim();
  const lab = p.laboratoryName?.trim();
  const price = priceFor(p, opts);
  return `
    <tr>
      <td class="row-name">
        <div class="row-name-main">${escapeHtml(p.name)}</div>
        ${ingredient ? `<div class="row-ingredient">${escapeHtml(ingredient)}</div>` : ''}
      </td>
      <td>${escapeHtml(lab || '—')}</td>
      <td class="row-unit">${escapeHtml(p.unit || '—')}</td>
      ${price ? `<td class="row-price">${escapeHtml(price)}</td>` : ''}
    </tr>`;
}

function buildCatalogHtml(opts: GenerateOptions): string {
  const includeImages = opts.includeImages !== false;
  const products = opts.products;
  const today = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
  const company = COMPANY_INFO.legalName || 'EMPRESA';
  const subhead: string[] = [];
  if (COMPANY_INFO.address) subhead.push(`<div>${escapeHtml(COMPANY_INFO.address)}</div>`);
  if (COMPANY_INFO.phone) subhead.push(`<div>Tel: ${escapeHtml(COMPANY_INFO.phone)}</div>`);
  if (COMPANY_INFO.ruc) subhead.push(`<div>RUC: ${escapeHtml(COMPANY_INFO.ruc)}</div>`);

  const showPriceCol = opts.withPrices && !!opts.priceTierId;

  const body = products.length === 0
    ? `<div class="empty">No hay productos para mostrar.</div>`
    : includeImages
      ? `<div class="grid">${products.map((p) => renderProductCard(p, opts)).join('')}</div>`
      : `
        <table class="list">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Laboratorio</th>
              <th>Unidad</th>
              ${showPriceCol ? `<th>Precio</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${products.map((p) => renderListRow(p, opts)).join('')}
          </tbody>
        </table>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Catálogo de Productos</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 0; padding: 16px 20px; }
  .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 10px; border-bottom: 2px solid ${BRAND}; }
  .brand { display: flex; gap: 12px; align-items: center; }
  .brand img { height: 50px; width: auto; }
  .brand-text h1 { margin: 0; font-size: 18px; color: ${BRAND_DARK}; }
  .brand-text .sub { font-size: 10px; color: #374151; line-height: 1.5; margin-top: 2px; }
  .badge { background: ${BRAND}; color: white; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 12px; text-align: center; min-width: 160px; }
  .date { font-size: 10px; color: #6b7280; text-align: center; margin-top: 4px; }
  .actions { margin: 12px 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .actions button { padding: 6px 14px; border: none; background: ${BRAND}; color: white; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .actions button:hover { background: ${BRAND_DARK}; }
  .actions .hint { color: #6b7280; font-size: 12px; }

  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
  .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; background: white; page-break-inside: avoid; break-inside: avoid; }
  .card-img { width: 100%; height: 110px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #f9fafb; border-radius: 4px; }
  .card-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .img-placeholder { width: 100%; height: 100%; background: #f3f4f6; }
  .card-name { font-weight: 700; font-size: 11px; margin-top: 6px; color: #111827; }
  .card-ingredient { font-size: 9px; color: ${BRAND_DARK}; font-style: italic; margin-top: 1px; }
  .card-meta { font-size: 8px; color: #6b7280; margin-top: 2px; }
  .card-desc { font-size: 9px; color: #4b5563; margin-top: 3px; }
  .card-price { font-size: 13px; font-weight: 700; color: ${BRAND_DARK}; margin-top: 4px; }

  .list { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
  .list th { background: ${BRAND}; color: white; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; }
  .list td { border-bottom: 1px solid #e5e7eb; padding: 5px 8px; vertical-align: top; }
  .list tr:nth-child(even) td { background: #f9fafb; }
  .row-name-main { font-weight: 600; color: #111827; }
  .row-ingredient { font-size: 9px; color: ${BRAND_DARK}; font-style: italic; }
  .row-unit { width: 70px; }
  .row-price { width: 90px; font-weight: 700; color: ${BRAND_DARK}; text-align: right; }

  .empty { text-align: center; color: #9ca3af; font-style: italic; padding: 60px 0; }
  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #6b7280; display: flex; justify-content: space-between; }

  @media print {
    body { padding: 0 12px; }
    .actions { display: none !important; }
    .topbar { padding-top: 8px; }
    .grid { gap: 6px; }
    .card { padding: 6px; }
    @page { size: A4; margin: 12mm 10mm; }
  }
</style>
</head>
<body>
  <div class="topbar">
    <div class="brand">
      ${COMPANY_INFO.logoUrl ? `<img src="${escapeHtml(COMPANY_INFO.logoUrl)}" alt="" onerror="this.style.display='none'" />` : ''}
      <div class="brand-text">
        <h1>${escapeHtml(company)}</h1>
        <div class="sub">${subhead.join('')}</div>
      </div>
    </div>
    <div>
      <div class="badge">CATÁLOGO DE PRODUCTOS</div>
      <div class="date">${escapeHtml(today)}</div>
    </div>
  </div>

  <div class="actions">
    <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
    <span class="hint">Para guardar como PDF: en el diálogo de impresión elegí "Guardar como PDF" como destino.</span>
    <span id="img-loading" class="hint" style="display:none">📷 <span id="img-count">0</span> imágenes cargadas...</span>
  </div>

  ${body}

  <div class="footer">
    <span>${escapeHtml(company)}</span>
    <span>${escapeHtml(today)}</span>
  </div>

  <script>
    // Wait for images then auto-open the print dialog. Skip if there are none.
    (function(){
      var imgs = Array.from(document.images || []).filter(function(i){ return i.src && !i.src.includes('logo'); });
      if (imgs.length === 0) {
        setTimeout(function(){ window.print(); }, 200);
        return;
      }
      var loadingEl = document.getElementById('img-loading');
      var countEl = document.getElementById('img-count');
      if (loadingEl) loadingEl.style.display = 'inline';
      var total = imgs.length;
      var loaded = 0;
      var done = function(){
        loaded++;
        if (countEl) countEl.textContent = loaded + '/' + total;
        if (loaded >= total) {
          if (loadingEl) loadingEl.style.display = 'none';
          setTimeout(function(){ window.print(); }, 200);
        }
      };
      imgs.forEach(function(img){
        if (img.complete) { done(); return; }
        img.addEventListener('load', done);
        img.addEventListener('error', done);
      });
      // Hard cap: open the print dialog after 15s even if some images stalled.
      setTimeout(function(){
        if (loaded < total) {
          if (loadingEl) loadingEl.style.display = 'none';
          loaded = total;
          window.print();
        }
      }, 15000);
    })();
  </script>
</body>
</html>`;
}

export function openCatalogWindow(): Window | null {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.open();
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /><title>Generando catálogo…</title><style>
    body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; background: #f9fafb; color: #111827; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .box { text-align: center; padding: 40px; }
    .spinner { width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: #16a34a; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    .title { font-size: 16px; font-weight: 600; color: #15803d; margin-bottom: 4px; }
    .sub { font-size: 13px; color: #6b7280; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style></head><body><div class="box"><div class="spinner"></div><div class="title">Generando catálogo…</div><div class="sub">Por favor esperá unos segundos.</div></div></body></html>`);
  win.document.close();
  return win;
}

export async function downloadProductCatalogPdf(opts: GenerateOptions, targetWindow?: Window | null) {
  const html = buildCatalogHtml(opts);
  const win = targetWindow ?? window.open('', '_blank');
  if (!win || win.closed) {
    throw new Error('El navegador bloqueó la apertura de la ventana. Permití pop-ups para este sitio.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export async function printProductCatalogPdf(opts: GenerateOptions, targetWindow?: Window | null) {
  return downloadProductCatalogPdf(opts, targetWindow);
}

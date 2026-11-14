import { formatInstantEs } from '../../../shared/utils/date.util';
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

const packageIcon = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m24 5 17 9v20L24 43 7 34V14l17-9Z"/><path d="m7 14 17 10 17-10M24 24v19M16 10l17 10v9"/></svg>';

function renderProductCard(p: CatalogProduct, opts: GenerateOptions): string {
  const img = p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" loading="eager" decoding="async" alt="${escapeHtml(p.name)}" data-product-photo onerror="this.hidden=true;this.parentElement.classList.remove('with-image')" />`
    : '';
  const ingredient = (p.activeIngredient || '').trim();
  const lab = p.laboratoryName?.trim();
  const description = (p.description || '').trim();
  const price = priceFor(p, opts);
  return `
    <article class="card">
      <div class="card-img ${img ? 'with-image' : ''}">${img}<div class="img-placeholder">${packageIcon}<span>Sin foto disponible</span></div></div>
      <div class="card-body">
        ${p.categoryName ? `<span class="card-category">${escapeHtml(p.categoryName)}</span>` : ''}
        <h2 class="card-name">${escapeHtml(p.name)}</h2>
        ${ingredient ? `<div class="card-ingredient"><span class="field-label">Principio activo</span><strong>${escapeHtml(ingredient)}</strong></div>` : ''}
        <dl class="card-facts">
          <div><dt>Presentación</dt><dd>${escapeHtml(p.unit || '—')}</dd></div>
          ${lab ? `<div><dt>Laboratorio</dt><dd>${escapeHtml(lab)}</dd></div>` : ''}
        </dl>
        ${description ? `<p class="card-desc">${escapeHtml(description)}</p>` : ''}
        ${price ? `<div class="card-price"><span>Precio</span><strong>${escapeHtml(price)}</strong></div>` : ''}
      </div>
    </article>`;
}

function renderListRow(p: CatalogProduct, opts: GenerateOptions): string {
  const ingredient = (p.activeIngredient || '').trim();
  const lab = p.laboratoryName?.trim();
  const price = priceFor(p, opts);
  return `
    <tr>
      <td class="row-name">
        <div class="row-name-main">${escapeHtml(p.name)}</div>
        ${p.categoryName ? `<div class="row-category">${escapeHtml(p.categoryName)}</div>` : ''}
        ${ingredient ? `<div class="row-ingredient">${escapeHtml(ingredient)}</div>` : ''}
      </td>
      <td>${escapeHtml(lab || '—')}</td>
      <td class="row-unit">${escapeHtml(p.unit || '—')}</td>
      ${opts.withPrices && opts.priceTierId ? `<td class="row-price">${escapeHtml(price || '—')}</td>` : ''}
    </tr>`;
}

function buildCatalogHtml(opts: GenerateOptions): string {
  const includeImages = opts.includeImages !== false;
  const products = opts.products;
  const today = formatInstantEs(new Date(), { day: '2-digit', month: 'long', year: 'numeric' });
  const company = COMPANY_INFO.legalName || 'EMPRESA';
  const bundledLogo = COMPANY_INFO.logoUrl === '/pwa-192x192.png' || COMPANY_INFO.logoUrl === '/pwa-512x512.png';
  const logoUrl = bundledLogo ? '/pwa-512x512.png' : COMPANY_INFO.logoUrl;
  const subhead: string[] = [];
  if (COMPANY_INFO.address) subhead.push(`<div>${escapeHtml(COMPANY_INFO.address)}</div>`);
  if (COMPANY_INFO.phone) subhead.push(`<div>Tel: ${escapeHtml(COMPANY_INFO.phone)}</div>`);
  if (COMPANY_INFO.ruc) subhead.push(`<div>RUC: ${escapeHtml(COMPANY_INFO.ruc)}</div>`);
  const contact = [COMPANY_INFO.phone && `Tel. ${COMPANY_INFO.phone}`, COMPANY_INFO.email || COMPANY_INFO.salesEmail, COMPANY_INFO.website].filter(Boolean).map(value => escapeHtml(value)).join(' · ');

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
              <th>Presentación</th>
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
  body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; color: #173b30; background: #edf2ee; margin: 0; padding: 28px 20px; line-height: 1.45; }
  .catalog-paper { max-width: 960px; margin: 0 auto; padding: 28px; background: white; box-shadow: 0 8px 35px #163a2910; }
  .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 3px solid #173f30; }
  .brand { display: flex; gap: 12px; align-items: center; min-width: 0; }
  .brand-logo { flex-shrink: 0; width: 80px; height: 64px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .brand-logo img { width: 100%; height: 100%; object-fit: contain; }
  .brand-logo.bundled { width: 64px; }
  .brand-logo.bundled img { transform: scale(1.5); }
  .brand-text { min-width: 0; overflow-wrap: anywhere; }
  .brand-text h1 { margin: 0; font-size: 23px; line-height: 1.2; letter-spacing: -.5px; color: #173f30; }
  .brand-text .sub { font-size: 11px; color: #516358; line-height: 1.6; margin-top: 6px; }
  .edition { flex-shrink: 0; text-align: right; }
  .badge { color: ${BRAND_DARK}; font-weight: 800; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; }
  .edition-title { font-size: 26px; line-height: 1.15; font-weight: 800; color: #173f30; margin-top: 5px; }
  .date { font-size: 11px; color: #516358; margin-top: 6px; }
  .catalog-context { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding: 12px 0; font-size: 11px; color: #52665b; border-bottom: 1px solid #d5e3d9; }
  .catalog-context strong { color: #173f30; }
  .actions { max-width: 960px; margin: 0 auto 16px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .actions button { padding: 10px 16px; border: none; background: ${BRAND_DARK}; color: white; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 13px; }
  .actions button:hover { background: ${BRAND_DARK}; }
  .actions .hint { color: #6b7280; font-size: 12px; }

  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 18px; }
  .card { min-width: 0; border: 1px solid #cdded2; border-radius: 12px; background: white; page-break-inside: avoid; break-inside: avoid; display: flex; flex-direction: column; }
  .card-img { width: 100%; height: 156px; padding: 12px; display: flex; align-items: center; justify-content: center; position: relative; background: #f4f8f4; border-radius: 11px 11px 0 0; border-bottom: 1px solid #dfebe2; }
  .card-img img { width: 100%; height: 100%; object-fit: contain; }
  .card-img img[hidden] { display: none; }
  .img-placeholder { display: flex; flex-direction: column; align-items: center; gap: 7px; color: #697d70; font-size: 11px; }
  .img-placeholder svg { width: 42px; height: 42px; }
  .with-image .img-placeholder { display: none; }
  .card-body { padding: 14px 16px 16px; display: flex; flex: 1; flex-direction: column; align-items: flex-start; gap: 9px; }
  .card-category { display: inline-block; max-width: 100%; border-radius: 4px; padding: 3px 7px; color: #236344; background: #eaf4ec; font-size: 10px; font-weight: 750; text-transform: uppercase; letter-spacing: .6px; }
  .card-name { font-size: 18px; font-weight: 800; line-height: 1.22; color: #143c2c; margin: 0; overflow-wrap: anywhere; }
  .field-label { display: block; color: #5b6e61; font-size: 10px; text-transform: uppercase; letter-spacing: .6px; font-weight: 700; margin-bottom: 3px; }
  .card-ingredient { font-size: 13px; line-height: 1.4; color: #285b43; overflow-wrap: anywhere; }
  .card-ingredient strong { font-weight: 600; }
  .card-facts { display: grid; gap: 5px; width: 100%; margin: 0; padding-top: 8px; border-top: 1px solid #e1eae3; font-size: 13px; }
  .card-facts > div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 8px; }
  .card-facts dt { color: #5c6d62; }
  .card-facts dd { color: #213e30; font-weight: 700; margin: 0; overflow-wrap: anywhere; }
  .card-desc { font-size: 12.5px; color: #475e50; line-height: 1.5; margin: 0; overflow-wrap: anywhere; }
  .card-price { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; padding-top: 10px; margin-top: auto; border-top: 1px solid #d8e6dc; }
  .card-price span { font-size: 11px; color: #52665b; }
  .card-price strong { font-size: 21px; color: #176140; }

  .list { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 18px; font-size: 13px; }
  .list th { background: #173f30; color: white; text-align: left; padding: 11px 10px; font-size: 11px; letter-spacing: .5px; text-transform: uppercase; }
  .list th:first-child { width: ${showPriceCol ? '42%' : '52%'}; }
  .list td { border-bottom: 1px solid #dbe6dd; padding: 11px 10px; vertical-align: top; overflow-wrap: anywhere; }
  .list tbody tr:nth-child(even) td { background: #f1f7f2; }
  .list tbody tr { break-inside: avoid; page-break-inside: avoid; }
  .row-name-main { font-size: 16px; font-weight: 750; line-height: 1.3; color: #163b2b; }
  .row-category { display: inline-block; font-size: 10px; color: #316647; font-weight: 650; margin-top: 4px; }
  .row-ingredient { font-size: 12px; line-height: 1.4; color: #475e50; margin-top: 4px; }
  .row-unit { font-weight: 700; color: #234a34; }
  .row-price { font-weight: 750; color: #176140; text-align: right; font-size: 15px; }

  .empty { text-align: center; color: #9ca3af; font-style: italic; padding: 60px 0; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 2px solid #173f30; font-size: 11px; color: #52665b; display: flex; justify-content: space-between; gap: 20px; }
  .footer strong { color: #173f30; }

  @media screen and (max-width: 600px) {
    body { padding: 14px 10px; }
    .catalog-paper { padding: 18px; }
    .topbar { flex-direction: column; gap: 14px; }
    .edition { text-align: left; }
    .grid { grid-template-columns: 1fr; }
    .list { font-size: 11px; }
    .list td, .list th { padding: 9px 6px; }
    .row-name-main { font-size: 14px; }
  }

  @media print {
    body { padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .catalog-paper { max-width: none; padding: 0; box-shadow: none; }
    .actions { display: none !important; }
    .topbar { padding-top: 0; }
    .grid { gap: 14px; }
    .list thead { display: table-header-group; }
    @page { size: A4; margin: 12mm 10mm; }
  }
</style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
    <span class="hint">Selecciona «Guardar como PDF» en la ventana de impresión.</span>
    <span id="img-loading" class="hint" style="display:none">Cargando imágenes: <span id="img-count">0</span></span>
  </div>
  <main class="catalog-paper">
  <div class="topbar">
    <div class="brand">
      ${logoUrl ? `<div class="brand-logo${bundledLogo ? ' bundled' : ''}"><img src="${escapeHtml(logoUrl)}" alt="" onerror="this.parentElement.style.display='none'" /></div>` : ''}
      <div class="brand-text">
        <h1>${escapeHtml(company)}</h1>
        <div class="sub">${subhead.join('')}</div>
      </div>
    </div>
    <div class="edition">
      <div class="badge">Catálogo de productos</div>
      <div class="edition-title">${includeImages ? 'Con fotografías' : 'Sin fotografías'}</div>
      <div class="date">${products.length} producto${products.length === 1 ? '' : 's'} · ${escapeHtml(today)}</div>
    </div>
  </div>

  <div class="catalog-context">
    <span><strong>${products.length} producto${products.length === 1 ? '' : 's'}</strong> · ${includeImages ? 'Presentaciones y características' : 'Consulta de productos y presentaciones'}</span>
    ${showPriceCol && opts.priceTierLabel ? `<span>Tarifa: <strong>${escapeHtml(opts.priceTierLabel)}</strong></span>` : ''}
  </div>

  ${body}

  <div class="footer">
    <span><strong>${escapeHtml(company)}</strong>${contact ? `<br>${contact}` : ''}</span>
    <span>${escapeHtml(today)}</span>
  </div>
  </main>

  <script>
    // Eager images are included in print; a slow image must never reopen printing later.
    (function(){
      var imgs = Array.from(document.images || []).filter(function(i){ return !!i.src; });
      var loadingEl = document.getElementById('img-loading');
      var countEl = document.getElementById('img-count');
      var printed = false;
      var printOnce = function(){
        if (printed) return;
        printed = true;
        if (loadingEl) loadingEl.style.display = 'none';
        setTimeout(function(){ window.print(); }, 200);
      };
      if (imgs.length === 0) {
        printOnce();
        return;
      }
      if (loadingEl) loadingEl.style.display = 'inline';
      var total = imgs.length;
      var loaded = 0;
      var done = function(img){
        if (img.dataset.catalogReady) return;
        img.dataset.catalogReady = 'true';
        loaded++;
        if (countEl) countEl.textContent = loaded + '/' + total;
        if (loaded >= total) printOnce();
      };
      imgs.forEach(function(img){
        if (img.complete) { done(img); return; }
        img.addEventListener('load', function(){ done(img); }, { once: true });
        img.addEventListener('error', function(){ done(img); }, { once: true });
      });
      // Hard cap: open the print dialog after 15s even if some images stalled.
      setTimeout(function(){
        printOnce();
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

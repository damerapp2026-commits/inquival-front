import type { Product } from '../../../shared/types';
import { COMPANY_INFO } from '../../../config/companyInfo';

let pdfMakePromise: Promise<any> | null = null;
function loadPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]).then(([pdfMakeMod, pdfFontsMod]) => {
      const pdfMake: any = (pdfMakeMod as any).default || pdfMakeMod;
      const pdfFonts: any = (pdfFontsMod as any).default || pdfFontsMod;
      pdfMake.vfs = pdfFonts.vfs || pdfFonts.pdfMake?.vfs;
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

const BRAND_GREEN = '#16a34a';
const BRAND_GREEN_DARK = '#15803d';

async function fetchAndShrinkImage(url: string, maxSize = 240): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('img load failed'));
        i.src = objUrl;
      });
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.78);
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  } catch {
    return null;
  }
}

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
}

function buildProductCard(product: CatalogProduct, imageMap: Map<string, string>, opts: GenerateOptions): any {
  const dataUrl = product.imageUrl ? imageMap.get(product.imageUrl) : undefined;
  const description = (product.description || '').trim();
  const ingredient = (product.activeIngredient || '').trim();
  const lab = product.laboratoryName?.trim();

  const priceLine: any[] = [];
  if (opts.withPrices && opts.priceTierId) {
    const priceEntry = (product.prices || []).find((p) => p.priceTierId === opts.priceTierId && !p.companyId);
    if (priceEntry) {
      const symbol = opts.currency === 'USD' ? 'US$' : 'S/';
      priceLine.push({
        text: `${symbol} ${priceEntry.price.toFixed(2)}`,
        bold: true,
        fontSize: 13,
        color: BRAND_GREEN_DARK,
        margin: [0, 4, 0, 0],
      });
    }
  }

  const imageNode = dataUrl
    ? { image: dataUrl, fit: [150, 150], alignment: 'center' as const }
    : {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 150, h: 110, color: '#f3f4f6', lineColor: '#e5e7eb' },
        ],
        margin: [0, 0, 0, 4] as [number, number, number, number],
      };

  return {
    stack: [
      imageNode,
      { text: product.name, bold: true, fontSize: 11, color: '#111827', margin: [0, 6, 0, 0] },
      ...(ingredient ? [{ text: ingredient, fontSize: 8, color: BRAND_GREEN_DARK, italics: true, margin: [0, 1, 0, 0] }] : []),
      ...(lab ? [{ text: `Lab: ${lab}`, fontSize: 7, color: '#6b7280', margin: [0, 1, 0, 0] }] : []),
      ...(description ? [{ text: description, fontSize: 8, color: '#4b5563', margin: [0, 3, 0, 0] }] : []),
      { text: `Presentación: ${product.unit || '—'}`, fontSize: 7, color: '#6b7280', margin: [0, 3, 0, 0] },
      ...priceLine,
    ],
    margin: [4, 4, 4, 4] as [number, number, number, number],
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildDocDefinition(opts: GenerateOptions, logoDataUrl: string | null, imageMap: Map<string, string>) {
  const products = opts.products;
  const productsPerRow = 2;

  const rows = chunk(products, productsPerRow).map((row) => {
    const cells = row.map((p) => buildProductCard(p, imageMap, opts));
    while (cells.length < productsPerRow) cells.push({ text: '' });
    return cells;
  });

  return {
    pageSize: 'A4',
    pageMargins: [30, 110, 30, 50] as [number, number, number, number],
    header: () => ({
      margin: [30, 20, 30, 0] as [number, number, number, number],
      stack: [
        {
          columns: [
            ...(logoDataUrl ? [{ image: logoDataUrl, width: 60, margin: [0, 0, 10, 0] as [number, number, number, number] } as any] : []),
            {
              width: '*',
              stack: [
                { text: COMPANY_INFO.legalName || 'EMPRESA', fontSize: 16, bold: true, color: BRAND_GREEN_DARK },
                ...(COMPANY_INFO.address ? [{ text: COMPANY_INFO.address, fontSize: 8, color: '#374151' }] : []),
                ...(COMPANY_INFO.phone ? [{ text: `Tel: ${COMPANY_INFO.phone}`, fontSize: 8, color: '#374151' }] : []),
                ...(COMPANY_INFO.ruc ? [{ text: `RUC: ${COMPANY_INFO.ruc}`, fontSize: 8, color: '#374151' }] : []),
              ],
            },
            {
              width: 'auto',
              stack: [
                {
                  table: { widths: [140], body: [[{ text: 'CATÁLOGO DE PRODUCTOS', alignment: 'center', bold: true, fontSize: 11, color: 'white', fillColor: BRAND_GREEN, margin: [0, 6] }]] },
                  layout: 'noBorders',
                },
                { text: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }), fontSize: 8, alignment: 'center', color: '#6b7280', margin: [0, 4, 0, 0] },
              ],
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 535, y2: 5, lineWidth: 1, lineColor: BRAND_GREEN }] },
      ],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      margin: [30, 0, 30, 0] as [number, number, number, number],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 535, y2: 5, lineWidth: 0.5, lineColor: '#d1d5db' }] },
        {
          columns: [
            { text: COMPANY_INFO.legalName || '', fontSize: 8, color: '#6b7280' },
            { text: `Página ${currentPage} de ${pageCount}`, fontSize: 8, color: '#6b7280', alignment: 'right' },
          ],
          margin: [0, 6, 0, 0] as [number, number, number, number],
        },
      ],
    }),
    content: [
      ...(products.length === 0
        ? [{ text: 'No hay productos para mostrar.', alignment: 'center', color: '#9ca3af', italics: true, margin: [0, 40, 0, 40] as [number, number, number, number] }]
        : [{
            table: {
              widths: Array(productsPerRow).fill('*'),
              body: rows,
            },
            layout: {
              hLineColor: () => '#e5e7eb',
              vLineColor: () => '#e5e7eb',
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              paddingTop: () => 8,
              paddingBottom: () => 8,
              paddingLeft: () => 8,
              paddingRight: () => 8,
            },
          }]),
    ],
    defaultStyle: { fontSize: 9 },
  };
}

async function buildDoc(opts: GenerateOptions) {
  const includeImages = opts.includeImages !== false;
  const products = opts.products;

  const [pdfMake, logoDataUrl] = await Promise.all([loadPdfMake(), loadLogoDataUrl()]);

  const imageMap = new Map<string, string>();
  if (includeImages) {
    const urls = Array.from(new Set(products.map((p) => p.imageUrl).filter(Boolean) as string[]));
    const results = await Promise.all(urls.map((u) => fetchAndShrinkImage(u).then((d) => [u, d] as const)));
    results.forEach(([u, d]) => { if (d) imageMap.set(u, d); });
  }

  return pdfMake.createPdf(buildDocDefinition(opts, logoDataUrl, imageMap));
}

export async function downloadProductCatalogPdf(opts: GenerateOptions) {
  const doc = await buildDoc(opts);
  const dateStamp = new Date().toISOString().slice(0, 10);
  doc.download(`catalogo-productos-${dateStamp}.pdf`);
}

export async function printProductCatalogPdf(opts: GenerateOptions) {
  const doc = await buildDoc(opts);
  doc.open();
}

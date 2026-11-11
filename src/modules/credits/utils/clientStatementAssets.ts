import { COMPANY_INFO } from '../../../config/companyInfo';

export const STATEMENT_FONT = 'Montserrat';
export const STATEMENT_FONT_FILES = ['Montserrat-SemiBold.ttf', 'Montserrat-ExtraBold.ttf'] as const;

export function registerStatementFonts(pdfMake: any, files: Record<string, string>) {
  pdfMake.addVirtualFileSystem(files);
  pdfMake.addFonts({
    [STATEMENT_FONT]: {
      normal: STATEMENT_FONT_FILES[0], bold: STATEMENT_FONT_FILES[1],
      italics: STATEMENT_FONT_FILES[0], bolditalics: STATEMENT_FONT_FILES[1],
    },
  });
}

async function fetchDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load PDF asset: ${url}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

let fontPromise: Promise<string> | null = null;
const logos = new Map<string, Promise<string | null>>();

export async function loadClientStatementAssets(pdfMake: any, logoUrl = COMPANY_INFO.logoUrl) {
  // Server-side document tests supply assets directly; browser exports load them on demand.
  if (typeof window === 'undefined') return { displayFont: 'Roboto', logoDataUrl: null };
  if (!fontPromise) {
    fontPromise = Promise.all(STATEMENT_FONT_FILES.map(async name => [name, (await fetchDataUrl(`/fonts/montserrat/${name}`)).split(',')[1]]))
      .then(entries => {
        registerStatementFonts(pdfMake, Object.fromEntries(entries));
        return STATEMENT_FONT;
      })
      .catch(() => { fontPromise = null; return 'Roboto'; });
  }
  // The bundled high-resolution logo is the same mark as the default app icon.
  const url = logoUrl === '/pwa-192x192.png' ? '/pwa-512x512.png' : logoUrl;
  if (!logos.has(url)) {
    logos.set(url, fetchDataUrl(url).catch(() => { logos.delete(url); return null; }));
  }
  const [displayFont, logoDataUrl] = await Promise.all([fontPromise, logos.get(url)!]);
  return { displayFont, logoDataUrl, logoHasPadding: url === '/pwa-512x512.png' };
}

const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, filename);
const { buildClientStatementDocument } = require('../src/modules/credits/utils/clientStatementPdf.ts');
const { registerStatementFonts, STATEMENT_FONT, STATEMENT_FONT_FILES } = require('../src/modules/credits/utils/clientStatementAssets.ts');
const fixture = require('./fixtures/client-statement.cjs');
const pdfMake = require('pdfmake/build/pdfmake');
const fonts = require('pdfmake/build/vfs_fonts');
pdfMake.addVirtualFileSystem(fonts.vfs || fonts.pdfMake?.vfs || fonts);
registerStatementFonts(pdfMake, Object.fromEntries(STATEMENT_FONT_FILES.map(name => [
  name, readFileSync(path.join(__dirname, '../public/fonts/montserrat', name)).toString('base64'),
])));
const logoDataUrl = `data:image/png;base64,${readFileSync(path.join(__dirname, '../public/pwa-512x512.png')).toString('base64')}`;

async function main() {
  const directory = path.resolve(process.argv[2] || '/tmp/inquival-pdf-design');
  const generatedAt = new Date();
  mkdirSync(directory, { recursive: true });
  for (const [filename, params] of [
    ['estado-cuenta-ejemplo.pdf', fixture],
    ['estado-cuenta-resumen.pdf', { ...fixture, sales: undefined, mode: 'summary' }],
    ['estado-cuenta-vacio.pdf', { ...fixture, sales: [], credits: [] }],
    ['estado-cuenta-varias-paginas.pdf', {
      ...fixture,
      client: { ...fixture.client, name: 'Cliente de ejemplo con nombre comercial largo para revisar la lectura en varias páginas' },
      credits: [{
        ...fixture.credits[0], totalAmount: 6000, paidAmount: 5000, pendingAmount: 1000,
        payments: Array.from({ length: 50 }, (_, index) => ({
          id: `payment-${index}`, paymentDate: `2026-11-${String(index % 9 + 1).padStart(2, '0')}T00:00:00.000Z`,
          amount: 100, paymentMethodName: index % 2 ? 'Transferencia bancaria' : 'Efectivo',
          notes: `Abono de ejemplo ${index + 1}. Observación extensa para comprobar que el texto se ajuste a su columna y que los encabezados se repitan al cambiar de página.`,
        })),
      }],
    }],
  ]) {
    const buffer = await pdfMake.createPdf(buildClientStatementDocument({ ...params, now: generatedAt, logoDataUrl, logoHasPadding: true, displayFont: STATEMENT_FONT })).getBuffer();
    const filenameOut = path.join(directory, filename);
    writeFileSync(filenameOut, buffer);
    console.log(filenameOut);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

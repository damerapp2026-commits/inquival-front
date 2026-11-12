const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, filename);
const { buildQuotePdfDefinition } = require('../src/modules/quotes/utils/quotePdf.ts');
const { setCompanyInfo } = require('../src/config/companyInfo.ts');
const fixture = require('./fixtures/quote.cjs');
const pdfMake = require('pdfmake/build/pdfmake');
const fonts = require('pdfmake/build/vfs_fonts');
pdfMake.addVirtualFileSystem(fonts.vfs || fonts.pdfMake?.vfs || fonts);

async function main() {
  const directory = path.resolve(process.argv[2] || '/tmp/inquival-cotizaciones');
  mkdirSync(directory, { recursive: true });
  setCompanyInfo(fixture.companyInfo);
  const logoDataUrl = `data:image/png;base64,${readFileSync(path.join(__dirname, '../public/pwa-192x192.png')).toString('base64')}`;
  for (const [filename, quote] of [
    ['cotizacion-ejemplo-usd.pdf', fixture.quote],
    ['cotizacion-ejemplo-soles.pdf', { ...fixture.quote, currency: 'PEN', paymentMethod: 'CONTADO' }],
    ['cotizacion-ejemplo-cuotas.pdf', { ...fixture.quote, creditDays: 60, paymentScheduleType: 'INSTALLMENTS', installments: [
      { amount: 79.65, dueDate: '2026-12-12' }, { amount: 79.65, dueDate: '2027-01-11' },
    ] }],
    ['cotizacion-varias-paginas.pdf', { ...fixture.quote, total: 9876.6, items: Array.from({ length: 62 }, () => ({ ...fixture.quote.items[0] })) }],
  ]) {
    const buffer = await pdfMake.createPdf(buildQuotePdfDefinition({ ...fixture, quote, logoDataUrl })).getBuffer();
    const output = path.join(directory, filename);
    writeFileSync(output, buffer);
    console.log(output);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

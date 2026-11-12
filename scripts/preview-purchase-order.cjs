const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, filename);
const { buildPurchaseOrderPdfDefinition } = require('../src/modules/purchases/utils/purchaseOrderPdf.ts');
const fixture = require('./fixtures/purchase-order.cjs');
const pdfMake = require('pdfmake/build/pdfmake');
const fonts = require('pdfmake/build/vfs_fonts');
pdfMake.addVirtualFileSystem(fonts.vfs || fonts.pdfMake?.vfs || fonts);

async function main() {
  const directory = path.resolve(process.argv[2] || '/tmp/inquival-ordenes-compra');
  mkdirSync(directory, { recursive: true });
  const logoDataUrl = `data:image/png;base64,${readFileSync(path.join(__dirname, '../public/pwa-192x192.png')).toString('base64')}`;
  for (const [filename, params] of [
    ['orden-de-compra-ejemplo.pdf', fixture],
    ['orden-de-compra-varias-paginas.pdf', {
      ...fixture,
      order: {
        ...fixture.order, totalCost: 38440, totalCostUsd: 38440,
        items: Array.from({ length: 62 }, (_, index) => ({ ...fixture.order.items[index % 2] })),
      },
    }],
  ]) {
    const document = buildPurchaseOrderPdfDefinition({ ...params, logoDataUrl });
    const buffer = await pdfMake.createPdf(document).getBuffer();
    const output = path.join(directory, filename);
    writeFileSync(output, buffer);
    console.log(output);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

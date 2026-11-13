const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTypeScript(relativePath, mocks) {
  const filename = path.resolve(__dirname, relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = name => name in mocks ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return loaded.exports;
}

function fixture(products, response) {
  const reads = [];
  const { productService } = loadTypeScript('../src/modules/products/services/productService.ts', {
    '../../../shared/services/api': {
      api: { get: async (url, { params }) => {
        assert.equal(url, '/products');
        reads.push(params);
        const data = response ? await response(params) : {
          data: products.slice((params.page - 1) * params.limit, params.page * params.limit),
          total: products.length,
        };
        return { data: { data } };
      } },
    },
  });
  const { useProducts } = loadTypeScript('../src/modules/products/hooks/useProducts.ts', {
    '@tanstack/react-query': { useQuery: options => options },
    '../services/productService': { productService },
    'react-hot-toast': {},
  });
  return { useProducts, reads };
}

test('the unfiltered list retains the full total while showing only one page', async () => {
  const products = Array.from({ length: 45 }, (_, i) => ({ id: String(i) }));
  const { useProducts, reads } = fixture(products);
  const result = await useProducts({ page: 2, limit: 20 }).queryFn();
  assert.equal(result.total, 45);
  assert.equal(result.data.length, 20);
  assert.equal(result.data[0].id, '20');
  assert.deepEqual(reads, [{ page: 2, limit: 20 }]);
});

test('filtered totals include laboratory products beyond the first 10,000 records', async () => {
  const products = Array.from({ length: 20025 }, (_, i) => ({
    id: String(i), laboratoryId: i < 10000 ? 'lab-a' : 'lab-b',
  }));
  const { useProducts, reads } = fixture(products);
  const params = { page: 1, limit: 10000 };
  const query = useProducts(params, { allPages: true });
  const result = await query.queryFn();
  assert.equal(result.data.filter(product => product.laboratoryId === 'lab-b').length, 10025);
  assert.equal(result.total, 20025);
  assert.equal(result.data.length, 20025);
  assert.deepEqual(reads.map(params => params.page), [1, 2, 3]);
  assert.notDeepEqual(query.queryKey, useProducts(params).queryKey);
});

test('an empty catalogue completes without requesting more pages', async () => {
  const { useProducts, reads } = fixture([]);
  const result = await useProducts({ page: 1, limit: 10000 }, { allPages: true }).queryFn();
  assert.equal(result.total, 0);
  assert.deepEqual(result.data, []);
  assert.equal(reads.length, 1);
});

test('a later page failure rejects the total instead of reporting a partial count', async () => {
  const { useProducts } = fixture([], async ({ page }) => {
    if (page > 1) throw new Error('Network error');
    return { data: [{ id: 'one' }], total: 2 };
  });
  await assert.rejects(
    () => useProducts({ page: 1, limit: 1 }, { allPages: true }).queryFn(),
    /Network error/,
  );
});

for (const repeated of [false, true]) {
  test(`an unexpectedly ${repeated ? 'repeated' : 'empty'} page cannot produce a partial total`, async () => {
    const { useProducts, reads } = fixture([], async ({ page }) => ({
      data: page === 1 || repeated ? [{ id: 'one' }] : [], total: 2,
    }));
    await assert.rejects(
      () => useProducts({ page: 1, limit: 1 }, { allPages: true }).queryFn(),
      /No se pudieron cargar todos los productos/,
    );
    assert.equal(reads.length, 2);
  });
}

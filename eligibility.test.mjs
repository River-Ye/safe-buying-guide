import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assess, CRITERIA, SPACE } from './eligibility.mjs';

function verifiedProduct() {
  return {
    dimensions: { width: 40, depth: 35, height: 40, totalVerified: true, source: 'official' },
    requiredSpace: { width: 42, depth: 40, height: 42, source: 'official' },
    requirements: Object.fromEntries(CRITERIA.map(({ key }) => [key, { value: true, sources: ['official'] }])),
    sources: [{ id: 'official', url: 'https://example.com/manual' }],
    review: { status: 'limited' },
  };
}

test('only a fully evidenced product qualifies; exact space boundaries are allowed', () => {
  const product = verifiedProduct();
  assert.equal(assess(product).status, 'recommended');
  product.requiredSpace = { ...SPACE, source: 'official' };
  assert.equal(assess(product).status, 'recommended');
});

test('protrusions and manufacturer installation space cannot exceed the cabinet', () => {
  const product = verifiedProduct();
  product.dimensions.depth = 46;
  assert.equal(assess(product).status, 'excluded');
  product.dimensions.depth = 35;
  product.requiredSpace.height = 45.1;
  assert.equal(assess(product).status, 'excluded');
});

test('unknown dimensions, unknown requirements or missing evidence stay pending', () => {
  const product = verifiedProduct();
  product.dimensions.totalVerified = null;
  assert.equal(assess(product).status, 'pending');
  product.dimensions.totalVerified = true;
  product.requirements.wifiAbsent.value = null;
  assert.equal(assess(product).status, 'pending');
  product.requirements.wifiAbsent.value = true;
  product.requirements.wifiAbsent.sources = ['missing'];
  assert.equal(assess(product).status, 'pending');
  product.requirements.wifiAbsent.sources = ['official'];
  product.requiredSpace.source = 'missing';
  assert.equal(assess(product).status, 'pending');
  product.requiredSpace = null;
  assert.equal(assess(product).status, 'pending');
});

test('installation envelope cannot be smaller than the verified external size', () => {
  const product = verifiedProduct();
  product.requiredSpace.width = 30;
  assert.equal(assess(product).status, 'pending');
});

test('Wi-Fi, a failed hard requirement or a verified negative review excludes a product', () => {
  const product = verifiedProduct();
  product.requirements.wifiAbsent.value = false;
  assert.equal(assess(product).status, 'excluded');
  product.requirements.wifiAbsent.value = true;
  product.requirements.steelBolts.value = false;
  assert.equal(assess(product).status, 'excluded');
  product.requirements.steelBolts.value = true;
  product.review.status = 'negative';
  assert.equal(assess(product).status, 'excluded');
});

test('missing review research or malformed dimensions cannot qualify', () => {
  const product = verifiedProduct();
  product.review = null;
  assert.equal(assess(product).status, 'pending');
  product.review = { status: 'limited' };
  product.dimensions.width = '40';
  assert.equal(assess(product).status, 'pending');
  product.dimensions.width = -1;
  assert.equal(assess(product).status, 'pending');
});

test('an all-pending catalogue has zero recommendations', () => {
  const product = verifiedProduct();
  product.requirements.steelBolts.value = null;
  assert.deepEqual([product].filter(item => assess(item).status === 'recommended'), []);
});

test('published catalogue has complete traceable data and no known excluded products', async () => {
  const catalog = JSON.parse(await readFile(new URL('./products.json', import.meta.url), 'utf8'));
  assert.match(catalog.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(catalog.products.length > 0);
  assert.equal(new Set(catalog.products.map(p => p.id)).size, catalog.products.length);
  for (const product of catalog.products) {
    assert.ok(product.brand && product.model && product.summary && product.weightKg > 0);
    assert.ok(product.price.amount > 0 && product.price.currency === 'TWD');
    assert.ok(product.price.stock && product.price.shipping && product.price.source);
    assert.ok(product.review.note && product.review.queries.length && product.review.coverage.length);
    assert.ok(product.sources.length > 0);
    const sourceIds = product.sources.map(source => source.id);
    assert.equal(new Set(sourceIds).size, sourceIds.length);
    assert.ok(sourceIds.includes(product.dimensions.source));
    assert.ok(sourceIds.includes(product.price.source));
    assert.ok(sourceIds.includes(product.purchaseSource));
    assert.equal(product.price.source, product.purchaseSource, 'price and purchase channel must match');
    assert.equal(new URL(product.purchaseUrl).protocol, 'https:');
    for (const axis of Object.keys(SPACE)) assert.ok(Number.isFinite(product.dimensions[axis]) && product.dimensions[axis] > 0);
    if (product.requirements.taiwanWarranty.value === true) {
      assert.ok(product.requirements.taiwanWarranty.sources.includes(product.purchaseSource), 'verified warranty must cover the linked purchase channel');
    }
    for (const source of product.sources) {
      assert.equal(new URL(source.url).protocol, 'https:');
      assert.ok(source.label && source.note);
    }
    for (const { key } of CRITERIA) {
      const requirement = product.requirements[key];
      assert.ok(requirement && requirement.note);
      assert.ok([true, false, null].includes(requirement.value));
      for (const id of requirement.sources) assert.ok(sourceIds.includes(id));
      if (requirement.value === true) assert.ok(requirement.sources.length > 0);
    }
    assert.notEqual(assess(product).status, 'excluded', product.model);
  }
});

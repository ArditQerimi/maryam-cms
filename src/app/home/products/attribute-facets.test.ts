import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAttributeFacets,
  displayValue,
  isAttributeParam,
  matchesAttributeFilters,
  readAttributeFilters,
  type AttributeMeta,
  type ProductAttributes,
} from './attribute-facets';

const metas: AttributeMeta[] = [
  { id: 13, name: 'Autori', dataType: 'string', categoryId: 1 }, // Books
  { id: 18, name: 'Autori', dataType: 'string', categoryId: 2 }, // Libra (same name → one filter)
  { id: 21, name: 'Faqe', dataType: 'number', categoryId: 2 },
  { id: 25, name: 'Vëllime', dataType: 'number', categoryId: 2 },
  { id: 22, name: 'Gjuha', dataType: 'string', categoryId: 2 },
  { id: 24, name: 'Kopertinë e fortë', dataType: 'boolean', categoryId: 2 },
  { id: 30, name: 'Ngjyra', dataType: 'string', categoryId: 3 },
];

const pages = (n: number) => String(100 + n * 25);
const products: Array<{ attributes: ProductAttributes }> = [
  { attributes: { '18': 'Ibn Kajjim', '21': pages(0), '25': '2', '22': 'Shqip', '24': 'Po' } },
  { attributes: { '18': 'ibn kajjim', '21': pages(1), '25': '3', '22': 'Shqip', '24': 'Jo' } },
  { attributes: { '13': 'En-Neveviu', '21': pages(2), '25': '2', '22': 'Shqip' } },
  ...Array.from({ length: 8 }, (_, n) => ({ attributes: { '18': `Autor ${n}`, '21': pages(n + 3), '22': 'Shqip' } })),
];

test('values are shown the way the shop reads them', () => {
  assert.equal(displayValue('boolean', 'true'), 'Po');
  assert.equal(displayValue('boolean', 'JO'), 'Jo');
  assert.equal(displayValue('boolean', 'ndoshta'), null);
  assert.equal(displayValue('number', ' 320 '), '320');
  assert.equal(displayValue('number', 'njëqind'), null);
  assert.equal(displayValue('text', '  Ibn   Kajjim '), 'Ibn Kajjim');
  assert.equal(displayValue('text', '   '), null);
});

test('groups: same name is one filter, single-value attributes and size/colour names are left out', () => {
  const facets = buildAttributeFacets(products, metas, new Set(['ngjyra']));
  const byName = new Map(facets.map((facet) => [facet.name, facet]));
  assert.deepEqual([...byName.keys()].sort(), ['Autori', 'Faqe', 'Kopertinë e fortë', 'Vëllime']);

  const author = byName.get('Autori')!;
  assert.deepEqual(author.attributeIds, [13, 18]);
  assert.deepEqual(author.categoryIds, [1, 2]);
  assert.equal(author.values[0].value, 'Ibn Kajjim');
  assert.equal(author.values[0].count, 2, 'case-insensitive: "Ibn Kajjim" and "ibn kajjim" are one value');

  const pagesFacet = byName.get('Faqe')!;
  assert.equal(pagesFacet.mode, 'range', 'many different numbers → from–to');
  assert.equal(pagesFacet.min, 100);
  assert.equal(pagesFacet.max, 350);

  const volumes = byName.get('Vëllime')!;
  assert.equal(volumes.mode, 'list');
  assert.deepEqual(volumes.values.map((item) => item.value), ['2', '3']);
  assert.equal(byName.get('Kopertinë e fortë')!.values[0].value, 'Po');
});

test('URL filters select the right products', () => {
  const facets = buildAttributeFacets(products, metas);
  const author = facets.find((facet) => facet.name === 'Autori')!;
  const pagesFacet = facets.find((facet) => facet.name === 'Faqe')!;
  const params = new URLSearchParams(`a${author.id}=IBN KAJJIM&a${author.id}=En-Neveviu&a${pagesFacet.id}min=120&a${pagesFacet.id}max=150&a999=x`);
  const filters = readAttributeFilters(params, facets);
  assert.equal(filters.length, 2);

  const kept = products.filter((product) => matchesAttributeFilters(product.attributes, filters));
  // Ibn Kajjim (125 pages) and En-Neveviu (150, stored under the Books attribute id 13); not 100 pages.
  assert.deepEqual(kept.map((product) => product.attributes['21']), ['125', '150']);
});

test('a range that covers everything is no filter; only our keys are cleared', () => {
  const facets = buildAttributeFacets(products, metas);
  const pagesFacet = facets.find((facet) => facet.name === 'Faqe')!;
  const filters = readAttributeFilters(new URLSearchParams(`a${pagesFacet.id}min=0&a${pagesFacet.id}max=9999`), facets);
  assert.equal(filters.length, 0);
  assert.equal(isAttributeParam('a21'), true);
  assert.equal(isAttributeParam('a21min'), true);
  assert.equal(isAttributeParam('category'), false);
  assert.equal(isAttributeParam('a'), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeCatalogStock, summarizeProductStock, summarizeVariantStock } from './stock';

test('variant summary counts only concrete Active variants and uses explicit stock rows', () => {
  assert.deepEqual(summarizeVariantStock({
    id: 1,
    status: 'Active',
    stockRows: [{ quantity: 3 }, { quantity: 4 }],
  }), {
    activeVariantCount: 1,
    stockQuantity: 7,
    usesParentFallback: false,
    hasInvalidStock: false,
  });

  assert.deepEqual(summarizeVariantStock({
    id: 2,
    status: 'Inactive',
    stockRows: [{ quantity: 99 }],
  }), {
    activeVariantCount: 0,
    stockQuantity: null,
    usesParentFallback: false,
    hasInvalidStock: false,
  });
});

test('shared parent stock is added once even when several variants have no stock rows', () => {
  const summary = summarizeProductStock({
    id: 10,
    status: 'Active',
    parentQuantity: 5,
    variants: [
      { id: 1, status: 'Active', stockRows: [] },
      { id: 2, status: 'Active', stockRows: [] },
      { id: 3, status: 'Active', stockRows: [{ quantity: 2 }] },
      { id: 4, status: 'Inactive', stockRows: [{ quantity: 100 }] },
    ],
  });

  assert.deepEqual(summary, {
    activeVariantCount: 3,
    stockQuantity: 7,
    outOfStock: false,
    usesParentFallback: true,
    hasInvalidStock: false,
  });
});

test('catalog stock marks only Active products with Active variants and zero verified stock out', () => {
  const summary = summarizeCatalogStock([
    {
      id: 1,
      status: 'Active',
      parentQuantity: 0,
      variants: [{ id: 11, status: 'Active', stockRows: [{ quantity: 0 }] }],
    },
    {
      id: 2,
      status: 'Active',
      parentQuantity: 8,
      variants: [{ id: 21, status: 'Active', stockRows: [] }],
    },
    {
      id: 3,
      status: 'Active',
      parentQuantity: 0,
      variants: [],
    },
    {
      id: 4,
      status: 'Inactive',
      parentQuantity: 0,
      variants: [{ id: 41, status: 'Active', stockRows: [{ quantity: 0 }] }],
    },
  ]);

  assert.deepEqual(summary, {
    activeVariants: 2,
    productsWithActiveVariants: 2,
    outOfStockProducts: 1,
    hasInvalidStock: false,
  });
});

test('invalid stock is unverified rather than fabricated as zero', () => {
  const summary = summarizeCatalogStock([
    {
      id: 1,
      status: 'Active',
      parentQuantity: 0,
      variants: [{ id: 11, status: 'Active', stockRows: [{ quantity: Number.NaN }] }],
    },
  ]);

  assert.equal(summary.activeVariants, 1);
  assert.equal(summary.outOfStockProducts, null);
  assert.equal(summary.hasInvalidStock, true);
});

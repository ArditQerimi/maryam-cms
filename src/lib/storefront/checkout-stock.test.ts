import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CheckoutStockError,
  assertSharedParentStock,
  buildCatalogLockPlan,
  buildStockLockOrder,
  planStockAllocation,
} from './checkout-stock';

test('catalog and stock lock plans are deterministic', () => {
  const plan = buildCatalogLockPlan([
    { productId: 20, variantId: 3, quantity: 1 },
    { productId: 2, variantId: 9, quantity: 1 },
    { productId: 2, variantId: 4, quantity: 1 },
  ]);
  assert.deepEqual(plan, [
    { productId: 2, variantId: 4 },
    { productId: 2, variantId: 9 },
    { productId: 20, variantId: 3 },
  ]);
  assert.deepEqual(buildStockLockOrder(plan), [3, 4, 9]);
});

test('variant stock rows take precedence and are allocated in row order', () => {
  const allocation = planStockAllocation({
    variantId: 7,
    requestedQuantity: 5,
    parentQuantity: 99,
    stockRows: [
      { id: 22, warehouseId: 2, quantity: 2 },
      { id: 21, warehouseId: 1, quantity: 4 },
    ],
  });
  assert.equal(allocation.source, 'variant-rows');
  assert.equal(allocation.totalAvailable, 6);
  assert.deepEqual(allocation.decrements, [
    { stockRowId: 21, quantity: 4 },
    { stockRowId: 22, quantity: 1 },
  ]);
});

test('parent stock is fallback only when the variant has no stock rows', () => {
  const fallback = planStockAllocation({
    variantId: 7,
    requestedQuantity: 3,
    parentQuantity: 5,
    stockRows: [],
  });
  assert.equal(fallback.source, 'parent-fallback');
  assert.equal(fallback.totalAvailable, 5);
  assert.deepEqual(fallback.decrements, []);

  assert.throws(
    () => planStockAllocation({
      variantId: 7,
      requestedQuantity: 1,
      parentQuantity: 99,
      stockRows: [{ id: 21, warehouseId: 1, quantity: 0 }],
    }),
    (error: unknown) => error instanceof CheckoutStockError
      && error.code === 'insufficient-stock',
  );
});

test('shared parent fallback stock is rechecked across variants', () => {
  assert.doesNotThrow(() => assertSharedParentStock([
    { productId: 4, parentQuantity: 5, quantity: 2 },
    { productId: 4, parentQuantity: 5, quantity: 3 },
  ]));
  assert.throws(
    () => assertSharedParentStock([
      { productId: 4, parentQuantity: 5, quantity: 3 },
      { productId: 4, parentQuantity: 5, quantity: 3 },
    ]),
    (error: unknown) => error instanceof CheckoutStockError
      && error.code === 'insufficient-stock',
  );
});

test('negative or oversold inventory fails closed', () => {
  assert.throws(
    () => planStockAllocation({
      variantId: 7,
      requestedQuantity: 1,
      parentQuantity: null,
      stockRows: [{ id: 21, warehouseId: 1, quantity: -1 }],
    }),
    CheckoutStockError,
  );
  assert.throws(
    () => planStockAllocation({
      variantId: 7,
      requestedQuantity: 2,
      parentQuantity: 1,
      stockRows: [],
    }),
    CheckoutStockError,
  );
});

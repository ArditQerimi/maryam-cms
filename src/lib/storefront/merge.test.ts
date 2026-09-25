import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCartLines, mergeWishlistProductIds } from './merge';

const line = (productId: number, variantId: number, quantity: number) => ({
  productId,
  variantId,
  quantity,
});

test('cart merge combines quantities for the same server identity', () => {
  assert.deepEqual(
    mergeCartLines([line(10, 100, 2)], [line(10, 100, 3), line(11, 101, 1)]),
    [line(10, 100, 5), line(11, 101, 1)],
  );
});

test('cart merge rejects a variant presented with another product', () => {
  assert.throws(
    () => mergeCartLines([line(10, 100, 1)], [line(11, 100, 1)]),
    /cannot belong to two products/,
  );
});

test('cart merge fails closed at line quantity bounds', () => {
  assert.throws(
    () => mergeCartLines([line(10, 100, 99)], [line(10, 100, 1)]),
    /cannot exceed 99/,
  );
});

test('cart merge enforces the total quantity ceiling', () => {
  assert.throws(
    () => mergeCartLines(
      [line(1, 101, 99)],
      [line(2, 102, 99)],
      { maxLineQuantity: 99, maxItems: 100, maxTotalQuantity: 150 },
    ),
    /more than 150 total units/,
  );
});

test('cart merge deduplicates repeated legacy lines', () => {
  assert.deepEqual(
    mergeCartLines([], [line(10, 100, 1), line(10, 100, 2)]),
    [line(10, 100, 3)],
  );
});

test('wishlist merge deduplicates and sorts ids', () => {
  assert.deepEqual(mergeWishlistProductIds([9, 3], [4, 3]), [3, 4, 9]);
});

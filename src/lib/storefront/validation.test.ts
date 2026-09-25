import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CART_LINE_QUANTITY,
  parseCartAddInput,
  parseCartImportInput,
  parseWishlistImportInput,
} from './validation';
import { StorefrontInputError } from './errors';

test('cart add requires a concrete product and variant', () => {
  assert.deepEqual(
    parseCartAddInput({ productId: 12, variantId: 34 }),
    { productId: 12, variantId: 34, quantity: 1 },
  );
  assert.throws(
    () => parseCartAddInput({ productId: 12, quantity: 1 }),
    /variantId/,
  );
});

test('cart validation rejects unsafe identifiers and quantities', () => {
  assert.throws(() => parseCartAddInput({ productId: 1.5, variantId: 2 }), /positive integer/);
  assert.throws(() => parseCartAddInput({ productId: true, variantId: 2 }), /positive integer/);
  assert.throws(
    () => parseCartAddInput({ productId: 1, variantId: 2, quantity: MAX_CART_LINE_QUANTITY + 1 }),
    /positive integer/,
  );
});

test('legacy cart import only reads identity and quantity fields', () => {
  const result = parseCartImportInput({
    items: [
      {
        productId: '7',
        variantId: '8',
        quantity: '2',
        name: 'client supplied name',
        price: '0.01',
        imageUrl: 'https://attacker.invalid/image',
      },
    ],
  });

  assert.deepEqual(result, {
    items: [{ productId: 7, variantId: 8, quantity: 2 }],
  });
});

test('legacy aliases are normalized without trusting display fields', () => {
  assert.deepEqual(
    parseCartImportInput({ items: [{ id: 7, variantId: 8, qty: 2, price: '0.01' }] }),
    { items: [{ productId: 7, variantId: 8, quantity: 2 }] },
  );
  assert.deepEqual(
    parseCartImportInput([{ productId: 9, variantId: 10 }]),
    { items: [{ productId: 9, variantId: 10, quantity: 1 }] },
  );
});

test('legacy import reports a missing variant instead of choosing one', () => {
  const assertMissingVariant = (error: unknown) => {
    assert.ok(error instanceof StorefrontInputError);
    assert.equal(error.field, 'items[0].variantId');
    assert.match(error.message, /never chooses a default variant/i);
    return true;
  };

  assert.throws(
    () => parseCartImportInput({ items: [{ productId: 7, quantity: 1 }] }),
    assertMissingVariant,
  );
  assert.throws(
    () => parseCartImportInput({ productId: 7, quantity: 1 }),
    assertMissingVariant,
  );
});

test('wishlist import accepts ids and objects, but not client catalog data', () => {
  const result = parseWishlistImportInput({
    items: [4, { productId: 5, name: 'not trusted', price: '1.00' }],
  });
  assert.deepEqual(result, { productIds: [4, 5] });
});

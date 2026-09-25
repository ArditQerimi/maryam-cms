import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cartFingerprint,
  mapCartResponse,
  mapWishlistResponse,
  storefrontRequest,
  StorefrontClientError,
} from './commerce-api';

test('maps an authoritative cart snapshot without trusting client display fields', () => {
  const snapshot = mapCartResponse({
    cart: {
      owner: 'customer',
      items: [
        {
          id: 77,
          productId: 12,
          variantId: 34,
          quantity: 2,
          product: { id: 12, name: 'Server product', imageUrl: '/server.jpg' },
          variant: { id: 34, price: '19.50' },
          unitPrice: '19.50',
          available: true,
        },
      ],
    },
  });

  assert.equal(snapshot.owner, 'customer');
  assert.deepEqual(snapshot.items[0], {
    serverItemId: 77,
    productId: 12,
    variantId: 34,
    name: 'Server product',
    imageUrl: '/server.jpg',
    price: 19.5,
    quantity: 2,
    available: true,
  });
});

test('maps product-based wishlist rows and preserves unavailable prices honestly', () => {
  const snapshot = mapWishlistResponse({
    wishlist: {
      count: 1,
      items: [
        {
          productId: 9,
          product: {
            id: 9,
            name: 'Server wishlist product',
            imageUrl: null,
            price: null,
            stockQuantity: 0,
          },
          available: false,
          addedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
  });

  assert.equal(snapshot.items[0].variantId, null);
  assert.equal(snapshot.items[0].priceAvailable, false);
  assert.equal(snapshot.items[0].stockQuantity, 0);
  assert.equal(snapshot.items[0].available, false);
});

test('cart fingerprints are stable across line ordering', () => {
  const first = cartFingerprint([
    { productId: 2, variantId: 3, quantity: 1 },
    { productId: 1, variantId: 4, quantity: 2 },
  ]);
  const second = cartFingerprint([
    { productId: 1, variantId: 4, quantity: 2 },
    { productId: 2, variantId: 3, quantity: 1 },
  ]);
  assert.equal(first, second);
});

test('malformed server responses fail closed', () => {
  assert.throws(
    () => mapCartResponse({ cart: { owner: 'guest', items: [{ productId: 1 }] } }),
    (error: unknown) => error instanceof StorefrontClientError && error.code === 'invalid-response',
  );
});

test('storefront requests do not run during a non-browser render', async () => {
  await assert.rejects(
    () => storefrontRequest('/api/storefront/cart'),
    (error: unknown) => error instanceof StorefrontClientError && error.code === 'network-error',
  );
});

test('storefront requests use same-origin credentials and JSON', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'https://tenant.example' }, fetch: fakeFetch },
  });
  globalThis.fetch = fakeFetch;
  try {
    await storefrontRequest('/api/storefront/cart', { method: 'POST', body: { productId: 1 } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, 'https://tenant.example/api/storefront/cart');
    assert.equal(calls[0].init?.credentials, 'include');
    assert.equal(calls[0].init?.mode, 'same-origin');
    assert.equal(calls[0].init?.body, JSON.stringify({ productId: 1 }));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete (globalThis as { window?: unknown }).window;
  }
});

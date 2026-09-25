import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import type { CheckoutCurrency } from '@/app/shop/checkout/checkout-contract';
import { CheckoutConfigurationError } from './checkout-config';
import { CheckoutServiceError } from './checkout-service';
import { checkoutErrorResponse } from './checkout-handler';
import { checkoutCapabilitiesSuccessResponse } from './checkout-capabilities-handler';
import {
  assertCheckoutCapabilitiesSameOrigin,
  assertNoCheckoutQuoteInput,
  buildAuthoritativeCheckoutQuote,
  buildPublicCheckoutCapabilities,
  resolveQuoteOwner,
} from './checkout-capabilities';

const secret = 'test-only-order-access-secret-32-bytes-minimum';
const config = {
  tenantSubdomain: 'acme',
  currency: 'EUR' as const,
  deliveryMethodIds: new Set(['standard'] as const),
  paymentMethodIds: new Set(['cash_on_delivery'] as const),
  shippingCents: 300,
  taxBasisPoints: 1_000,
  orderAccessSecret: secret,
};

function quote(
  lines: Array<{ productId: number; variantId: number; quantity: number; unitPrice: string }>,
  overrides: Partial<{
    currency: CheckoutCurrency;
    shippingCents: number;
    taxBasisPoints: number;
    tenantSubdomain: string;
    fingerprintSecret: string;
  }> = {},
) {
  return buildAuthoritativeCheckoutQuote({
    currency: config.currency,
    lines,
    shippingCents: config.shippingCents,
    taxBasisPoints: config.taxBasisPoints,
    deliveryMethodIds: [...config.deliveryMethodIds],
    paymentMethodIds: [...config.paymentMethodIds],
    tenantSubdomain: config.tenantSubdomain,
    fingerprintSecret: secret,
    ...overrides,
  });
}

test('capability quote calculates exact server totals and stable fingerprints', () => {
  const result = quote([
    { productId: 2, variantId: 5, quantity: 2, unitPrice: '2.00' },
    { productId: 1, variantId: 1, quantity: 2, unitPrice: '1.25' },
  ]);
  assert.deepEqual({
    currency: result.currency,
    lineCount: result.lineCount,
    totalQuantity: result.totalQuantity,
    subtotal: result.subtotal,
    shipping: result.shipping,
    tax: result.tax,
    grandTotal: result.grandTotal,
    empty: result.empty,
  }, {
    currency: 'EUR',
    lineCount: 2,
    totalQuantity: 4,
    subtotal: '6.50',
    shipping: '3.00',
    tax: '0.65',
    grandTotal: '10.15',
    empty: false,
  });
  assert.match(result.fingerprint, /^[0-9a-f]{64}$/);

  const reordered = quote([
    { productId: 1, variantId: 1, quantity: 2, unitPrice: '1.25' },
    { productId: 2, variantId: 5, quantity: 2, unitPrice: '2.00' },
  ]);
  assert.equal(reordered.fingerprint, result.fingerprint);
  assert.notEqual(quote([
    { productId: 1, variantId: 1, quantity: 3, unitPrice: '1.25' },
  ]).fingerprint, result.fingerprint);
  assert.notEqual(quote([
    { productId: 1, variantId: 1, quantity: 2, unitPrice: '1.26' },
  ]).fingerprint, result.fingerprint);
  assert.notEqual(quote([
    { productId: 1, variantId: 1, quantity: 2, unitPrice: '1.25' },
  ], { shippingCents: 301 }).fingerprint, result.fingerprint);
  assert.notEqual(quote([
    { productId: 1, variantId: 1, quantity: 2, unitPrice: '1.25' },
  ], { tenantSubdomain: 'other' }).fingerprint, result.fingerprint);
});

test('empty quote is a typed zero quote even when configured delivery is nonzero', () => {
  const result = quote([]);
  assert.deepEqual({
    lineCount: result.lineCount,
    totalQuantity: result.totalQuantity,
    subtotal: result.subtotal,
    shipping: result.shipping,
    tax: result.tax,
    grandTotal: result.grandTotal,
    empty: result.empty,
  }, {
    lineCount: 0,
    totalQuantity: 0,
    subtotal: '0.00',
    shipping: '0.00',
    tax: '0.00',
    grandTotal: '0.00',
    empty: true,
  });
});

test('public capabilities expose only neutral configured methods and public totals', async () => {
  const capabilities = buildPublicCheckoutCapabilities(config, quote([]));
  assert.deepEqual(capabilities.deliveryMethods, [
    { id: 'standard', label: 'Standard delivery' },
  ]);
  assert.deepEqual(capabilities.paymentMethods, [
    { id: 'cash_on_delivery', label: 'Cash on delivery' },
  ]);
  assert.deepEqual(capabilities.promotions, { available: false, code: 'unavailable' });
  assert.equal(capabilities.quote.currency, 'EUR');

  const publicJson = JSON.stringify(capabilities);
  for (const forbidden of [
    'card',
    secret,
    'acme',
    'productStocks',
    'costPrice',
    'productName',
    'taxBasisPoints',
    'shippingCents',
  ]) {
    assert.equal(publicJson.includes(forbidden), false, forbidden);
  }

  const response = checkoutCapabilitiesSuccessResponse(capabilities);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  assert.deepEqual(await response.json(), { ok: true, capabilities });
});

test('quote ownership prefers the authenticated Customer over any guest cookie', () => {
  const guestCartId = '00000000-0000-4000-8000-000000000001';
  assert.deepEqual(resolveQuoteOwner(42, guestCartId), { kind: 'customer', userId: 42 });
  assert.deepEqual(resolveQuoteOwner(null, guestCartId), { kind: 'guest', cartId: guestCartId });
  assert.equal(resolveQuoteOwner(null, null), null);
  assert.equal(resolveQuoteOwner(0, guestCartId), null);
});

test('capabilities GET requires exact Origin or same-origin Fetch Metadata', () => {
  const context = {
    requestAuthority: 'acme.stores.example.com',
    requestProtocol: 'https:' as const,
  };
  const request = (headers: Record<string, string>) => new NextRequest(
    'https://acme.stores.example.com/api/storefront/checkout/capabilities',
    { headers },
  );

  assert.doesNotThrow(() => assertCheckoutCapabilitiesSameOrigin(
    request({ origin: 'https://acme.stores.example.com' }),
    context,
  ));
  assert.doesNotThrow(() => assertCheckoutCapabilitiesSameOrigin(
    request({ 'sec-fetch-site': 'same-origin' }),
    context,
  ));
  const rejectedHeaders: Array<Record<string, string>> = [
    {},
    { origin: 'https://other.example.com' },
    { 'sec-fetch-site': 'same-site' },
  ];
  for (const headers of rejectedHeaders) {
    assert.throws(
      () => assertCheckoutCapabilitiesSameOrigin(request(headers), context),
      (error: unknown) => error instanceof CheckoutServiceError
        && error.code === 'same-origin-required',
    );
  }
});

test('capability quotes reject all query-string input', () => {
  const noInput = { nextUrl: { search: '' }, body: null, headers: new Headers() };
  assert.doesNotThrow(() => assertNoCheckoutQuoteInput(noInput));
  for (const search of [
    '?productId=1',
    '?variantId=2',
    '?price=0.01',
    '?grandTotal=0.01',
  ]) {
    assert.throws(
      () => assertNoCheckoutQuoteInput({
        ...noInput,
        nextUrl: { search },
      }),
      (error: unknown) => error instanceof CheckoutServiceError
        && error.code === 'invalid-request',
    );
  }
  assert.throws(
    () => assertNoCheckoutQuoteInput({
      ...noInput,
      body: new ReadableStream(),
    }),
    (error: unknown) => error instanceof CheckoutServiceError
      && error.code === 'invalid-request',
  );
  assert.throws(
    () => assertNoCheckoutQuoteInput({
      ...noInput,
      headers: new Headers({ 'content-length': '1' }),
    }),
    (error: unknown) => error instanceof CheckoutServiceError
      && error.code === 'invalid-request',
  );
});

test('capability configuration and schema failures use the typed no-store envelope', async () => {
  const response = checkoutErrorResponse(new CheckoutConfigurationError());
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: 'checkout-unavailable',
      message: 'Checkout is not available because secure server configuration is incomplete.',
      retryable: false,
    },
  });

  const schemaError = Object.assign(new Error('missing relation'), { code: '42P01' });
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const schemaResponse = checkoutErrorResponse(schemaError);
    assert.match(schemaResponse.headers.get('cache-control') || '', /no-store/);
    assert.equal(schemaResponse.status, 503);
    assert.deepEqual(await schemaResponse.json(), {
      ok: false,
      error: {
        code: 'checkout-temporarily-unavailable',
        message: 'Secure checkout is temporarily unavailable. Retry the request.',
        retryable: true,
      },
    });
  } finally {
    console.error = originalError;
  }
});

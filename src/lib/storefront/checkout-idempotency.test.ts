import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CheckoutConfirmation,
  CheckoutRequest,
} from '@/app/shop/checkout/checkout-contract';
import {
  checkoutScope,
  classifyIdempotencyRecord,
  hashCheckoutRequest,
  hashIdempotencyKey,
  isCheckoutConfirmation,
  parseIdempotencyKey,
  storedConfirmationMatches,
  type StoredIdempotencyRecord,
} from './checkout-idempotency';

const address = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  company: '',
  address1: '12 Example Street',
  address2: '',
  country: 'GB',
  city: 'London',
  region: 'Greater London',
  postalCode: 'SW1A 1AA',
};
const request: CheckoutRequest = {
  contact: {
    email: 'ada@example.com',
    phone: '',
    marketingOptIn: false,
  },
  shippingAddress: address,
  billing: { sameAsShipping: true, address },
  delivery: { methodId: 'standard' },
  payment: { methodId: 'cash_on_delivery' },
  promotionCode: null,
  terms: { accepted: true },
};
const confirmation: CheckoutConfirmation = {
  orderId: '42',
  orderNumber: 'SF-20260923-abcdefghijklmnop',
  contactEmail: 'ada@example.com',
  currency: 'EUR',
  confirmationPath: '/shop/order-confirmation',
};
const key = 'checkout-1234567890abcdef';
const keyHash = hashIdempotencyKey(key);
const requestHash = hashCheckoutRequest(request);

test('idempotency keys are strictly bounded and hashed for storage', () => {
  assert.equal(parseIdempotencyKey(key), key);
  assert.throws(() => parseIdempotencyKey('short'), /Idempotency-Key/);
  assert.throws(() => parseIdempotencyKey('x'.repeat(129)), /Idempotency-Key/);
  assert.match(keyHash, /^[0-9a-f]{64}$/);
  assert.notEqual(keyHash, key);
});

test('idempotency scope is the exact Customer or opaque guest cart, never email', () => {
  const customer = checkoutScope({ kind: 'customer', userId: 42 });
  const otherCustomer = checkoutScope({ kind: 'customer', userId: 43 });
  const guest = checkoutScope({
    kind: 'guest',
    cartId: '00000000-0000-4000-8000-000000000001',
  });
  const otherGuest = checkoutScope({
    kind: 'guest',
    cartId: '00000000-0000-4000-8000-000000000002',
  });

  assert.notEqual(customer.hash, otherCustomer.hash);
  assert.notEqual(guest.hash, otherGuest.hash);
  assert.notEqual(customer.hash, guest.hash);
  assert.doesNotMatch(customer.hash, /42|ada@example\.com/);
});

test('completed idempotency rows replay only the same request and scope', () => {
  const expected = {
    scopeKind: 'guest' as const,
    scopeHash: checkoutScope({
      kind: 'guest',
      cartId: '00000000-0000-4000-8000-000000000001',
    }).hash,
    idempotencyKeyHash: keyHash,
    requestHash,
  };
  const record: StoredIdempotencyRecord = {
    ...expected,
    status: 'completed',
    saleId: 42,
    responsePayload: confirmation,
    completedAt: new Date(),
  };

  assert.deepEqual(classifyIdempotencyRecord(record, expected), {
    kind: 'replay',
    saleId: 42,
    responsePayload: confirmation,
  });
  assert.equal(classifyIdempotencyRecord(record, {
    ...expected,
    requestHash: hashCheckoutRequest({ ...request, promotionCode: 'OTHER' }),
  }).kind, 'conflict');
  assert.equal(classifyIdempotencyRecord({
    ...record,
    scopeHash: checkoutScope({ kind: 'customer', userId: 42 }).hash,
  }, expected).kind, 'conflict');
  assert.equal(classifyIdempotencyRecord({ ...record, status: 'processing' }, expected).kind, 'in-progress');
  assert.equal(classifyIdempotencyRecord(null, expected).kind, 'new');
});

test('persisted confirmation currency is validated and replay-bound', () => {
  assert.equal(isCheckoutConfirmation(confirmation), true);
  assert.equal(isCheckoutConfirmation({ ...confirmation, currency: 'JPY' }), false);
  assert.equal(storedConfirmationMatches({ ...confirmation, currency: 'USD' }, confirmation), false);
});

test('replay result is bound to the authoritative confirmation fields', () => {
  assert.equal(storedConfirmationMatches({
    confirmationPath: confirmation.confirmationPath,
    currency: confirmation.currency,
    contactEmail: confirmation.contactEmail,
    orderNumber: confirmation.orderNumber,
    orderId: confirmation.orderId,
  }, confirmation), true);
  assert.equal(storedConfirmationMatches({ ...confirmation, orderId: '43' }, confirmation), false);
  assert.equal(storedConfirmationMatches({ ...confirmation, orderNumber: 'other' }, confirmation), false);
  assert.equal(storedConfirmationMatches({ ...confirmation, currency: 'USD' }, confirmation), false);
  assert.equal(storedConfirmationMatches({ ...confirmation, extra: true }, confirmation), false);
});

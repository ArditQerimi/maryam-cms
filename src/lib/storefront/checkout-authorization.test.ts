import assert from 'node:assert/strict';
import test from 'node:test';
import type { CheckoutRequest } from '@/app/shop/checkout/checkout-contract';
import {
  CheckoutConfigurationError,
  loadCheckoutRuntimeConfig,
} from './checkout-config';
import {
  CheckoutOwnershipError,
  customerOwnsSale,
  resolveCheckoutOwner,
} from './checkout-authorization';
import {
  CheckoutServiceError,
  assertCheckoutCapabilities,
} from './checkout-service';

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
  contact: { email: 'ada@example.com', phone: '', marketingOptIn: false },
  shippingAddress: address,
  billing: { sameAsShipping: true, address },
  delivery: { methodId: 'standard' },
  payment: { methodId: 'cash_on_delivery' },
  promotionCode: null,
  terms: { accepted: true },
};
const environment = {
  STOREFRONT_CHECKOUT_CONFIG_JSON: JSON.stringify({
    acme: {
      enabled: true,
      currency: 'EUR',
      deliveryMethodIds: ['standard'],
      paymentMethodIds: ['cash_on_delivery'],
      shippingCents: 0,
      taxBasisPoints: 0,
    },
  }),
  STOREFRONT_ORDER_ACCESS_SECRET: 'test-only-order-access-secret-32-bytes-minimum',
};

test('checkout configuration is explicit and fails closed when incomplete', () => {
  const config = loadCheckoutRuntimeConfig(environment, 'acme');
  assert.equal(config.tenantSubdomain, 'acme');
  assert.equal(config.currency, 'EUR');
  assert.equal(config.deliveryMethodIds.has('standard'), true);
  assert.equal(config.paymentMethodIds.has('cash_on_delivery'), true);
  assert.equal(config.shippingCents, 0);
  assert.equal(config.taxBasisPoints, 0);

  for (const currency of ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD']) {
    const parsed = loadCheckoutRuntimeConfig({
      ...environment,
      STOREFRONT_CHECKOUT_CONFIG_JSON: JSON.stringify({
        acme: {
          enabled: true,
          currency,
          deliveryMethodIds: ['standard'],
          paymentMethodIds: ['cash_on_delivery'],
          shippingCents: 0,
          taxBasisPoints: 0,
        },
      }),
    }, 'acme');
    assert.equal(parsed.currency, currency);
  }

  assert.throws(
    () => loadCheckoutRuntimeConfig({}, 'acme'),
    CheckoutConfigurationError,
  );
  assert.throws(
    () => loadCheckoutRuntimeConfig(environment, 'other'),
    CheckoutConfigurationError,
  );
  assert.throws(
    () => loadCheckoutRuntimeConfig({
      ...environment,
      STOREFRONT_CHECKOUT_CONFIG_JSON: JSON.stringify({
        acme: {
          enabled: true,
          currency: 'EUR',
          deliveryMethodIds: ['standard'],
          paymentMethodIds: ['card'],
          shippingCents: 0,
          taxBasisPoints: 0,
        },
      }),
    }, 'acme'),
    CheckoutConfigurationError,
  );
  assert.throws(
    () => loadCheckoutRuntimeConfig({
      ...environment,
      STOREFRONT_CHECKOUT_CONFIG_JSON: JSON.stringify({
        acme: {
          enabled: true,
          currency: 'EUR',
          deliveryMethodIds: ['standard'],
          paymentMethodIds: ['cash_on_delivery'],
          shippingCents: 0,
          taxBasisPoints: null,
        },
      }),
    }, 'acme'),
    CheckoutConfigurationError,
  );
  for (const currency of ['eur', 'US', 'JPY', 'USX', 123]) {
    assert.throws(
      () => loadCheckoutRuntimeConfig({
        ...environment,
        STOREFRONT_CHECKOUT_CONFIG_JSON: JSON.stringify({
          acme: {
            enabled: true,
            currency,
            deliveryMethodIds: ['standard'],
            paymentMethodIds: ['cash_on_delivery'],
            shippingCents: 0,
            taxBasisPoints: 0,
          },
        }),
      }, 'acme'),
      CheckoutConfigurationError,
    );
  }
});

test('authenticated checkout uses the exact user cart and guest checkout needs an opaque cart', () => {
  const guestCartId = '00000000-0000-4000-8000-000000000001';
  assert.deepEqual(resolveCheckoutOwner(42, guestCartId), {
    kind: 'customer',
    userId: 42,
  });
  assert.deepEqual(resolveCheckoutOwner(null, guestCartId), {
    kind: 'guest',
    cartId: guestCartId,
  });
  assert.throws(() => resolveCheckoutOwner(null, null), CheckoutOwnershipError);
  assert.throws(() => resolveCheckoutOwner(0, guestCartId), CheckoutOwnershipError);
});

test('Customer order access requires the dedicated purchaser owner and online sale', () => {
  assert.equal(customerOwnsSale({ customerUserId: 42, isOnline: true }, 42), true);
  assert.equal(customerOwnsSale({ customerUserId: 43, isOnline: true }, 42), false);
  assert.equal(customerOwnsSale({ customerUserId: null, isOnline: true }, 42), false);
  assert.equal(customerOwnsSale({ customerUserId: 42, isOnline: false }, 42), false);
});

test('capabilities are server-allowlisted; card has a typed unavailable failure', () => {
  const config = loadCheckoutRuntimeConfig(environment, 'acme');
  assert.doesNotThrow(() => assertCheckoutCapabilities(request, config));
  assert.throws(
    () => assertCheckoutCapabilities({
      ...request,
      payment: { methodId: 'card' },
    }, config),
    (error: unknown) => error instanceof CheckoutServiceError
      && error.code === 'payment-method-unavailable'
      && error.retryable === false
      && Boolean(error.fieldErrors?.['payment.methodId']),
  );
  assert.throws(
    () => assertCheckoutCapabilities({
      ...request,
      delivery: { methodId: 'express' },
    }, config),
    (error: unknown) => error instanceof CheckoutServiceError
      && error.code === 'delivery-method-unavailable',
  );
  // Promotion codes are now validated against the `coupons` table inside the
  // order transaction, so the capability allowlist no longer rejects them.
  assert.doesNotThrow(() => assertCheckoutCapabilities({
    ...request,
    promotionCode: 'SUMMER25',
  }, config));
});

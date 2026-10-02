import assert from 'node:assert/strict';
import test from 'node:test';
import type { CheckoutAddress, CheckoutRequest } from '@/app/home/checkout/checkout-contract';
import {
  CheckoutValidationError,
  parseCheckoutRequest,
} from './checkout-validation';

const address: CheckoutAddress = {
  firstName: ' Ada ',
  lastName: ' Lovelace ',
  company: '',
  address1: ' 12 Example Street ',
  address2: '',
  country: 'gb',
  city: ' London ',
  region: ' Greater London ',
  postalCode: 'SW1A 1AA ',
};

function checkoutRequest(overrides: Record<string, unknown> = {}) {
  return {
    contact: {
      email: ' Ada@Example.COM ',
      phone: '+44 20 7946 0958',
      marketingOptIn: false,
    },
    shippingAddress: { ...address },
    billing: {
      sameAsShipping: true,
      address: { ...address },
    },
    delivery: { methodId: 'standard' },
    payment: { methodId: 'cash_on_delivery' },
    promotionCode: null,
    terms: { accepted: true },
    ...overrides,
  };
}

test('checkout validation accepts and normalizes the exact request contract', () => {
  const parsed = parseCheckoutRequest(checkoutRequest({ promotionCode: ' summer25 ' }));
  assert.deepEqual(parsed, {
    contact: {
      email: 'Ada@example.com',
      phone: '+44 20 7946 0958',
      marketingOptIn: false,
    },
    shippingAddress: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      company: '',
      address1: '12 Example Street',
      address2: '',
      country: 'GB',
      city: 'London',
      region: 'Greater London',
      postalCode: 'SW1A 1AA',
    },
    billing: {
      sameAsShipping: true,
      address: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        company: '',
        address1: '12 Example Street',
        address2: '',
        country: 'GB',
        city: 'London',
        region: 'Greater London',
        postalCode: 'SW1A 1AA',
      },
    },
    delivery: { methodId: 'standard' },
    payment: { methodId: 'cash_on_delivery' },
    promotionCode: 'SUMMER25',
    terms: { accepted: true },
  } satisfies CheckoutRequest);
});

test('checkout validation rejects browser pricing, purchaser, and ownership fields', () => {
  for (const injected of [
    { total: '0.01' },
    { prices: [{ price: '0.01' }] },
    { cart: { lines: [{ productId: 1, variantId: 2, quantity: 1 }] } },
    { stock: [{ quantity: 99 }] },
    { productName: 'client product' },
    { discount: '100.00' },
    { purchaserId: 42 },
    { companyId: 7 },
    { userId: 9 },
  ]) {
    assert.throws(
      () => parseCheckoutRequest(checkoutRequest(injected)),
      (error: unknown) => error instanceof CheckoutValidationError
        && /unsupported fields/i.test(error.message),
    );
  }
});

test('checkout validation reports safe field errors without reflecting unsafe input', () => {
  const unsafeEmail = 'attacker@example.com\u202e<script>';
  assert.throws(
    () => parseCheckoutRequest(checkoutRequest({
      contact: {
        email: unsafeEmail,
        phone: 'not a safe phone value',
        marketingOptIn: false,
      },
      terms: { accepted: false },
    })),
    (error: unknown) => {
      assert.ok(error instanceof CheckoutValidationError);
      assert.equal(error.message, 'Check the highlighted checkout fields.');
      assert.doesNotMatch(error.message, /attacker|script/);
      assert.ok(error.fieldErrors['contact.email']);
      assert.ok(error.fieldErrors['contact.phone']);
      assert.ok(error.fieldErrors['terms.accepted']);
      return true;
    },
  );
});

test('same-as-shipping cannot carry a different billing address', () => {
  assert.throws(
    () => parseCheckoutRequest(checkoutRequest({
      billing: {
        sameAsShipping: true,
        address: { ...address, address1: '99 Attacker Road' },
      },
    })),
    (error: unknown) => error instanceof CheckoutValidationError
      && Boolean(error.fieldErrors['billingAddress.address1'])
      && !error.message.includes('Attacker'),
  );
});

test('raw card fields and invalid marketing values are not accepted', () => {
  assert.throws(
    () => parseCheckoutRequest(checkoutRequest({
      payment: {
        methodId: 'card',
        cardNumber: '4242424242424242',
      },
    })),
    CheckoutValidationError,
  );
  assert.throws(
    () => parseCheckoutRequest(checkoutRequest({
      contact: {
        email: 'valid@example.com',
        phone: '',
        marketingOptIn: 'yes',
      },
    })),
    CheckoutValidationError,
  );
});

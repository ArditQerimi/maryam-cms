import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStorefrontOperationalStatus,
  projectCheckoutRuntimeConfig,
  unavailableCheckoutOperationalStatus,
} from './operational-contract';

const runtimeConfig = {
  currency: 'EUR' as const,
  deliveryMethodIds: new Set(['express', 'standard'] as const),
  paymentMethodIds: new Set(['cash_on_delivery'] as const),
  shippingCents: 450,
  taxBasisPoints: 500,
  orderAccessSecret: 'test-secret-that-must-never-be-projected',
  tenantSubdomain: 'private-tenant-label',
};

test('checkout projection is minimal and redacts secrets and internal labels', () => {
  const projection = projectCheckoutRuntimeConfig(runtimeConfig);
  assert.deepEqual(projection, {
    state: 'configured',
    currency: 'EUR',
    allowedDeliveryMethodIds: ['express', 'standard'],
    allowedPaymentMethodIds: ['cash_on_delivery'],
    shippingCents: 450,
    taxBasisPoints: 500,
    card: 'unavailable',
    orderPlacement: 'disabled',
    uiAdapter: 'disconnected',
  });

  const serialized = JSON.stringify(projection);
  assert.equal(serialized.includes(runtimeConfig.orderAccessSecret), false);
  assert.equal(serialized.includes(runtimeConfig.tenantSubdomain), false);
  assert.equal(serialized.includes('card'), true); // explicit unavailable policy, not a capability
  assert.equal(serialized.includes('sk_'), false);
});

test('unavailable checkout and migration controls remain fail closed', () => {
  const status = buildStorefrontOperationalStatus({
    company: { displayName: 'Bookshop', subdomain: 'bookshop', status: 'Active' },
    checkout: unavailableCheckoutOperationalStatus(),
  });
  assert.equal(status.checkout.state, 'unavailable');
  assert.deepEqual(status.checkout.allowedPaymentMethodIds, []);
  assert.equal(status.checkout.card, 'unavailable');
  assert.equal(status.checkout.orderPlacement, 'disabled');
  assert.equal(status.checkout.uiAdapter, 'disconnected');
  assert.equal(status.migration003.state, 'unverified');
  assert.equal(status.migration003.ready, false);
  assert.equal(status.media.state, 'managed-by-platform');
  assert.equal(status.legal.state, 'platform-managed');
  assert.equal(status.shipping.verification, 'unverified');
});

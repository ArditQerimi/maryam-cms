import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAuthoritativeRevenue } from './revenue';

test('revenue uses one persisted order currency and exact decimal totals', () => {
  const result = resolveAuthoritativeRevenue({
    eligibleOrderCount: 2,
    rows: [
      { currency: 'USD', orderCount: 1, total: '19.99' },
      { currency: 'usd', orderCount: 1, total: '30.01' },
    ],
  });

  assert.deepEqual(result, {
    status: 'available',
    amount: '50.00',
    currency: 'USD',
    orderCount: 2,
  });
});

test('revenue is unverified when coverage, currency, or zero-order currency is unknown', () => {
  assert.equal(resolveAuthoritativeRevenue({
    eligibleOrderCount: 2,
    rows: [{ currency: 'USD', orderCount: 1, total: '20.00' }],
  }).status, 'unverified');

  assert.equal(resolveAuthoritativeRevenue({
    eligibleOrderCount: 2,
    rows: [
      { currency: 'USD', orderCount: 1, total: '20.00' },
      { currency: 'EUR', orderCount: 1, total: '20.00' },
    ],
  }).status, 'unverified');

  const zero = resolveAuthoritativeRevenue({ eligibleOrderCount: 0, rows: [] });
  assert.equal(zero.status, 'unverified');
  assert.match(zero.status === 'unverified' ? zero.reason : '', /zero revenue is not asserted/);
});

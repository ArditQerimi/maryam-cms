import assert from 'node:assert/strict';
import test from 'node:test';

import { projectOnlineOrderSummary } from './projection';

test('order projection exposes only the staff-safe order summary', () => {
  const projected = projectOnlineOrderSummary({
    id: 91,
    reference: 'SF-2026-00091',
    createdAt: new Date('2026-09-20T10:30:00.000Z'),
    status: 'Completed',
    customerUserId: 18,
    itemUnits: 4,
    grandTotal: '125.5',
    total: '125.5',
    currency: 'usd',
    costPrice: '999999.00',
    contactEmail: 'customer@example.com',
    contactPhone: '+1 555 0100',
    shippingAddress: { line1: 'Private street' },
    billingAddress: { line1: 'Private billing' },
    customer: { name: 'Full Customer Name', email: 'private@example.com' },
    dbConnectionString: 'postgres://secret',
    paymentToken: 'secret-token',
  });

  assert.deepEqual(projected, {
    id: 91,
    reference: 'SF-2026-00091',
    createdAt: '2026-09-20T10:30:00.000Z',
    status: 'Completed',
    customerKind: 'registered',
    itemUnits: 4,
    total: '125.50',
    currency: 'USD',
  });

  const serialized = JSON.stringify(projected);
  for (const forbidden of [
    'costPrice',
    'contactEmail',
    'contactPhone',
    'shippingAddress',
    'billingAddress',
    'Full Customer Name',
    'private@example.com',
    'dbConnectionString',
    'paymentToken',
    'private',
    'secret',
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('order projection fails closed for invalid identity, money, currency, and dates', () => {
  assert.equal(projectOnlineOrderSummary({ id: 0, reference: 'bad' }), null);
  assert.equal(projectOnlineOrderSummary(null), null);

  assert.deepEqual(projectOnlineOrderSummary({
    id: 5,
    reference: 'x'.repeat(140),
    createdAt: 'not-a-date',
    status: 'Unknown internal status',
    customerUserId: null,
    itemUnits: -2,
    total: '12e999',
    currency: 'JPY',
  }), {
    id: 5,
    reference: 'x'.repeat(100),
    createdAt: null,
    status: 'Unknown',
    customerKind: 'guest',
    itemUnits: null,
    total: null,
    currency: null,
  });
});

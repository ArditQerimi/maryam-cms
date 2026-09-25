import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CheckoutMoneyError,
  addMoney,
  applyBasisPoints,
  calculateCheckoutTotals,
  formatPersistedCheckoutMoney,
  moneyToCents,
  multiplyMoney,
  sumCheckoutSubtotal,
} from './checkout-money';

test('money helpers use exact integer cents', () => {
  assert.equal(moneyToCents('9999999999.99'), BigInt('999999999999'));
  assert.equal(moneyToCents('0.1'), BigInt(10));
  assert.equal(multiplyMoney('0.10', 3), '0.30');
  assert.equal(addMoney(['0.10', '0.20', '9999999999.69']), '9999999999.99');
  assert.equal(
    sumCheckoutSubtotal([
      { unitPrice: '0.10', quantity: 3 },
      { unitPrice: '123456789.99', quantity: 2 },
    ]),
    '246913580.28',
  );
});

test('configured tax rounds half-up to a cent', () => {
  assert.equal(applyBasisPoints('10.04', 2_000), '2.01');
  assert.equal(applyBasisPoints('10.05', 2_000), '2.01');
  assert.equal(applyBasisPoints('10.06', 2_000), '2.01');
});

test('server totals combine only configured shipping and tax', () => {
  assert.deepEqual(calculateCheckoutTotals({
    subtotal: '100.00',
    shippingCents: 500,
    taxBasisPoints: 2_000,
  }), {
    subtotal: '100.00',
    shipping: '5.00',
    tax: '20.00',
    grandTotal: '125.00',
  });
});

test('persisted order money is formatted with its stored currency', () => {
  assert.equal(formatPersistedCheckoutMoney('1234.50', 'EUR'), '€1,234.50');
  assert.match(formatPersistedCheckoutMoney('1234.50', 'USD'), /1,234\.50/);
  assert.equal(formatPersistedCheckoutMoney('invalid', 'GBP'), 'Amount unavailable (GBP)');
});

test('money helpers reject unsafe values and database precision overflow', () => {
  for (const value of ['-1.00', '1e2', '1.001', 'NaN', '10000000000.00']) {
    assert.throws(() => moneyToCents(value), CheckoutMoneyError);
  }
  assert.throws(() => multiplyMoney('1.00', 1.5), CheckoutMoneyError);
  assert.throws(() => applyBasisPoints('1.00', 10_001), CheckoutMoneyError);
  assert.throws(
    () => calculateCheckoutTotals({
      subtotal: '9999999999.99',
      shippingCents: 1,
      taxBasisPoints: 0,
    }),
    CheckoutMoneyError,
  );
});

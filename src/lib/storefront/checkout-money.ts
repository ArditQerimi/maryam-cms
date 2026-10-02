import type { CheckoutCurrency } from '@/app/home/checkout/checkout-contract';

const CENTS_PER_UNIT = BigInt(100);
const MAX_MONEY_CENTS = BigInt('999999999999');
const ZERO = BigInt(0);
const MONEY_PATTERN = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/;

export type CheckoutMoney = string;

export class CheckoutMoneyError extends Error {
  constructor(message = 'A monetary value is invalid.') {
    super(message);
    this.name = 'CheckoutMoneyError';
  }
}

function assertMoneyCents(cents: bigint) {
  if (cents < ZERO || cents > MAX_MONEY_CENTS) {
    throw new CheckoutMoneyError('A monetary value is outside the supported range.');
  }
}

export function moneyToCents(value: string | number): bigint {
  const raw = String(value).trim();
  const match = raw.match(MONEY_PATTERN);
  if (!match) throw new CheckoutMoneyError();

  const cents = BigInt(match[1]) * CENTS_PER_UNIT
    + BigInt((match[2] || '').padEnd(2, '0'));
  assertMoneyCents(cents);
  return cents;
}

export function centsToMoney(cents: bigint): CheckoutMoney {
  assertMoneyCents(cents);
  return `${cents / CENTS_PER_UNIT}.${String(cents % CENTS_PER_UNIT).padStart(2, '0')}`;
}

export function multiplyMoney(unitPrice: string | number, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new CheckoutMoneyError('A quantity is invalid.');
  }
  return centsToMoney(moneyToCents(unitPrice) * BigInt(quantity));
}

export function addMoney(values: readonly (string | number)[]) {
  return centsToMoney(values.reduce((sum, value) => sum + moneyToCents(value), ZERO));
}

export function sumCheckoutSubtotal(
  lines: readonly { unitPrice: string | number; quantity: number }[],
) {
  if (lines.some((line) => (
    !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99
  ))) {
    throw new CheckoutMoneyError('A quantity is invalid.');
  }
  const subtotalCents = lines.reduce(
    (sum, line) => sum + moneyToCents(line.unitPrice) * BigInt(line.quantity),
    ZERO,
  );
  assertMoneyCents(subtotalCents);
  return centsToMoney(subtotalCents);
}

/** Round half-up to the nearest cent; the configured rate is never inferred. */
export function applyBasisPoints(amount: string | number, basisPoints: number) {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new CheckoutMoneyError('A tax basis-point value is invalid.');
  }
  const amountCents = moneyToCents(amount);
  return centsToMoney(
    (amountCents * BigInt(basisPoints) + BigInt(5_000)) / BigInt(10_000),
  );
}

export function formatPersistedCheckoutMoney(
  value: string,
  currency: CheckoutCurrency,
) {
  if (!/^\d+(?:\.\d{2})?$/.test(value)) return `Amount unavailable (${currency})`;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(Number(value));
}

export function calculateCheckoutTotals(input: {
  subtotal: string;
  shippingCents: number;
  taxBasisPoints: number;
}) {
  if (!Number.isSafeInteger(input.shippingCents) || input.shippingCents < 0) {
    throw new CheckoutMoneyError('A shipping amount is invalid.');
  }
  if (
    !Number.isSafeInteger(input.taxBasisPoints)
    || input.taxBasisPoints < 0
    || input.taxBasisPoints > 10_000
  ) {
    throw new CheckoutMoneyError('A tax basis-point value is invalid.');
  }

  const subtotalCents = moneyToCents(input.subtotal);
  const shippingCents = BigInt(input.shippingCents);
  const taxCents = (
    subtotalCents * BigInt(input.taxBasisPoints) + BigInt(5_000)
  ) / BigInt(10_000);
  const grandTotalCents = subtotalCents + shippingCents + taxCents;
  assertMoneyCents(shippingCents);
  assertMoneyCents(taxCents);
  assertMoneyCents(grandTotalCents);

  return {
    subtotal: centsToMoney(subtotalCents),
    shipping: centsToMoney(shippingCents),
    tax: centsToMoney(taxCents),
    grandTotal: centsToMoney(grandTotalCents),
  };
}

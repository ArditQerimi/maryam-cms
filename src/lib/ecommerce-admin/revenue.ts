import { normalizePersistedCurrency, normalizePersistedMoney } from './projection';
import type { RevenueSummary, StoreCurrency } from './types';

export type PersistedCurrencyRevenueRow = {
  currency: unknown;
  orderCount: unknown;
  total: unknown;
};

function nonNegativeInteger(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function addMoney(left: string, right: string) {
  const leftCents = BigInt(left.replace('.', ''));
  const rightCents = BigInt(right.replace('.', ''));
  const total = leftCents + rightCents;
  const whole = total / BigInt(100);
  const cents = total % BigInt(100);
  return `${whole}.${cents.toString().padStart(2, '0')}`;
}

/**
 * Revenue is shown only when every Pending/Completed online order has a
 * supported persisted currency and all covered orders use the same currency.
 * No exchange rate, environment setting, locale, or currency symbol is used.
 */
export function resolveAuthoritativeRevenue(input: {
  eligibleOrderCount: number;
  rows: readonly PersistedCurrencyRevenueRow[];
}): RevenueSummary {
  if (input.eligibleOrderCount === 0) {
    return {
      status: 'unverified',
      reason: 'No authoritative store currency is persisted yet, so zero revenue is not asserted.',
    };
  }

  const normalized = input.rows.map((row) => ({
    currency: normalizePersistedCurrency(row.currency),
    orderCount: nonNegativeInteger(row.orderCount),
    total: normalizePersistedMoney(row.total),
  }));

  if (normalized.some((row) => (
    !row.currency
    || row.orderCount === null
    || row.total === null
    || row.total.startsWith('-')
  ))) {
    return {
      status: 'unverified',
      reason: 'One or more persisted online totals could not be verified in a supported store currency.',
    };
  }

  const coveredOrderCount = normalized.reduce((sum, row) => sum + row.orderCount!, 0);
  if (coveredOrderCount !== input.eligibleOrderCount) {
    return {
      status: 'unverified',
      reason: 'Some eligible online orders do not have persisted currency, so total revenue would be incomplete.',
    };
  }

  const currencies = new Set<StoreCurrency>(normalized.map((row) => row.currency!));
  if (currencies.size !== 1) {
    return {
      status: 'unverified',
      reason: 'Persisted online orders use more than one currency; no conversion was inferred.',
    };
  }

  try {
    const amount = normalized.reduce(
      (sum, row) => addMoney(sum, row.total!),
      '0.00',
    );
    return {
      status: 'available',
      amount,
      currency: normalized[0].currency!,
      orderCount: coveredOrderCount,
    };
  } catch {
    return {
      status: 'unverified',
      reason: 'Persisted online revenue could not be calculated exactly.',
    };
  }
}

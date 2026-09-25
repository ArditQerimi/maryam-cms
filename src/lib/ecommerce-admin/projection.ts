import type { OnlineOrderSummary, StoreCurrency } from './types';

const SUPPORTED_CURRENCIES = new Set<StoreCurrency>(['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD']);
const ORDER_STATUSES = new Set(['Pending', 'Completed', 'Cancelled', 'Returned']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function safeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (!normalized) return null;
  return Array.from(normalized).slice(0, maxLength).join('');
}

export function normalizePersistedMoney(value: unknown) {
  const raw = typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(2)
    : typeof value === 'string'
      ? value.trim()
      : '';

  const match = raw.match(/^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const whole = match[2].replace(/^0+(?=\d)/, '');
  const fraction = (match[3] || '').padEnd(2, '0');
  return `${match[1]}${whole}.${fraction}`;
}

export function normalizePersistedCurrency(value: unknown): StoreCurrency | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLocaleUpperCase('en-US');
  return SUPPORTED_CURRENCIES.has(normalized as StoreCurrency) ? normalized as StoreCurrency : null;
}

function safeDate(value: unknown) {
  const date = value instanceof Date
    ? value
    : typeof value === 'string' && value.trim()
      ? new Date(value)
      : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

/** Whitelist projection for an order row. Unknown fields are never copied. */
export function projectOnlineOrderSummary(value: unknown): OnlineOrderSummary | null {
  if (!isRecord(value)) return null;
  const id = positiveInteger(value.id);
  if (!id) return null;

  const rawStatus = safeText(value.status, 32);
  const status = rawStatus && ORDER_STATUSES.has(rawStatus)
    ? rawStatus as OnlineOrderSummary['status']
    : 'Unknown';

  let customerKind: OnlineOrderSummary['customerKind'] = 'unknown';
  if (value.customerUserId === null) {
    customerKind = 'guest';
  } else if (positiveInteger(value.customerUserId)) {
    customerKind = 'registered';
  }

  return {
    id,
    reference: safeText(value.reference, 100) || `Order #${id}`,
    createdAt: safeDate(value.createdAt),
    status,
    customerKind,
    itemUnits: nonNegativeInteger(value.itemUnits),
    total: normalizePersistedMoney(value.total),
    currency: normalizePersistedCurrency(value.currency),
  };
}

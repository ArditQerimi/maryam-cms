import { createHash } from 'node:crypto';
import type {
  CheckoutConfirmation,
  CheckoutCurrency,
  CheckoutRequest,
} from '@/app/home/checkout/checkout-contract';
import { ORDER_CONFIRMATION_PATH } from './checkout-access';
import type { CheckoutOwner } from './checkout-authorization';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const DIGITS_PATTERN = /^\d+$/;
const SAFE_REFERENCE_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const SAFE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHECKOUT_CURRENCIES = new Set<CheckoutCurrency>([
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'AUD',
]);

export class CheckoutIdempotencyInputError extends Error {
  constructor() {
    super('A valid Idempotency-Key header is required.');
    this.name = 'CheckoutIdempotencyInputError';
  }
}

export function parseIdempotencyKey(value: string | null | undefined) {
  if (!value || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new CheckoutIdempotencyInputError();
  }
  return value;
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function checkoutScope(owner: CheckoutOwner) {
  return owner.kind === 'customer'
    ? {
        kind: 'customer' as const,
        hash: sha256(`customer:${owner.userId}`),
      }
    : {
        kind: 'guest' as const,
        hash: sha256(`guest-cart:${owner.cartId}`),
      };
}

export function hashIdempotencyKey(key: string) {
  return sha256(`checkout-idempotency:${key}`);
}

/** The parser emits a fixed, normalized object shape, making this stable and bound. */
export function hashCheckoutRequest(request: CheckoutRequest) {
  return sha256(JSON.stringify(request));
}

export type StoredIdempotencyRecord = {
  scopeKind: 'customer' | 'guest';
  scopeHash: string;
  idempotencyKeyHash: string;
  requestHash: string;
  status: 'processing' | 'completed';
  saleId: number | null;
  responsePayload: unknown;
  completedAt: Date | null;
};

export type IdempotencyDecision =
  | { kind: 'new' }
  | { kind: 'in-progress' }
  | { kind: 'replay'; saleId: number; responsePayload: unknown }
  | { kind: 'conflict' }
  | { kind: 'invalid-result' };

export function classifyIdempotencyRecord(
  record: StoredIdempotencyRecord | null,
  expected: {
    scopeKind: 'customer' | 'guest';
    scopeHash: string;
    idempotencyKeyHash: string;
    requestHash: string;
  },
): IdempotencyDecision {
  if (!record) return { kind: 'new' };
  if (
    record.scopeKind !== expected.scopeKind
    || record.scopeHash !== expected.scopeHash
    || record.idempotencyKeyHash !== expected.idempotencyKeyHash
    || record.requestHash !== expected.requestHash
  ) {
    return { kind: 'conflict' };
  }
  if (record.status === 'processing') return { kind: 'in-progress' };
  if (
    record.status !== 'completed'
    || !Number.isSafeInteger(record.saleId)
    || (record.saleId as number) < 1
    || !record.completedAt
    || !record.responsePayload
  ) {
    return { kind: 'invalid-result' };
  }
  return {
    kind: 'replay',
    saleId: record.saleId as number,
    responsePayload: record.responsePayload,
  };
}

export function isCheckoutConfirmation(value: unknown): value is CheckoutConfirmation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const exactKeys = [
    'orderId',
    'orderNumber',
    'contactEmail',
    'currency',
    'confirmationPath',
  ].every((key) => Object.prototype.hasOwnProperty.call(record, key))
    && Object.keys(record).length === 5;

  return exactKeys
    && typeof record.orderId === 'string'
    && DIGITS_PATTERN.test(record.orderId)
    && typeof record.orderNumber === 'string'
    && SAFE_REFERENCE_PATTERN.test(record.orderNumber)
    && typeof record.contactEmail === 'string'
    && record.contactEmail.length <= 254
    && SAFE_EMAIL_PATTERN.test(record.contactEmail)
    && typeof record.currency === 'string'
    && CHECKOUT_CURRENCIES.has(record.currency as CheckoutCurrency)
    && record.confirmationPath === ORDER_CONFIRMATION_PATH;
}

/** Never replay a stored result unless it is exactly bound to the real sale row. */
export function storedConfirmationMatches(
  stored: unknown,
  authoritative: CheckoutConfirmation,
) {
  return isCheckoutConfirmation(stored)
    && stored.orderId === authoritative.orderId
    && stored.orderNumber === authoritative.orderNumber
    && stored.contactEmail === authoritative.contactEmail
    && stored.currency === authoritative.currency
    && stored.confirmationPath === authoritative.confirmationPath;
}

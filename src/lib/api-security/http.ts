import { NextResponse } from 'next/server';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Content-Type-Options': 'nosniff',
} as const;

export function apiJson<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS },
  });
}

export function apiError(message: string, status = 400) {
  return apiJson({ error: message }, status);
}

export function apiInternalError(message = 'Internal server error') {
  return apiError(message, 500);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function positiveSafeInteger(value: unknown): number | null {
  const normalized = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : null;
}

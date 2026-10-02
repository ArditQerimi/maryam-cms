import { getSafeCustomerReturnTo } from '@/lib/auth-validation';

const INTERNAL_ORIGIN = 'https://store.invalid';

/**
 * Keeps account return destinations on known same-store customer paths. The
 * shared validator rejects protocol-relative, backslash/encoded-separator, and
 * cross-origin redirect tricks.
 */
export function getSafeReturnTo(
  value: unknown,
  fallback = '/customer/orders',
) {
  return getSafeCustomerReturnTo(value, fallback);
}

export function withSafeReturnTo(path: string, value: unknown) {
  const loginUrl = new URL(path, INTERNAL_ORIGIN);
  if (loginUrl.origin !== INTERNAL_ORIGIN) {
    return withSafeReturnTo('/home/login', value);
  }

  loginUrl.searchParams.set('returnTo', getSafeReturnTo(value));
  loginUrl.hash = '';
  return `${loginUrl.pathname}${loginUrl.search}`;
}

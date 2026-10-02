export type AuthErrorCode =
  | 'missing-fields'
  | 'invalid-email'
  | 'password-too-short'
  | 'password-mismatch'
  | 'company-name-required'
  | 'company-name-too-short'
  | 'name-too-short'
  | 'terms-required'
  | 'email-taken'
  | 'account-suspended'
  | 'superadmin-domain-required'
  | 'tenant-domain-required'
  | 'company-not-found'
  | 'tenant-not-found'
  | 'database-error'
  | 'invalid-credentials';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUSTOMER_RETURN_INTERNAL_ORIGIN = 'https://store.invalid';
const CUSTOMER_RETURN_MAX_LENGTH = 2048;
const CUSTOMER_RETURN_UNSAFE = /[\u0000-\u001f\u007f\\]/i;
const CUSTOMER_RETURN_ENCODED_SEPARATOR = /%(?:2f|5c|00|0d|0a)/i;
const CUSTOMER_RETURN_PATHS = [
  '/home/cart',
  '/home/checkout',
  '/home/wishlist',
  '/home/compare',
  '/home/account',
  '/customer',
] as const;

export type LoginAudience = 'staff' | 'customer';

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim().toLowerCase());
}

export function isValidPassword(value: string) {
  return value.trim().length >= 8;
}

export function isValidName(value: string) {
  return value.trim().length >= 2;
}

export function isValidCompanyName(value: string) {
  return value.trim().length >= 2;
}

export function parseLoginAudience(
  value: FormDataEntryValue | null | undefined,
): LoginAudience | null {
  if (value === null || value === undefined || value === '') return 'staff';

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'customer' || normalized === 'staff') return normalized;
  return null;
}

export function isActualCustomerRole(value: unknown) {
  return typeof value === 'string' && value.trim().toLowerCase() === 'customer';
}

export function isActiveCustomerAccount(value: { status?: unknown; roleName?: unknown } | null | undefined) {
  return Boolean(
    value &&
    value.status === 'Active' &&
    isActualCustomerRole(value.roleName)
  );
}

export function isRoleAllowedForAudience(roleName: unknown, audience: LoginAudience) {
  if (typeof roleName !== 'string' || !roleName.trim()) return false;
  if (audience === 'customer') return isActualCustomerRole(roleName);
  return !isActualCustomerRole(roleName);
}

function isAllowedCustomerReturnPath(pathname: string) {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalizedPath === '/home') return true;
  return CUSTOMER_RETURN_PATHS.some(
    (allowedPath) => normalizedPath === allowedPath || normalizedPath.startsWith(`${allowedPath}/`)
  );
}

function normalizeCustomerReturnTo(value: unknown) {
  if (typeof value !== 'string') return null;

  const candidate = value.trim();
  if (
    !candidate ||
    candidate.length > CUSTOMER_RETURN_MAX_LENGTH ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    CUSTOMER_RETURN_UNSAFE.test(candidate) ||
    CUSTOMER_RETURN_ENCODED_SEPARATOR.test(candidate)
  ) {
    return null;
  }

  try {
    const url = new URL(candidate, CUSTOMER_RETURN_INTERNAL_ORIGIN);
    if (
      url.origin !== CUSTOMER_RETURN_INTERNAL_ORIGIN ||
      !isAllowedCustomerReturnPath(url.pathname)
    ) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Restrict post-login customer redirects to account, order, cart, checkout,
 * wishlist, and compare paths on the current store. The returned value is
 * always a root-relative same-store path.
 */
export function getSafeCustomerReturnTo(
  value: unknown,
  fallback = '/customer/orders',
) {
  return normalizeCustomerReturnTo(value) || normalizeCustomerReturnTo(fallback) || '/customer/orders';
}

export function normalizeReturnTo(value: string | FormDataEntryValue | null | undefined, fallback: string) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const allowed = new Set(['/login', '/home/login']);
  return allowed.has(normalized) ? normalized : fallback;
}

function parsePositiveSessionId(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isSessionForCompany(session: unknown, companyId: unknown) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false;
  const sessionCompanyId = parsePositiveSessionId((session as Record<string, unknown>).companyId);
  const expectedCompanyId = parsePositiveSessionId(companyId);
  return sessionCompanyId !== null && sessionCompanyId === expectedCompanyId;
}

/** Accept old signed customer tokens while enforcing the new audience claim. */
export function hasCustomerSessionAudience(session: unknown) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false;
  const payload = session as Record<string, unknown>;
  const audience = payload.audience;
  return payload.platformRole === 'customer' &&
    payload.isPlatformUser !== true &&
    parsePositiveSessionId(payload.userId) !== null &&
    parsePositiveSessionId(payload.companyId) !== null &&
    (payload.tenantRole === undefined || isActualCustomerRole(payload.tenantRole)) &&
    (audience === undefined || audience === 'customer');
}

/**
 * A signed-in staff member of the store (not a platform administrator).
 * The shop treats them exactly like a customer: My account, cart, wishlist,
 * compare and checkout all run on their own tenant user record.
 */
export function hasTenantStaffSessionAudience(session: unknown) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false;
  const payload = session as Record<string, unknown>;
  return payload.platformRole === 'admin' &&
    payload.isPlatformUser !== true &&
    parsePositiveSessionId(payload.userId) !== null &&
    parsePositiveSessionId(payload.companyId) !== null &&
    (payload.audience === undefined || payload.audience === 'staff');
}

/** Customer or store staff: anyone who may shop and use My account. */
export function hasShopperSessionAudience(session: unknown) {
  return hasCustomerSessionAudience(session) || hasTenantStaffSessionAudience(session);
}

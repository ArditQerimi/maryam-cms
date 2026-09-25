const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export type StorefrontProtocol = 'http:' | 'https:';

function firstHeaderValue(value: string | null | undefined) {
  return String(value || '').split(',')[0].trim();
}

/**
 * Normalize a DNS host without retaining a port. This intentionally rejects
 * IPv6 and malformed authorities instead of trying to guess a tenant.
 */
export function normalizeStorefrontHostname(input: string | null | undefined) {
  let value = firstHeaderValue(input).toLowerCase();
  if (!value || value.includes('/') || value.includes('?') || value.includes('#')) {
    return null;
  }

  if (value.startsWith('[')) {
    return null;
  }

  const lastColon = value.lastIndexOf(':');
  if (lastColon >= 0) {
    if (value.indexOf(':') !== lastColon) {
      return null;
    }
    const port = value.slice(lastColon + 1);
    if (!/^\d{1,5}$/.test(port)) {
      return null;
    }
    value = value.slice(0, lastColon);
  }

  value = value.replace(/\.+$/, '');
  if (!value || value.length > 253 || IPV4_HOST.test(value)) {
    return null;
  }

  const labels = value.split('.');
  if (labels.some((label) => !HOSTNAME_LABEL.test(label))) {
    return null;
  }

  return value;
}

function normalizeConfiguredDomain(input: string | null | undefined) {
  const raw = firstHeaderValue(input);
  if (!raw) return null;

  try {
    const candidate = raw.includes('://') ? new URL(raw).hostname : raw;
    return normalizeStorefrontHostname(candidate);
  } catch {
    return null;
  }
}

/**
 * Resolve the configured storefront base domain. NEXT_PUBLIC_DOMAIN is kept as
 * a compatibility fallback, but no tenant/default company is ever selected.
 */
export function getConfiguredStorefrontBaseDomain(
  env: Record<string, string | undefined> = process.env,
) {
  return normalizeConfiguredDomain(
    env.STOREFRONT_BASE_DOMAIN || env.NEXT_PUBLIC_DOMAIN || '',
  );
}

/**
 * Return exactly one tenant label for a storefront host. With no configured
 * production domain, only an explicit <tenant>.localhost host is accepted.
 */
export function extractStorefrontSubdomain(
  input: string | null | undefined,
  baseDomain?: string | null,
) {
  const hostname = normalizeStorefrontHostname(input);
  if (!hostname) return null;

  const base = baseDomain ? normalizeStorefrontHostname(baseDomain) : null;
  let prefix: string;

  if (base) {
    if (hostname === base) return null;
    const suffix = `.${base}`;
    if (!hostname.endsWith(suffix)) return null;
    prefix = hostname.slice(0, -suffix.length);
  } else {
    const suffix = '.localhost';
    if (!hostname.endsWith(suffix)) return null;
    prefix = hostname.slice(0, -suffix.length);
  }

  if (!prefix || prefix.includes('.')) return null;
  if (!HOSTNAME_LABEL.test(prefix)) return null;
  if (prefix === 'www' || prefix === 'admin') return null;

  return prefix;
}

export function getRequestProtocol(
  headers: { get(name: string): string | null },
  fallbackProtocol: string = 'https:',
): StorefrontProtocol {
  const forwarded = firstHeaderValue(headers.get('x-forwarded-proto')).toLowerCase();
  if (forwarded === 'https' || forwarded === 'http') {
    return `${forwarded}:`;
  }

  const normalizedFallback = fallbackProtocol.toLowerCase();
  return normalizedFallback === 'http:' ? 'http:' : 'https:';
}

export function getRequestAuthority(
  headers: { get(name: string): string | null },
  fallbackHost?: string | null,
  protocol: StorefrontProtocol = 'https:',
) {
  const forwarded = firstHeaderValue(
    headers.get('x-forwarded-host') || headers.get('x-forwarded-server'),
  );
  const host = firstHeaderValue(headers.get('host')) || firstHeaderValue(fallbackHost);
  const authority = forwarded || host;
  if (!authority || authority.includes('/') || authority.includes('@')) return null;

  try {
    const url = new URL(`${protocol}//${authority}`);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      return null;
    }
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

export function isSameOrigin(
  origin: string | null | undefined,
  requestAuthority: string | null | undefined,
  protocol: StorefrontProtocol,
) {
  if (!origin || !requestAuthority) return false;

  try {
    const originUrl = new URL(origin);
    if (
      originUrl.username ||
      originUrl.password ||
      originUrl.pathname !== '/' ||
      originUrl.search ||
      originUrl.hash
    ) {
      return false;
    }
    const expected = new URL(`${protocol}//${requestAuthority}`);
    return originUrl.origin.toLowerCase() === expected.origin.toLowerCase();
  } catch {
    return false;
  }
}

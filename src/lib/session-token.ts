const DEVELOPMENT_SESSION_SECRET = 'super-secret-default-key-please-change-in-production';
const MINIMUM_PRODUCTION_SECRET_BYTES = 32;
const WEAK_SECRET_PATTERN = /(?:change[-_\s]?me|default|example|placeholder|your[-_\s]?(?:session)?[-_\s]?secret|replace[-_\s]?me)/i;

export type SessionSecretEnvironment = Record<string, string | undefined>;

function isStrongProductionSecret(secret: string) {
  const bytes = new TextEncoder().encode(secret).byteLength;
  if (bytes < MINIMUM_PRODUCTION_SECRET_BYTES) return false;
  if (new Set(secret).size < 12) return false;
  return !WEAK_SECRET_PATTERN.test(secret);
}

/**
 * Resolve the signing key at use time so production cannot silently fall back
 * after startup. Development keeps the historical fallback for local session
 * compatibility; production requires a unique, high-entropy configured value.
 */
export function resolveSessionSecret(env: SessionSecretEnvironment = process.env) {
  const configured = String(env.SESSION_SECRET || '');
  if (!configured.trim()) {
    if (env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be configured with a strong secret in production.');
    }
    return DEVELOPMENT_SESSION_SECRET;
  }

  if (env.NODE_ENV === 'production' && !isStrongProductionSecret(configured)) {
    throw new Error('SESSION_SECRET must be at least 32 bytes and must not be a placeholder in production.');
  }

  return configured;
}

// Fail application startup in production rather than importing a predictable
// signing key. Development imports remain usable with the compatibility key.
if (process.env.NODE_ENV === 'production') {
  resolveSessionSecret(process.env);
}

function encodeBase64Url(value: string) {
  return btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeBase64Url(value: string) {
  return atob(value.replace(/-/g, '+').replace(/_/g, '/'));
}

export async function encrypt(payload: Record<string, unknown>) {
  // Preserve the existing JWT-like envelope and header for token compatibility.
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify({
    ...payload,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(resolveSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );

  const signature = encodeBase64Url(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function decrypt(token: string | undefined = '') {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(resolveSessionSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigStr = decodeBase64Url(signature);
    const sigBuf = new Uint8Array(sigStr.length);
    for (let index = 0; index < sigStr.length; index += 1) {
      sigBuf[index] = sigStr.charCodeAt(index);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuf,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    if (!isValid) return null;

    const header = JSON.parse(decodeBase64Url(encodedHeader));
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT') return null;

    const payload = JSON.parse(decodeBase64Url(encodedPayload));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

import { headers } from 'next/headers';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/;

function fromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = (env.NEXT_PUBLIC_SITE_URL ?? '').trim()
    || (env.NEXT_PUBLIC_DOMAIN ? `http://${env.NEXT_PUBLIC_DOMAIN.trim()}` : '');
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

/**
 * The public origin (scheme://host[:port]) of the shop, for links that leave the site
 * (emails, canonical / Open Graph URLs). It follows the host the visitor actually used,
 * so it is right on any domain without configuration; only when the request itself looks
 * local (a proxy that hides the real host) does it fall back to NEXT_PUBLIC_SITE_URL /
 * NEXT_PUBLIC_DOMAIN, and finally to the local dev server. It never invents
 * "localhost:3000" on a live site that has a real host.
 */
export async function getSiteOrigin(): Promise<string> {
  const env = fromEnv();
  try {
    const headerStore = await headers();
    const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(',')[0].trim();
    if (host && !LOCAL_HOST.test(host)) {
      const proto = (headerStore.get('x-forwarded-proto') || '').split(',')[0].trim() || 'https';
      return `${proto}://${host}`;
    }
    if (env && !LOCAL_HOST.test(new URL(env).host)) return env;
    if (host) {
      const proto = (headerStore.get('x-forwarded-proto') || '').split(',')[0].trim() || 'http';
      return `${proto}://${host}`;
    }
  } catch {
    // No request context (build time): use the environment.
  }
  return env ?? 'http://localhost:3003';
}

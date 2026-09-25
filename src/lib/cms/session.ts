import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export type CmsSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * Whether a decoded session payload may enter the /cms admin.
 * Tenant staff own their company's CMS; platform super admins may open it too.
 * Customer sessions are always rejected.
 */
export function isCmsSession(
  session: unknown,
): session is CmsSession {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false;
  const payload = session as Record<string, unknown>;

  if (payload.isPlatformUser === true || payload.platformRole === 'super_admin') {
    return payload.platformRole === 'super_admin';
  }

  return payload.platformRole === 'admin' && payload.audience !== 'customer';
}

/**
 * Server-side guard for every /cms route. The proxy already filters anonymous
 * traffic, this is the defence-in-depth check that also runs on direct RSC
 * requests and server actions.
 */
export async function requireCmsSession(): Promise<CmsSession> {
  const session = await getSession().catch(() => null);
  if (!isCmsSession(session)) redirect('/login');
  return session;
}

/** Only allow internal, same-origin CMS paths as post-login targets. */
export function safeCmsReturnTo(value: unknown, fallback = '/cms/dashboard'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  if (!trimmed.startsWith('/cms')) return fallback;
  if (/[?&]error=/.test(trimmed)) return fallback;
  return trimmed;
}

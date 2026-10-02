import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/session-token';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

const PUBLIC_PREFIXES = ['/home', '/login', '/_next'];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isStaffSession(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const session = payload as Record<string, unknown>;
  const audience = session.audience;

  // Platform super admins manage every tenant, so they may open the CMS too.
  if (session.isPlatformUser === true || session.platformRole === 'super_admin') {
    return audience === undefined || audience === 'platform';
  }

  // Tenant staff (any non-customer role) owns the CMS for their own company.
  return (
    session.platformRole === 'admin' &&
    session.isPlatformUser !== true &&
    audience !== 'customer'
  );
}

/**
 * Cookie-only, optimistic route filtering for the CMS admin. Every /cms route
 * requires a signed staff session; tenant/user checks still happen in the data
 * access layer through getSession() and getContextDb().
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // The root URL is the storefront home for everyone. Signed-in staff keep
  // landing on the CMS dashboard so the admin flow stays unchanged.
  if (pathname === '/') {
    const rootCookie = request.cookies.get('session')?.value;
    const rootSession = rootCookie ? await decrypt(rootCookie).catch(() => null) : null;
    const target = isStaffSession(rootSession) ? '/cms/dashboard' : '/home';
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (isPublicPath(pathname)) {
    // The login screen is meaningless once a staff session already exists.
    if (pathname === '/login') {
      const cookie = request.cookies.get('session')?.value;
      if (cookie) {
        const session = await decrypt(cookie).catch(() => null);
        if (isStaffSession(session)) {
          return NextResponse.redirect(new URL('/cms/dashboard', request.url));
        }
      }
    }
    return NextResponse.next();
  }

  const cookie = request.cookies.get('session')?.value;
  const session = cookie ? await decrypt(cookie).catch(() => null) : null;

  if (!isStaffSession(session)) {
    const login = new URL('/login', request.url);
    const returnTo = `${pathname}${search}`;
    if (returnTo !== '/cms' && returnTo !== '/cms/') {
      login.searchParams.set('returnTo', returnTo);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

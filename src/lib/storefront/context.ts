import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import * as tenantSchema from '@/db/schema-tenant';
import { getTenantDb } from '@/db/index';
import { decrypt } from '@/lib/session-token';
import { isAdminHost } from '@/lib/admin-host';
import { StorefrontError } from './errors';
import {
  extractStorefrontSubdomain,
  getConfiguredStorefrontBaseDomain,
  getRequestAuthority,
  getRequestProtocol,
  isSameOrigin,
  normalizeStorefrontHostname,
  type StorefrontProtocol,
} from './host';

export type StorefrontCustomer = {
  id: number;
  name: string;
  email: string;
  roleName: string;
};

export type StorefrontCompany = {
  id: number;
  subdomain: string;
  dbConnectionString: string;
  dbSchema: string;
  status: string;
};

export type StorefrontContext = {
  company: StorefrontCompany;
  db: ReturnType<typeof getTenantDb>;
  customer: StorefrontCustomer | null;
  session: Record<string, unknown> | null;
  requestHost: string;
  requestAuthority: string;
  requestProtocol: StorefrontProtocol;
  requestOrigin: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSessionInteger(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function hasCustomerRole(value: unknown) {
  return typeof value === 'string' && value.trim().toLowerCase() === 'customer';
}

/**
 * Resolve a storefront request without using the application's tenant
 * fallback resolver. A host must identify one exact active company, and a
 * session (when present) must belong to that same company and an active
 * Customer user in the selected tenant database.
 */
export async function getStorefrontContext(
  request: NextRequest,
  options: { allowGuest?: boolean } = {},
): Promise<StorefrontContext> {
  const allowGuest = options.allowGuest ?? true;
  const protocol = getRequestProtocol(request.headers, request.nextUrl.protocol);
  const authority = getRequestAuthority(request.headers, request.nextUrl.host, protocol);
  if (!authority) {
    throw new StorefrontError(404, 'storefront-host-required', 'A valid storefront host is required.');
  }

  const configuredBase = getConfiguredStorefrontBaseDomain();
  const developmentBase = process.env.NODE_ENV === 'production' ? null : 'localhost';
  const baseDomain = configuredBase || developmentBase;
  if (!baseDomain && process.env.NODE_ENV === 'production') {
    throw new StorefrontError(
      500,
      'storefront-host-not-configured',
      'Storefront host routing is not configured.',
    );
  }

  const hostname = normalizeStorefrontHostname(authority);
  if (isAdminHost(hostname)) {
    throw new StorefrontError(404, 'storefront-host-required', 'A tenant storefront host is required.');
  }
  let subdomain = extractStorefrontSubdomain(hostname, baseDomain);
  if (!subdomain && process.env.NODE_ENV !== 'production') {
    // Development-only convenience: plain `localhost`/`127.0.0.1` carry no
    // `<tenant>.` prefix, so every strict storefront API (cart, wishlist,
    // checkout) would be unreachable while developing. Map local dev hosts to
    // DEFAULT_TENANT_SUBDOMAIN. Production keeps the strict requirement above,
    // and extractStorefrontSubdomain itself is untouched (host.test.ts).
    const hostNoPort = authority.replace(/:\d+$/, '');
    if (hostNoPort === 'localhost' || hostNoPort === '127.0.0.1' || hostNoPort === '[::1]') {
      const devTenant = (process.env.DEFAULT_TENANT_SUBDOMAIN || '').trim();
      if (devTenant) subdomain = devTenant;
    }
  }
  if (!subdomain) {
    throw new StorefrontError(404, 'storefront-host-required', 'A tenant storefront host is required.');
  }

  // Deliberately query by the exact parsed subdomain. Do not call
  // getContextCompany/getContextDb: those legacy helpers intentionally have
  // default-tenant behavior and are not suitable for storefront persistence.
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.subdomain, subdomain),
  });
  if (!company) {
    throw new StorefrontError(404, 'storefront-tenant-not-found', 'Storefront tenant not found.');
  }
  if (company.status !== 'Active') {
    throw new StorefrontError(403, 'storefront-tenant-inactive', 'This storefront is not available.');
  }

  const sessionCookie = request.cookies.get('session')?.value;
  // Decode the signed payload here instead of calling the legacy getSession()
  // helper: that helper resolves through the application's fallback tenant
  // path, which is intentionally forbidden for storefront persistence.
  const sessionValue = sessionCookie !== undefined ? await decrypt(sessionCookie) : null;
  if (sessionCookie !== undefined && !sessionValue) {
    throw new StorefrontError(401, 'invalid-session', 'Your session has expired.');
  }

  const session = isRecord(sessionValue) ? sessionValue : null;
  if (
    session &&
    (typeof session.exp !== 'number' || !Number.isFinite(session.exp) || session.exp <= Date.now())
  ) {
    throw new StorefrontError(401, 'invalid-session', 'Your session has expired.');
  }
  let customer: StorefrontCustomer | null = null;
  const db = getTenantDb(company.dbConnectionString, company.dbSchema);

  const sessionUserId = session ? parseSessionInteger(session.userId) : null;
  const sessionCompanyId = session ? parseSessionInteger(session.companyId) : null;
  const isCustomerSessionForTenant = Boolean(
    session &&
      sessionUserId &&
      sessionCompanyId &&
      sessionCompanyId === company.id &&
      (session.isPlatformUser === undefined || session.isPlatformUser === false) &&
      // Customers, and store staff shopping as themselves.
      ((session.platformRole === 'customer' &&
        (session.audience === undefined || session.audience === 'customer') &&
        (session.tenantRole === undefined || hasCustomerRole(session.tenantRole))) ||
        (session.platformRole === 'admin' &&
          (session.audience === undefined || session.audience === 'staff'))),
  );
  // A staff/admin (or other-tenant) session browsing the shop is not a
  // customer: it shops exactly like a signed-out guest (the CMS live preview
  // does this). Guest-capable endpoints serve it as a guest; customer-only
  // endpoints answer 401 like they do for any guest, never with its data.
  if (session && !isCustomerSessionForTenant && !allowGuest) {
    throw new StorefrontError(401, 'authentication-required', 'Sign in as a Customer to continue.');
  }

  if (session && isCustomerSessionForTenant && sessionUserId) {

    const [customerRow] = await db
      .select({
        id: tenantSchema.users.id,
        name: tenantSchema.users.name,
        email: tenantSchema.users.email,
        status: tenantSchema.users.status,
        roleName: tenantSchema.tenantRoles.name,
      })
      .from(tenantSchema.users)
      .leftJoin(tenantSchema.tenantRoles, eq(tenantSchema.tenantRoles.id, tenantSchema.users.tenantRoleId))
      .where(eq(tenantSchema.users.id, sessionUserId))
      .limit(1);

    if (
      !customerRow ||
      customerRow.status !== 'Active' ||
      (session.platformRole === 'customer' && !hasCustomerRole(customerRow.roleName))
    ) {
      throw new StorefrontError(403, 'active-customer-required', 'An active Customer account is required.');
    }

    customer = {
      id: customerRow.id,
      name: customerRow.name,
      email: customerRow.email,
      roleName: customerRow.roleName || 'Customer',
    };
  } else if (!allowGuest) {
    throw new StorefrontError(401, 'authentication-required', 'Sign in as a Customer to continue.');
  }

  const requestOrigin = `${protocol}//${authority}`;
  return {
    company: {
      id: company.id,
      subdomain: company.subdomain,
      dbConnectionString: company.dbConnectionString,
      dbSchema: company.dbSchema,
      status: company.status,
    },
    db,
    customer,
    session,
    requestHost: hostname!,
    requestAuthority: authority,
    requestProtocol: protocol,
    requestOrigin,
  };
}

export function assertMutationOrigin(request: NextRequest, context: StorefrontContext) {
  const origin = request.headers.get('origin');
  if (!isSameOrigin(origin, context.requestAuthority, context.requestProtocol)) {
    throw new StorefrontError(403, 'same-origin-required', 'Cart and wishlist mutations require a same-origin request.');
  }
}

export function requireCustomer(context: StorefrontContext) {
  if (!context.customer) {
    throw new StorefrontError(401, 'authentication-required', 'Sign in as a Customer to continue.');
  }
  return context.customer;
}

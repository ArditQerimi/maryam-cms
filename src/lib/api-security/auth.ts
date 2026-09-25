// Server-only: session, database, and request-runtime authorization helpers.
import { hasPermission } from '@/lib/permissions';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { getTenantDb } from '@/db/index';
import * as tenantSchema from '@/db/schema-tenant';
import { and, eq } from 'drizzle-orm';
import { apiError } from './http';

export type TenantSessionContext = {
  userId: number;
  companyId: number;
  permissions: string[];
  tenantRole: string | null;
  user: {
    id: number;
    storeId: number | null;
    tenantRoleId: number | null;
    status: string;
  };
  company: {
    id: number;
    subdomain: string;
    status: string;
  };
  db: ReturnType<typeof getTenantDb>;
};

type SessionRecord = Record<string, unknown>;

type AccessOptions = {
  permission?: string;
};

export type AccessFailure = {
  ok: false;
  response: ReturnType<typeof apiError>;
};

export type AccessSuccess = {
  ok: true;
  context: TenantSessionContext;
};

export type AccessResult = AccessFailure | AccessSuccess;

async function readSession() {
  // Keep session-token lazy so the production debug gate can return 404 even
  // when a deployment has not supplied a signing secret yet.
  const { getSession } = await import('@/lib/session');
  return getSession();
}

function readSessionRecord(value: unknown): SessionRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as SessionRecord
    : null;
}

function readPermissions(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((permission): permission is string => typeof permission === 'string' && permission.length > 0)
    : [];
}

function readPositiveInteger(value: unknown): number | null {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

/**
 * Authenticates a tenant request from the signed session and resolves the
 * tenant database from the company id in that session. It deliberately never
 * uses the request host to choose a company.
 */
export async function requireTenantAccess(options: AccessOptions = {}): Promise<AccessResult> {
  let session: SessionRecord | null;
  try {
    session = readSessionRecord(await readSession());
  } catch {
    return { ok: false, response: apiError('Authentication service unavailable', 500) };
  }

  const userId = readPositiveInteger(session?.userId);
  const companyId = readPositiveInteger(session?.companyId);

  if (!session || !userId || !companyId) {
    return { ok: false, response: apiError('Authentication required', 401) };
  }

  if (session.isPlatformUser === true || session.platformRole === 'super_admin') {
    return { ok: false, response: apiError('Tenant access required', 403) };
  }

  const permissions = readPermissions(session.permissions);
  if (options.permission && session.platformRole === 'customer') {
    return { ok: false, response: apiError('Insufficient permissions', 403) };
  }
  if (options.permission && !hasPermission(permissions, options.permission)) {
    return { ok: false, response: apiError('Insufficient permissions', 403) };
  }

  try {
    const company = await masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.id, companyId),
      columns: {
        id: true,
        subdomain: true,
        dbConnectionString: true,
        dbSchema: true,
        status: true,
      },
    });

    if (!company || company.status !== 'Active') {
      return { ok: false, response: apiError('Tenant session is no longer valid', 401) };
    }

    const db = getTenantDb(company.dbConnectionString, company.dbSchema);
    const user = await db.query.users.findFirst({
      where: and(
        eq(tenantSchema.users.id, userId),
        eq(tenantSchema.users.status, 'Active'),
      ),
      columns: {
        id: true,
        storeId: true,
        tenantRoleId: true,
        status: true,
      },
    });

    if (!user) {
      return { ok: false, response: apiError('Tenant session is no longer valid', 401) };
    }

    return {
      ok: true,
      context: {
        userId,
        companyId,
        permissions,
        tenantRole: typeof session.tenantRole === 'string' ? session.tenantRole : null,
        user: {
          id: user.id,
          storeId: user.storeId,
          tenantRoleId: user.tenantRoleId,
          status: user.status,
        },
        company: {
          id: company.id,
          subdomain: company.subdomain,
          status: company.status,
        },
        db,
      },
    };
  } catch {
    return { ok: false, response: apiError('Tenant authorization service unavailable', 500) };
  }
}

export type PlatformSuperAdminResult =
  | { ok: true; session: SessionRecord }
  | { ok: false; response: ReturnType<typeof apiError> };

/**
 * Debug endpoints are deliberately non-production-only. A tenant session,
 * wildcard permission, or a forged-looking role claim is not enough: the
 * session must explicitly identify a platform user and the super-admin role.
 */
export async function requireDevelopmentPlatformSuperAdmin(): Promise<PlatformSuperAdminResult> {
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, response: apiError('Not found', 404) };
  }

  let session: SessionRecord | null;
  try {
    session = readSessionRecord(await readSession());
  } catch {
    return { ok: false, response: apiError('Authentication service unavailable', 500) };
  }

  const userId = readPositiveInteger(session?.userId);
  if (!session || !userId) {
    return { ok: false, response: apiError('Authentication required', 401) };
  }

  if (session.isPlatformUser !== true || session.platformRole !== 'super_admin') {
    return { ok: false, response: apiError('Insufficient permissions', 403) };
  }

  return { ok: true, session };
}

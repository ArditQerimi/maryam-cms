import { cookies } from 'next/headers';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { getContextCompany } from './tenant';
import { getTenantDb } from '@/db/index';
import * as tenantSchema from '@/db/schema-tenant';
import { and, eq } from 'drizzle-orm';
import { decrypt, encrypt } from './session-token';
import { getSessionCookieName } from './session-cookie';
import { getDefaultPermissionsForRole } from './permissions';
import { getCompanyRolePermissionKeys } from './permission-store';
import {
  hasCustomerSessionAudience,
  isActiveCustomerAccount,
  isRoleAllowedForAudience,
  isSessionForCompany,
} from './auth-validation';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type CompanyContext = {
  id: number;
  dbConnectionString: string;
  dbSchema: string;
  name?: string | null;
  status?: string | null;
};

type TenantUserRecord = {
  id: number;
  name: string;
  email: string;
  status: string;
  roleName: string | null;
};

function parsePositiveId(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function assertUsableCompany(company: CompanyContext, requireStatus = false) {
  if (!parsePositiveId(company.id)) {
    throw new Error('A valid company is required to create a session.');
  }
  // Some legacy staff-provisioning callers pass only connection fields after
  // explicitly activating the company. Customer sessions always require the
  // status from their exact master-company record.
  if ((requireStatus || company.status != null) && company.status !== 'Active') {
    throw new Error('The company is not active.');
  }
}

async function readTenantUser(
  userId: string | number,
  company: CompanyContext,
) {
  const normalizedUserId = parsePositiveId(userId);
  if (!normalizedUserId) return null;

  const db = getTenantDb(company.dbConnectionString, company.dbSchema);
  const [user] = await db
    .select({
      id: tenantSchema.users.id,
      name: tenantSchema.users.name,
      email: tenantSchema.users.email,
      status: tenantSchema.users.status,
      roleName: tenantSchema.tenantRoles.name,
    })
    .from(tenantSchema.users)
    .leftJoin(
      tenantSchema.tenantRoles,
      eq(tenantSchema.tenantRoles.id, tenantSchema.users.tenantRoleId)
    )
    .where(eq(tenantSchema.users.id, normalizedUserId))
    .limit(1);

  return (user as TenantUserRecord | undefined) || null;
}

async function resolveTenantPermissions(companyId: number, roleName: string) {
  let permissions = await getCompanyRolePermissionKeys(companyId, roleName);
  if (permissions.length === 0) {
    permissions = getDefaultPermissionsForRole(roleName);
  }
  return permissions;
}

async function setSessionCookie(payload: Record<string, unknown>) {
  const expires = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await encrypt({ ...payload, expires });
  const cookieStore = await cookies();

  cookieStore.set(getSessionCookieName(), token, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });

  return token;
}

export function buildCustomerSessionPayload(
  userId: string | number,
  companyId: string | number,
) {
  const normalizedUserId = parsePositiveId(userId);
  const normalizedCompanyId = parsePositiveId(companyId);
  if (!normalizedUserId || !normalizedCompanyId) {
    throw new Error('Valid user and company IDs are required for a customer session.');
  }

  // Customer PII is intentionally omitted. The customer can be read back from
  // the exact tenant database by the secure session guard when needed.
  return {
    userId: normalizedUserId,
    companyId: normalizedCompanyId,
    platformRole: 'customer',
    tenantRole: 'Customer',
    audience: 'customer' as const,
    permissions: [] as string[],
    isPlatformUser: false,
  };
}

export async function createCustomerSessionForCompany(
  userId: string | number,
  company: CompanyContext,
) {
  assertUsableCompany(company, true);
  const customer = await readTenantUser(userId, company);
  if (!customer || !isActiveCustomerAccount({
    status: customer.status,
    roleName: customer.roleName,
  })) {
    return null;
  }

  return setSessionCookie(buildCustomerSessionPayload(customer.id, company.id));
}

/** Compatibility wrapper for server-side flows that already resolved the request tenant. */
export async function createCustomerSession(userId: string | number) {
  const company = await getContextCompany();
  return createCustomerSessionForCompany(userId, company);
}

export async function createTenantSessionForCompany(
  userId: string | number,
  company: CompanyContext,
) {
  assertUsableCompany(company);
  const user = await readTenantUser(userId, company);
  if (!user || user.status !== 'Active' || !isRoleAllowedForAudience(user.roleName, 'staff')) {
    return null;
  }

  const resolvedTenantRole = user.roleName!.trim();
  const resolvedPermissions = await resolveTenantPermissions(company.id, resolvedTenantRole);

  return setSessionCookie({
    userId: user.id,
    companyId: company.id,
    platformRole: 'admin',
    tenantRole: resolvedTenantRole,
    audience: 'staff' as const,
    permissions: resolvedPermissions,
    // Keep legacy staff payload fields because existing dashboard renderers
    // still use them as database-read fallbacks.
    name: user.name,
    email: user.email,
    isPlatformUser: false,
  });
}

export async function createSession(
  userId: string | number,
  isPlatformUser: boolean = false,
) {
  if (!isPlatformUser) {
    const company = await getContextCompany();
    return createTenantSessionForCompany(userId, company);
  }

  const normalizedUserId = parsePositiveId(userId);
  if (!normalizedUserId) return null;

  const platformUser = await masterDb.query.platformUsers.findFirst({
    where: and(
      eq(masterSchema.platformUsers.id, normalizedUserId),
      eq(masterSchema.platformUsers.status, 'Active')
    ),
  });
  if (!platformUser) return null;

  return setSessionCookie({
    userId: platformUser.id,
    companyId: null,
    platformRole: 'super_admin',
    tenantRole: 'Platform Administrator',
    audience: 'platform' as const,
    permissions: ['*'],
    name: platformUser.name,
    email: platformUser.email,
    isPlatformUser: true,
  });
}

function hasStaffSessionAudience(session: Record<string, unknown>) {
  const audience = session.audience;
  return session.platformRole === 'admin' &&
    session.isPlatformUser !== true &&
    (audience === undefined || audience === 'staff');
}

function hasPlatformSessionAudience(session: Record<string, unknown>) {
  const audience = session.audience;
  return (session.isPlatformUser === true || session.platformRole === 'super_admin') &&
    (audience === undefined || audience === 'platform');
}

async function getCurrentTenantSession() {
  const session = await decrypt((await cookies()).get(getSessionCookieName())?.value);
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;
  const payload = session as Record<string, unknown>;

  if (hasPlatformSessionAudience(payload)) {
    const normalizedUserId = parsePositiveId(payload.userId);
    if (!normalizedUserId) return null;

    const activePlatformUser = await masterDb.query.platformUsers.findFirst({
      where: and(
        eq(masterSchema.platformUsers.id, normalizedUserId),
        eq(masterSchema.platformUsers.status, 'Active')
      ),
    });
    return activePlatformUser ? payload : null;
  }

  const customerAudience = hasCustomerSessionAudience(payload);
  const staffAudience = hasStaffSessionAudience(payload);
  if (!customerAudience && !staffAudience) return null;
  const normalizedUserId = parsePositiveId(payload.userId);
  if (!normalizedUserId) return null;

  let company: Awaited<ReturnType<typeof getContextCompany>>;
  try {
    company = await getContextCompany();
  } catch {
    // Unknown, inactive, or unconfigured hosts are guest contexts for session
    // purposes. Callers must not receive a token bound to another company.
    return null;
  }
  if (!isSessionForCompany(payload, company.id)) return null;

  const user = await readTenantUser(normalizedUserId, company);
  if (!user || user.status !== 'Active') return null;
  if (customerAudience && !isActiveCustomerAccount({
    status: user.status,
    roleName: user.roleName,
  })) return null;
  if (staffAudience && !isRoleAllowedForAudience(user.roleName, 'staff')) return null;

  return payload;
}

/**
 * Secure tenant-aware session read. Signed customer/staff tokens are accepted
 * only for the exact current company and an active user with the matching
 * audience. A mismatched host is therefore downgraded to guest (null).
 */
export async function getSession() {
  return getCurrentTenantSession();
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
}

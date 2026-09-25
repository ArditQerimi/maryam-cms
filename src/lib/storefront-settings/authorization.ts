import 'server-only';

import { and, eq } from 'drizzle-orm';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import * as tenantSchema from '@/db/schema-tenant';
import { getTenantDb } from '@/db/index';
import { getContextCompany } from '@/lib/tenant';
import { getSession } from '@/lib/session';
import { isRoleAllowedForAudience, isSessionForCompany } from '@/lib/auth-validation';
import { hasPermission } from '@/lib/permissions';
import {
  isActiveSettingsStaffRole,
  isSettingsStaffSession,
  parsePositiveSettingsId,
  projectCompanyDisplayStatus,
} from './authorization-contract';
import {
  isMissingSettingsSchemaError,
  StorefrontSettingsError,
} from './errors';
import type { CompanyDisplayStatus } from './contracts';

export type StorefrontSettingsAccess = {
  company: CompanyDisplayStatus;
  db: ReturnType<typeof getTenantDb>;
  userId: number;
  roleName: string;
  permissions: string[];
  canManage: boolean;
};

type RequiredSettingsPermission = 'settings.view' | 'settings.manage';

type CompanyContext = Awaited<ReturnType<typeof getContextCompany>>;

async function resolveCurrentCompany(): Promise<CompanyContext> {
  try {
    const company = await getContextCompany();
    if (
      !company
      || parsePositiveSettingsId(company.id) === null
      || typeof company.subdomain !== 'string'
      || !company.subdomain.trim()
      || company.status !== 'Active'
    ) {
      throw new StorefrontSettingsError('access-denied', 'This storefront tenant is not available.');
    }
    return company;
  } catch (error) {
    if (error instanceof StorefrontSettingsError) throw error;
    throw new StorefrontSettingsError('host-unavailable', 'The current storefront host is not available.');
  }
}

/**
 * Read the current role permission map without calling a materialization helper.
 * A missing permission table is an authorization failure, never a reason to
 * fall back to a token claim or a guessed default role.
 */
async function readCurrentRolePermissions(companyId: number, roleName: string) {
  const normalizedRole = roleName.trim().toLowerCase();
  try {
    const rows = await masterDb
      .select({ key: masterSchema.permissionDefinitions.key })
      .from(masterSchema.companyRolePermissions)
      .innerJoin(
        masterSchema.permissionDefinitions,
        eq(
          masterSchema.companyRolePermissions.permissionId,
          masterSchema.permissionDefinitions.id,
        ),
      )
      .where(and(
        eq(masterSchema.companyRolePermissions.companyId, companyId),
        eq(masterSchema.companyRolePermissions.roleName, normalizedRole),
      ));

    return Array.from(new Set(rows.map((row) => row.key).filter((key): key is string => typeof key === 'string')));
  } catch (error) {
    if (isMissingSettingsSchemaError(error)) {
      throw new StorefrontSettingsError(
        'permissions-unavailable',
        'Current role permissions could not be verified.',
      );
    }
    throw error;
  }
}

export async function requireEcommerceStorefrontSettingsAccess(
  requiredPermission: RequiredSettingsPermission,
): Promise<StorefrontSettingsAccess> {
  // Resolve the company from the current request host before looking at any
  // session claim. The claim is only an equality check, never a tenant picker.
  const company = await resolveCurrentCompany();
  const session = await getSession().catch(() => null);
  if (!isSettingsStaffSession(session, company.id)) {
    throw new StorefrontSettingsError('access-denied', 'An active staff session is required.');
  }

  const payload = session as Record<string, unknown>;
  if (!isSessionForCompany(payload, company.id)) {
    throw new StorefrontSettingsError('access-denied', 'This session is not authorized for the current tenant.');
  }

  const userId = parsePositiveSettingsId(payload.userId);
  if (userId === null) {
    throw new StorefrontSettingsError('access-denied', 'An active staff session is required.');
  }

  const db = getTenantDb(company.dbConnectionString, company.dbSchema);
  const [staff] = await db
    .select({
      id: tenantSchema.users.id,
      status: tenantSchema.users.status,
      tenantRoleId: tenantSchema.users.tenantRoleId,
      roleName: tenantSchema.tenantRoles.name,
    })
    .from(tenantSchema.users)
    .leftJoin(
      tenantSchema.tenantRoles,
      eq(tenantSchema.users.tenantRoleId, tenantSchema.tenantRoles.id),
    )
    .where(and(
      eq(tenantSchema.users.id, userId),
      eq(tenantSchema.users.status, 'Active'),
    ))
    .limit(1);

  if (!staff || !isActiveSettingsStaffRole(staff) || !isRoleAllowedForAudience(staff.roleName, 'staff')) {
    throw new StorefrontSettingsError('access-denied', 'The current staff account is no longer active.');
  }

  const roleName = staff.roleName!.trim();
  const claimedRole = payload.tenantRole;
  if (
    claimedRole !== undefined
    && (typeof claimedRole !== 'string' || claimedRole.trim().toLowerCase() !== roleName.toLowerCase())
  ) {
    throw new StorefrontSettingsError('access-denied', 'The current staff role is no longer valid.');
  }

  const permissions = await readCurrentRolePermissions(company.id, roleName);
  if (!hasPermission(permissions, requiredPermission)) {
    throw new StorefrontSettingsError('access-denied', 'The current role cannot access storefront settings.');
  }

  return {
    company: projectCompanyDisplayStatus(company),
    db,
    userId: staff.id,
    roleName,
    permissions,
    canManage: hasPermission(permissions, 'settings.manage'),
  };
}

export function requireEcommerceStorefrontSettingsViewAccess() {
  return requireEcommerceStorefrontSettingsAccess('settings.view');
}

export function requireEcommerceStorefrontSettingsManageAccess() {
  return requireEcommerceStorefrontSettingsAccess('settings.manage');
}

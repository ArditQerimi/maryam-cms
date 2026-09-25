export const ECOMMERCE_CONTROL_CENTER_PERMISSIONS = [
  'dashboard.view',
  'inventory.view',
  'inventory.manage',
  'stock.manage',
  'sales.view',
  'sales.manage',
  'people.view',
  'promo.view',
  'promo.manage',
  'cms.view',
  'cms.manage',
  'settings.view',
  'settings.manage',
] as const;

export type FreshStaffIdentity = {
  id: number;
  status: string;
  roleId: number | null;
  roleName: string | null;
  storeId: number | null;
  storeStatus: string | null;
};

export type StaffAuthorizationInput = {
  session: unknown;
  currentCompanyId: number;
  freshStaff: FreshStaffIdentity | null;
  freshPermissions: readonly string[];
};

export type StaffAuthorizationFailure =
  | 'invalid-session'
  | 'wrong-audience'
  | 'company-mismatch'
  | 'inactive-staff'
  | 'invalid-role'
  | 'inactive-store'
  | 'no-module-permission';

export type StaffAuthorizationResult =
  | {
      allowed: true;
      userId: number;
      roleName: string;
      scopeKind: 'company' | 'store' | 'unassigned';
    }
  | { allowed: false; reason: StaffAuthorizationFailure };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizedPermissions(value: readonly string[]) {
  return Array.from(new Set(value.filter((permission) => typeof permission === 'string' && permission.trim())));
}

export function hasFreshPermission(permissions: readonly string[], permission: string) {
  return permissions.includes('*') || permissions.includes(permission);
}

export function canUseEcommerceControlCenter(permissions: readonly string[]) {
  const normalized = normalizedPermissions(permissions);
  return normalized.includes('*')
    || ECOMMERCE_CONTROL_CENTER_PERMISSIONS.some((permission) => normalized.includes(permission));
}

/**
 * Authorize from the signed audience plus a fresh tenant user/role lookup. Role
 * and permission claims from the token are deliberately ignored.
 */
export function authorizeFreshStaff(input: StaffAuthorizationInput): StaffAuthorizationResult {
  if (!isRecord(input.session)) return { allowed: false, reason: 'invalid-session' };

  const session = input.session;
  if (
    session.platformRole !== 'admin'
    || session.audience !== 'staff'
    || session.isPlatformUser === true
  ) {
    return { allowed: false, reason: 'wrong-audience' };
  }

  const sessionUserId = positiveInteger(session.userId);
  const sessionCompanyId = positiveInteger(session.companyId);
  const currentCompanyId = positiveInteger(input.currentCompanyId);
  if (!sessionUserId || !sessionCompanyId || !currentCompanyId) {
    return { allowed: false, reason: 'invalid-session' };
  }
  if (sessionCompanyId !== currentCompanyId) {
    return { allowed: false, reason: 'company-mismatch' };
  }

  const staff = input.freshStaff;
  if (!staff || staff.id !== sessionUserId || staff.status !== 'Active') {
    return { allowed: false, reason: 'inactive-staff' };
  }

  const roleId = positiveInteger(staff.roleId);
  const roleName = typeof staff.roleName === 'string' ? staff.roleName.trim() : '';
  if (!roleId || !roleName || roleName.toLocaleLowerCase('en-US') === 'customer') {
    return { allowed: false, reason: 'invalid-role' };
  }

  if (staff.storeId !== null) {
    if (!positiveInteger(staff.storeId) || staff.storeStatus !== 'Active') {
      return { allowed: false, reason: 'inactive-store' };
    }
  }

  const permissions = normalizedPermissions(input.freshPermissions);
  if (!canUseEcommerceControlCenter(permissions)) {
    return { allowed: false, reason: 'no-module-permission' };
  }

  const scopeKind = staff.storeId !== null
    ? 'store'
    : roleName.toLocaleLowerCase('en-US') === 'admin' || permissions.includes('*')
      ? 'company'
      : 'unassigned';

  return {
    allowed: true,
    userId: staff.id,
    roleName,
    scopeKind,
  };
}

import { hasPermission } from '@/lib/permissions';

export function parsePositiveSettingsId(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isSettingsStaffSession(
  value: unknown,
  expectedCompanyId: number,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as Record<string, unknown>;
  const companyId = parsePositiveSettingsId(session.companyId);
  const userId = parsePositiveSettingsId(session.userId);

  return companyId !== null
    && companyId === expectedCompanyId
    && userId !== null
    && session.platformRole === 'admin'
    && (session.isPlatformUser === false || session.isPlatformUser === undefined)
    && session.audience === 'staff'
    && (session.tenantRole === undefined
      || (typeof session.tenantRole === 'string' && session.tenantRole.trim().toLowerCase() !== 'customer'));
}

export function isActiveSettingsStaffRole(
  value: { status?: unknown; tenantRoleId?: unknown; roleName?: unknown } | null | undefined,
) {
  return Boolean(
    value
      && value.status === 'Active'
      && parsePositiveSettingsId(value.tenantRoleId) !== null
      && typeof value.roleName === 'string'
      && value.roleName.trim().length > 0
      && value.roleName.trim().toLowerCase() !== 'customer',
  );
}

export function hasSettingsPermission(
  permissions: readonly string[] | null | undefined,
  permission: 'settings.view' | 'settings.manage',
) {
  return hasPermission([...(permissions || [])], permission);
}

function safeOperationalText(value: unknown, maxCharacters = 255) {
  if (typeof value !== 'string') return '';
  if (/[\u0000-\u001F\u007F-\u009F]/u.test(value)) return '';
  return Array.from(value.normalize('NFC').trim()).slice(0, maxCharacters).join('');
}

export function projectCompanyDisplayStatus(value: {
  name?: unknown;
  subdomain?: unknown;
  status?: unknown;
}) {
  const displayName = safeOperationalText(value.name);
  const subdomain = safeOperationalText(value.subdomain, 63);
  const status = safeOperationalText(value.status, 32);

  return {
    displayName: displayName || 'Unavailable',
    subdomain,
    status: status || 'Unknown',
  };
}

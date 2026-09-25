import { and, eq, inArray } from 'drizzle-orm';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { PERMISSION_GROUPS, sanitizePermissions, type PermissionGroup } from './permissions';

type PermissionCatalogRow = {
  id: number;
  key: string;
  groupKey: string;
  groupLabel: string;
  label: string;
  description: string;
};

function getPermissionCatalogRows() {
  return PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => ({
      key: permission.key,
      groupKey: group.id,
      groupLabel: group.label,
      label: permission.label,
      description: permission.description,
    })),
  );
}

export async function ensurePermissionDefinitions() {
  const tx = masterDb;
  const desired = getPermissionCatalogRows();
  const existing = (await tx.select().from(masterSchema.permissionDefinitions)) as PermissionCatalogRow[];
  const existingByKey = new Map(existing.map((permission) => [permission.key, permission]));

  const missing = desired.filter((permission) => !existingByKey.has(permission.key));
  if (missing.length > 0) {
    const inserted = (await tx.insert(masterSchema.permissionDefinitions).values(missing).returning()) as PermissionCatalogRow[];
    for (const permission of inserted) {
      existingByKey.set(permission.key, permission);
    }
  }

  return Array.from(existingByKey.values());
}

export async function getPermissionDefinitionGroups(): Promise<PermissionGroup[]> {
  const definitions = await ensurePermissionDefinitions();
  const grouped = new Map<string, PermissionGroup>();

  for (const definition of definitions) {
    const currentGroup = grouped.get(definition.groupKey) || {
      id: definition.groupKey,
      label: definition.groupLabel,
      permissions: [],
    };

    currentGroup.permissions.push({
      key: definition.key,
      label: definition.label,
      description: definition.description,
    });

    grouped.set(definition.groupKey, currentGroup);
  }

  return Array.from(grouped.values()).sort((left, right) => left.label.localeCompare(right.label));
}

export async function getPermissionDefinitionKeys(): Promise<string[]> {
  const definitions = await ensurePermissionDefinitions();
  return definitions.map((definition) => definition.key);
}

function normalizeRoleName(roleName: string) {
  return roleName.trim().toLowerCase();
}

function isMissingCompanyRolePermissionsTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = (error as { cause?: { code?: string }; code?: string }).cause?.code || (error as { code?: string }).code;
  if (code === '42P01') return true;

  const message = String((error as { message?: string }).message || '').toLowerCase();
  return message.includes('company_role_permissions') && message.includes('does not exist');
}

export async function syncCompanyRolePermissions(companyId: number, roleName: string, permissions: string[]) {
  const normalizedPermissions = sanitizePermissions(permissions, await getPermissionDefinitionKeys());
  const catalog = await ensurePermissionDefinitions();
  const catalogByKey = new Map(catalog.map((permission: PermissionCatalogRow) => [permission.key, permission]));
  const normalizedRoleName = normalizeRoleName(roleName);
  const targetKeys = normalizedPermissions.includes('*')
    ? catalog.map((permission: PermissionCatalogRow) => permission.key)
    : normalizedPermissions;
  const targetPermissionIds = targetKeys
    .map((key) => catalogByKey.get(key)?.id)
    .filter((id): id is number => typeof id === 'number');

  let existing: {
    companyId: number;
    roleName: string;
    permissionId: number;
  }[] = [];

  try {
    existing = await masterDb
      .select()
      .from(masterSchema.companyRolePermissions)
      .where(
        and(
          eq(masterSchema.companyRolePermissions.companyId, companyId),
          eq(masterSchema.companyRolePermissions.roleName, normalizedRoleName),
        ),
      ) as {
        companyId: number;
        roleName: string;
        permissionId: number;
      }[];
  } catch (error) {
    if (isMissingCompanyRolePermissionsTableError(error)) {
      return;
    }
    throw error;
  }

  const existingIds = new Set(existing.map((row) => row.permissionId));
  const targetIds = new Set(targetPermissionIds);

  const staleIds = existing
    .filter((row) => !targetIds.has(row.permissionId))
    .map((row) => row.permissionId);

  if (staleIds.length > 0) {
    try {
      await masterDb
        .delete(masterSchema.companyRolePermissions)
        .where(
          and(
            eq(masterSchema.companyRolePermissions.companyId, companyId),
            eq(masterSchema.companyRolePermissions.roleName, normalizedRoleName),
            inArray(masterSchema.companyRolePermissions.permissionId, staleIds),
          ),
        );
    } catch (error) {
      if (isMissingCompanyRolePermissionsTableError(error)) {
        return;
      }
      throw error;
    }
  }

  const missingIds = targetPermissionIds.filter((permissionId) => !existingIds.has(permissionId));
  if (missingIds.length > 0) {
    try {
      await masterDb.insert(masterSchema.companyRolePermissions).values(
        missingIds.map((permissionId) => ({
          companyId,
          roleName: normalizedRoleName,
          permissionId,
        })),
      );
    } catch (error) {
      if (isMissingCompanyRolePermissionsTableError(error)) {
        return;
      }
      throw error;
    }
  }
}

export async function getCompanyRolePermissionMap(companyId: number, roleNames: string[]) {
  const normalizedRoleNames = Array.from(new Set(roleNames.map(normalizeRoleName))).filter(Boolean);
  if (normalizedRoleNames.length === 0) {
    return new Map<string, string[]>();
  }

  const definitions = await ensurePermissionDefinitions();
  const keyById = new Map(definitions.map((definition) => [definition.id, definition.key]));

  let rows: { roleName: string; permissionId: number }[] = [];
  try {
    rows = await masterDb
      .select({ roleName: masterSchema.companyRolePermissions.roleName, permissionId: masterSchema.companyRolePermissions.permissionId })
      .from(masterSchema.companyRolePermissions)
      .where(
        and(
          eq(masterSchema.companyRolePermissions.companyId, companyId),
          inArray(masterSchema.companyRolePermissions.roleName, normalizedRoleNames),
        ),
      );
  } catch (error) {
    if (isMissingCompanyRolePermissionsTableError(error)) {
      return new Map<string, string[]>();
    }
    throw error;
  }

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const permissionKey = keyById.get(row.permissionId);
    if (!permissionKey) continue;
    const current = map.get(row.roleName) || [];
    current.push(permissionKey);
    map.set(row.roleName, current);
  }

  return map;
}

export async function getCompanyRolePermissionKeys(companyId: number, roleName: string) {
  const map = await getCompanyRolePermissionMap(companyId, [roleName]);
  return map.get(normalizeRoleName(roleName)) || [];
}

export async function deleteCompanyRolePermissions(companyId: number, roleName: string) {
  try {
    await masterDb
      .delete(masterSchema.companyRolePermissions)
      .where(
        and(
          eq(masterSchema.companyRolePermissions.companyId, companyId),
          eq(masterSchema.companyRolePermissions.roleName, normalizeRoleName(roleName)),
        ),
      );
  } catch (error) {
    if (isMissingCompanyRolePermissionsTableError(error)) {
      return;
    }
    throw error;
  }
}

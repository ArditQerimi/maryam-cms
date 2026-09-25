'use server';

import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { getTenantDb } from '@/db/index';
import { count, eq, sql } from 'drizzle-orm';
import * as tenantSchema from '@/db/schema-tenant';
import { revalidatePath } from 'next/cache';
import { FEATURE_CATALOG } from './feature-catalog';
import { ensureCompanyFeatureCatalog, getCompanyFeatureRows, upsertCompanyFeature } from './company-policy';
import { getCompanyPlanFeatureFlags, isFeatureIncludedInCompanyPlan } from './package-policy';
import { getTenantMediaStorageSettings, upsertTenantMediaStorageSettings } from './tenant-media-storage';
import { migrateAllTenantRoleSchemas, migrateTenantRoleSchemaForCompany } from './tenant-role-migration';

export async function getSuperAdminStats() {
  // This would be restricted to 'super_admin' roles in a real app
  
  const allCompanies = await masterDb.query.companies.findMany({
    with: {
      subscription: {
        with: {
          package: true
        }
      }
    }
  });

  const stats = await Promise.all(allCompanies.map(async (company) => {
    const start = Date.now();
    try {
      const db = getTenantDb(company.dbConnectionString, company.dbSchema);
      
      // Get some live stats from their isolated DB
      // A simple select 1 or count is a great health check
      const [userCount] = await db.select({ value: count() }).from(tenantSchema.users);
      const [saleCount] = await db.select({ value: count() }).from(tenantSchema.sales);

      const latency = Date.now() - start;

      return {
        id: company.id,
        name: company.name,
        subdomain: company.subdomain,
        plan: company.subscription?.package?.name || 'Free',
        userCount: userCount.value,
        saleCount: saleCount.value,
        status: company.status,
        dbStatus: 'Online' as const,
        latency: `${latency}ms`,
      };
    } catch (e) {
      return {
        id: company.id,
        name: company.name,
        subdomain: company.subdomain,
        plan: 'Error',
        userCount: 0,
        saleCount: 0,
        status: 'Offline',
        dbStatus: 'Offline' as const,
        latency: 'N/A',
      };
    }
  }));

  return stats;
}

/**
 * Super Admin: Ping a specific tenant database to verify connectivity
 */
export async function pingTenantDatabase(companyId: number) {
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, companyId)
  });

  if (!company) return { success: false, error: 'Company not found' };

  const start = Date.now();
  try {
    const db = getTenantDb(company.dbConnectionString, company.dbSchema);
    // Simple query to verify connection
    await db.execute(sql.raw('SELECT 1'));
    const latency = Date.now() - start;
    
    return { 
      success: true, 
      latency: `${latency}ms`,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Super Admin: Get all features for a specific tenant
 */
export async function getTenantFeatures(companyId: number) {
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, companyId),
  });

  if (!company) throw new Error('Company not found');

  const rows = await ensureCompanyFeatureCatalog(companyId);
  const planFlags = await getCompanyPlanFeatureFlags(companyId);
  const effectiveRows = rows.map((row) => ({
    ...row,
    enabled: row.enabled || planFlags[row.featureKey] === true,
  }));

  return effectiveRows.sort((left, right) => {
    if (left.featureGroup === right.featureGroup) {
      return left.label.localeCompare(right.label);
    }
    return left.featureGroup.localeCompare(right.featureGroup);
  });
}

export type TenantFeatureRecord = {
  id: number;
  featureGroup: string;
  featureKey: string;
  label: string;
  enabled: boolean;
  updatedAt: Date | null;
};

/**
 * Super Admin: Initialize default features into a tenant's database
 */
export async function initializeTenantFeatures(companyId: number) {
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, companyId),
  });

  if (!company) throw new Error('Company not found');

  const before = await getCompanyFeatureRows(companyId);
  const after = await ensureCompanyFeatureCatalog(companyId);
  const inserted = Math.max(after.length - before.length, 0);

  revalidatePath('/super-admin/features');
  return { inserted };
}

/**
 * Super Admin: Toggle a feature for a specific tenant
 */
export async function toggleTenantFeatureByAdmin(
  companyId: number, 
  group: string, 
  key: string, 
  enabled: boolean
) {
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, companyId)
  });

  if (!company) {
    throw new Error('Company not found');
  }

  if (!enabled) {
    const isPlanIncluded = await isFeatureIncludedInCompanyPlan(companyId, key);
    if (isPlanIncluded) {
      throw new Error('This feature is included in the active package and cannot be disabled.');
    }
  }

  await upsertCompanyFeature(companyId, group, key, enabled);
  revalidatePath('/super-admin/features');
    
  return { success: true };
}

export async function toggleTenantFeatureGroupByAdmin(
  companyId: number,
  group: string,
  enabled: boolean
) {
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, companyId)
  });

  if (!company) {
    throw new Error('Company not found');
  }

  const catalogItems = FEATURE_CATALOG.filter((item) => item.group === group);

  for (const item of catalogItems) {
    await toggleTenantFeatureByAdmin(companyId, item.group, item.key, enabled);
  }

  revalidatePath('/super-admin/features');
  return { success: true, updated: catalogItems.length };
}

export async function resetTenantFeaturesToCatalog(companyId: number) {
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, companyId)
  });

  if (!company) {
    throw new Error('Company not found');
  }

  const planFlags = await getCompanyPlanFeatureFlags(companyId);

  for (const item of FEATURE_CATALOG) {
    const nextEnabled = item.defaultEnabled || planFlags[item.key] === true;
    await upsertCompanyFeature(companyId, item.group, item.key, nextEnabled);
  }

  revalidatePath('/super-admin/features');
  return { success: true, synced: FEATURE_CATALOG.length, existing: FEATURE_CATALOG.length };
}

/**
 * Super Admin: Suspend or reactivate a company
 */
export async function toggleCompanyStatus(
  companyId: number,
  newStatus: 'Active' | 'Suspended'
) {
  await masterDb
    .update(masterSchema.companies)
    .set({ status: newStatus })
    .where(eq(masterSchema.companies.id, companyId));

  revalidatePath('/super-admin/companies');
  return { success: true };
}

export async function migrateAllTenantRolesByAdmin() {
  const results = await migrateAllTenantRoleSchemas();
  revalidatePath('/super-admin/migrations');
  return {
    total: results.length,
    succeeded: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    results,
  };
}

export async function migrateTenantRoleByAdmin(companyId: number) {
  const result = await migrateTenantRoleSchemaForCompany(companyId);
  revalidatePath('/super-admin/migrations');
  return result;
}

export async function getCompanyMediaStorage(companyId: number) {
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, companyId),
  });

  if (!company) {
    throw new Error('Company not found');
  }

  return getTenantMediaStorageSettings(companyId);
}

export async function updateCompanyMediaStorage(params: {
  companyId: number;
  provider: 'local' | 'cloudinary';
  localBasePath?: string | null;
  cloudinaryCloudName?: string | null;
  cloudinaryApiKey?: string | null;
  cloudinaryApiSecret?: string | null;
  cloudinaryFolder?: string | null;
}) {
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, params.companyId),
  });

  if (!company) {
    throw new Error('Company not found');
  }

  await upsertTenantMediaStorageSettings(params);
  revalidatePath('/super-admin/companies');

  return { success: true };
}

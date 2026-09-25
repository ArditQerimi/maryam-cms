import { and, eq, sql } from 'drizzle-orm';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { FEATURE_CATALOG } from './feature-catalog';
import { getCompanyPlanFeatureFlags } from './package-policy';

type FeatureRow = {
  id: number;
  featureGroup: string;
  featureKey: string;
  label: string;
  enabled: boolean;
  updatedAt: Date;
};

function isMissingCompanyFeaturePolicyTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = (error as { cause?: { code?: string }; code?: string }).cause?.code || (error as { code?: string }).code;
  if (code === '42P01') return true;

  const message = String((error as { message?: string }).message || '').toLowerCase();
  return message.includes('company_feature_configurations') && message.includes('does not exist');
}

function isUniqueViolationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = (error as { cause?: { code?: string }; code?: string }).cause?.code || (error as { code?: string }).code;
  return code === '23505';
}

function getDefaultFeatureRows(): FeatureRow[] {
  return FEATURE_CATALOG.map((feature, index) => ({
    id: -(index + 1),
    featureGroup: feature.group,
    featureKey: feature.key,
    label: feature.label,
    enabled: feature.defaultEnabled,
    updatedAt: new Date(0),
  }));
}

async function ensureCompanyFeaturePolicyTable() {
  await masterDb.execute(sql`
    CREATE TABLE IF NOT EXISTS company_feature_configurations (
      id serial PRIMARY KEY,
      company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      feature_group varchar(80) NOT NULL,
      feature_key varchar(80) NOT NULL,
      label varchar(140) NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);

  await masterDb.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS master_feature_cfg_company_group_key_idx
    ON company_feature_configurations(company_id, feature_group, feature_key)
  `);

  await masterDb.execute(sql`
    CREATE INDEX IF NOT EXISTS master_feature_cfg_company_group_idx
    ON company_feature_configurations(company_id, feature_group)
  `);
}

export async function getCompanyFeatureRows(companyId: number): Promise<FeatureRow[]> {
  try {
    const rows = await masterDb
      .select({
        id: masterSchema.companyFeatureConfigurations.id,
        featureGroup: masterSchema.companyFeatureConfigurations.featureGroup,
        featureKey: masterSchema.companyFeatureConfigurations.featureKey,
        label: masterSchema.companyFeatureConfigurations.label,
        enabled: masterSchema.companyFeatureConfigurations.enabled,
        updatedAt: masterSchema.companyFeatureConfigurations.updatedAt,
      })
      .from(masterSchema.companyFeatureConfigurations)
      .where(eq(masterSchema.companyFeatureConfigurations.companyId, companyId));

    return rows;
  } catch (error) {
    if (isMissingCompanyFeaturePolicyTableError(error)) {
      await ensureCompanyFeaturePolicyTable();
      return getCompanyFeatureRows(companyId);
    }
    throw error;
  }
}

export async function ensureCompanyFeatureCatalog(companyId: number) {
  const existing = await getCompanyFeatureRows(companyId);
  if (existing.some((row) => row.id < 0)) {
    return existing;
  }

  const existingKeys = new Set(existing.map((row) => `${row.featureGroup}:${row.featureKey}`));
  const missing = FEATURE_CATALOG.filter((feature) => !existingKeys.has(`${feature.group}:${feature.key}`));

  if (missing.length > 0) {
    try {
      for (const feature of missing) {
        try {
          await masterDb.insert(masterSchema.companyFeatureConfigurations).values({
            companyId,
            featureGroup: feature.group,
            featureKey: feature.key,
            label: feature.label,
            enabled: feature.defaultEnabled,
          });
        } catch (error) {
          if (!isUniqueViolationError(error)) {
            throw error;
          }
        }
      }
    } catch (error) {
      if (isMissingCompanyFeaturePolicyTableError(error)) {
        await ensureCompanyFeaturePolicyTable();
        return getCompanyFeatureRows(companyId);
      }
      throw error;
    }
  }

  return getCompanyFeatureRows(companyId);
}

export async function getCompanyFeatureFlags(companyId: number): Promise<Record<string, boolean>> {
  const rows = await ensureCompanyFeatureCatalog(companyId);
  const planFlags = await getCompanyPlanFeatureFlags(companyId);
  const rowFlags = Object.fromEntries(rows.map((row) => [row.featureKey, row.enabled]));

  const effective: Record<string, boolean> = {};
  for (const feature of FEATURE_CATALOG) {
    const fromPlan = planFlags[feature.key] === true;
    const fromCompany = rowFlags[feature.key] === true;
    effective[feature.key] = fromPlan || fromCompany;
  }

  return effective;
}

export async function upsertCompanyFeature(companyId: number, group: string, key: string, enabled: boolean) {
  try {
    const [existing] = await masterDb
      .select({ id: masterSchema.companyFeatureConfigurations.id })
      .from(masterSchema.companyFeatureConfigurations)
      .where(
        and(
          eq(masterSchema.companyFeatureConfigurations.companyId, companyId),
          eq(masterSchema.companyFeatureConfigurations.featureGroup, group),
          eq(masterSchema.companyFeatureConfigurations.featureKey, key),
        ),
      )
      .limit(1);

    if (existing) {
      await masterDb
        .update(masterSchema.companyFeatureConfigurations)
        .set({ enabled })
        .where(eq(masterSchema.companyFeatureConfigurations.id, existing.id));
      return;
    }

    const catalogItem = FEATURE_CATALOG.find((item) => item.group === group && item.key === key);
    await masterDb.insert(masterSchema.companyFeatureConfigurations).values({
      companyId,
      featureGroup: group,
      featureKey: key,
      label: catalogItem?.label || key,
      enabled,
    });
  } catch (error) {
    if (isMissingCompanyFeaturePolicyTableError(error)) {
      await ensureCompanyFeaturePolicyTable();

      const [existing] = await masterDb
        .select({ id: masterSchema.companyFeatureConfigurations.id })
        .from(masterSchema.companyFeatureConfigurations)
        .where(
          and(
            eq(masterSchema.companyFeatureConfigurations.companyId, companyId),
            eq(masterSchema.companyFeatureConfigurations.featureGroup, group),
            eq(masterSchema.companyFeatureConfigurations.featureKey, key),
          ),
        )
        .limit(1);

      if (existing) {
        await masterDb
          .update(masterSchema.companyFeatureConfigurations)
          .set({ enabled })
          .where(eq(masterSchema.companyFeatureConfigurations.id, existing.id));
        return;
      }

      const catalogItem = FEATURE_CATALOG.find((item) => item.group === group && item.key === key);
      await masterDb.insert(masterSchema.companyFeatureConfigurations).values({
        companyId,
        featureGroup: group,
        featureKey: key,
        label: catalogItem?.label || key,
        enabled,
      });
      return;
    }

    throw error;
  }
}

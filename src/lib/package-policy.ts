import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { FEATURE_CATALOG } from './feature-catalog';

type PackageFeatureRow = {
  featureKey: string;
  enabled: boolean;
};

type PlanPreset = Record<string, boolean>;
export type PlanLabel = 'Starter Plan' | 'Growth Plan' | 'Enterprise Plan';
type PlanTier = 'starter' | 'growth' | 'enterprise';

function isMissingPackageFeatureTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = (error as { cause?: { code?: string }; code?: string }).cause?.code || (error as { code?: string }).code;
  if (code === '42P01') return true;

  const message = String((error as { message?: string }).message || '').toLowerCase();
  return message.includes('package_feature_entitlements') && message.includes('does not exist');
}

function isUniqueViolationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = (error as { cause?: { code?: string }; code?: string }).cause?.code || (error as { code?: string }).code;
  return code === '23505';
}

async function ensurePackageFeatureTable() {
  await masterDb.execute(sql`
    CREATE TABLE IF NOT EXISTS package_feature_entitlements (
      id serial PRIMARY KEY,
      package_id integer NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
      feature_key varchar(80) NOT NULL,
      enabled boolean NOT NULL DEFAULT false,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);

  await masterDb.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS package_feature_entitlements_package_key_idx
    ON package_feature_entitlements(package_id, feature_key)
  `);

  await masterDb.execute(sql`
    CREATE INDEX IF NOT EXISTS package_feature_entitlements_package_idx
    ON package_feature_entitlements(package_id)
  `);
}

function getPackagePresetByName(packageName: string): PlanPreset {
  const normalized = packageName.trim().toLowerCase();

  // Baseline starts from catalog defaults; presets only add plan floors.
  const floors: PlanPreset = {};

  if (normalized.includes('starter') || normalized.includes('basic')) {
    Object.assign(floors, {
      dashboard: true,
      pos_terminal: true,
      products_list: true,
      categories: true,
      brands: true,
      units: true,
      sales_orders: true,
      sales_invoices: true,
      customers: true,
      users: true,
      coupons: true,
      expenses: true,
      reports_section: true,
    });
  }

  if (normalized.includes('growth') || normalized.includes('business')) {
    Object.assign(floors, {
      dashboard_2: true,
      sales_dashboard: true,
      all_sales: true,
      online_sales: true,
      pos_sales: true,
      returns_refunds: true,
      quotations: true,
      gift_cards: true,
      product_discounts: true,
      category_discounts: true,
      money_transfer: true,
      bank_accounts: true,
      account_statement: true,
      trial_balance: true,
      cash_flow: true,
      departments: true,
      designation: true,
      attendance_employee: true,
      attendance_admin: true,
      payroll_employee_salary: true,
      payroll_payslip: true,
      supplier_report: true,
      customer_report: true,
      product_report: true,
      purchase_report: true,
    });
  }

  if (normalized.includes('enterprise') || normalized.includes('premium')) {
    Object.assign(floors, {
      application: true,
      layouts: true,
      stock_section: true,
      purchases_section: true,
      finance_section: true,
      hrm_section: true,
      reports_section: true,
      cms_section: true,
      settings_section: true,
      products_section: true,
      supplier_management: true,
      inventory_reports: true,
      stock_history: true,
      sold_stock: true,
      profit_loss: true,
      annual_report: true,
      blog: true,
      pages: true,
      testimonials: true,
      faq: true,
      countries: true,
      states: true,
      cities: true,
    });
  }

  return floors;
}

function resolvePlanTier(packageName: string): PlanTier {
  const normalized = packageName.trim().toLowerCase();
  if (normalized.includes('enterprise') || normalized.includes('premium')) return 'enterprise';
  if (normalized.includes('growth') || normalized.includes('business')) return 'growth';
  return 'starter';
}

function getPlanDefaultFlags(packageName: string): Record<string, boolean> {
  const tier = resolvePlanTier(packageName);

  const starterFloors = getPackagePresetByName('Starter Plan');
  const growthFloors = getPackagePresetByName('Growth Plan');
  const enterpriseFloors = getPackagePresetByName('Enterprise Plan');

  const allMentioned = new Set([
    ...Object.keys(starterFloors),
    ...Object.keys(growthFloors),
    ...Object.keys(enterpriseFloors)
  ]);

  const baseline: Record<string, boolean> = {};
  for (const feature of FEATURE_CATALOG) {
    if (!allMentioned.has(feature.key)) {
      baseline[feature.key] = feature.defaultEnabled;
    } else {
      baseline[feature.key] = false;
    }
  }

  const applyFloors = (floors: PlanPreset) => {
    for (const [featureKey, enabled] of Object.entries(floors)) {
      if (enabled) baseline[featureKey] = true;
    }
  };

  applyFloors(starterFloors);
  if (tier === 'growth' || tier === 'enterprise') {
    applyFloors(growthFloors);
  }
  if (tier === 'enterprise') {
    applyFloors(enterpriseFloors);
  }

  return baseline;
}

export function getMinimumPlanForFeature(featureKey: string): PlanLabel | null {
  const starterFeatures = getPackagePresetByName('Starter Plan');
  if (starterFeatures[featureKey]) return 'Starter Plan';

  const growthFeatures = getPackagePresetByName('Growth Plan');
  if (growthFeatures[featureKey]) return 'Growth Plan';

  const enterpriseFeatures = getPackagePresetByName('Enterprise Plan');
  if (enterpriseFeatures[featureKey]) return 'Enterprise Plan';

  return null;
}

async function ensurePackageFeatureCatalog(packageId: number): Promise<PackageFeatureRow[]> {
  const pkg = await masterDb.query.packages.findFirst({
    where: eq(masterSchema.packages.id, packageId),
  });

  if (!pkg) {
    return [];
  }

  try {
    const existing = await masterDb
      .select({
        featureKey: masterSchema.packageFeatureEntitlements.featureKey,
        enabled: masterSchema.packageFeatureEntitlements.enabled,
      })
      .from(masterSchema.packageFeatureEntitlements)
      .where(eq(masterSchema.packageFeatureEntitlements.packageId, packageId));

    const existingByKey = new Map(existing.map((row) => [row.featureKey, row.enabled]));
    const planDefaults = getPlanDefaultFlags(pkg.name);

    const missing = FEATURE_CATALOG
      .filter((feature) => !existingByKey.has(feature.key))
      .map((feature) => ({
        packageId,
        featureKey: feature.key,
        enabled: Boolean(planDefaults[feature.key]),
      }));

    if (missing.length > 0) {
      for (const row of missing) {
        try {
          await masterDb.insert(masterSchema.packageFeatureEntitlements).values(row);
        } catch (error) {
          if (!isUniqueViolationError(error)) {
            throw error;
          }
        }
      }
    }

    return await masterDb
      .select({
        featureKey: masterSchema.packageFeatureEntitlements.featureKey,
        enabled: masterSchema.packageFeatureEntitlements.enabled,
      })
      .from(masterSchema.packageFeatureEntitlements)
      .where(eq(masterSchema.packageFeatureEntitlements.packageId, packageId));
  } catch (error) {
    if (isMissingPackageFeatureTableError(error)) {
      await ensurePackageFeatureTable();
      return ensurePackageFeatureCatalog(packageId);
    }
    throw error;
  }
}

export async function getPackageFeatureFlags(packageId: number): Promise<Record<string, boolean>> {
  const pkg = await masterDb.query.packages.findFirst({
    where: eq(masterSchema.packages.id, packageId),
  });

  if (!pkg) {
    return {};
  }

  const strictPlanFlags = getPlanDefaultFlags(pkg.name);
  const rows = await ensurePackageFeatureCatalog(packageId);
  const entitlementsByKey = new Map(rows.map((row) => [row.featureKey, row.enabled]));

  return Object.fromEntries(
    FEATURE_CATALOG.map((feature) => {
      const allowedByPlan = strictPlanFlags[feature.key] === true;
      const notManuallyDisabled = entitlementsByKey.get(feature.key) !== false;
      return [feature.key, allowedByPlan && notManuallyDisabled];
    }),
  );
}

async function resolveActivePackageIdForCompany(companyId: number): Promise<number | null> {
  const [activeSubscription] = await masterDb
    .select({ packageId: masterSchema.subscriptions.packageId })
    .from(masterSchema.subscriptions)
    .where(
      and(
        eq(masterSchema.subscriptions.companyId, companyId),
        eq(masterSchema.subscriptions.status, 'Active'),
        gt(masterSchema.subscriptions.expiryDate, new Date()),
      ),
    )
    .orderBy(desc(masterSchema.subscriptions.expiryDate), desc(masterSchema.subscriptions.createdAt))
    .limit(1);

  if (activeSubscription?.packageId) return activeSubscription.packageId;

  return null;
}

export async function getCompanySubscriptionAccess(companyId: number) {
  const subscription = await masterDb.query.subscriptions.findFirst({
    where: eq(masterSchema.subscriptions.companyId, companyId),
    orderBy: [desc(masterSchema.subscriptions.expiryDate), desc(masterSchema.subscriptions.createdAt)],
    with: {
      package: true,
    },
  });

  if (!subscription) {
    return {
      subscription: null,
      isActive: false,
      isExpired: false,
    };
  }

  const now = new Date();
  const isActive = subscription.status === 'Active' && subscription.expiryDate > now;

  return {
    subscription,
    isActive,
    isExpired: subscription.expiryDate <= now,
  };
}

export async function getCompanyPlanFeatureFlags(companyId: number): Promise<Record<string, boolean>> {
  const packageId = await resolveActivePackageIdForCompany(companyId);
  if (!packageId) {
    return {};
  }

  return getPackageFeatureFlags(packageId);
}

export async function isFeatureIncludedInCompanyPlan(companyId: number, featureKey: string): Promise<boolean> {
  const planFlags = await getCompanyPlanFeatureFlags(companyId);
  return planFlags[featureKey] === true;
}

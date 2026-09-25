import Stripe from 'stripe';
import { and, desc, eq } from 'drizzle-orm';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { ensureCompanyDedicatedDatabase } from './tenant-onboarding';

type CompanyRow = Awaited<ReturnType<typeof masterDb.query.companies.findFirst>>;

type StripeMetadata = Record<string, string | undefined>;

function normalizeSubdomain(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function getStripeMetadata(source: { metadata?: StripeMetadata } | null | undefined) {
  return source?.metadata || {};
}

function parseId(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function mapStripeStatus(status?: string | null): 'Active' | 'Pending' | 'Suspended' | 'Inactive' {
  switch ((status || '').toLowerCase()) {
    case 'active':
    case 'trialing':
      return 'Active';
    case 'past_due':
    case 'unpaid':
      return 'Suspended';
    case 'canceled':
    case 'incomplete_expired':
      return 'Inactive';
    default:
      return 'Pending';
  }
}

async function resolvePackageId(metadata: StripeMetadata, subscription?: Stripe.Subscription | null) {
  const packageId = parseId(metadata.packageId || metadata.planId || metadata.package_id);
  if (packageId) return packageId;

  const packageName = metadata.packageName || metadata.planName || metadata.plan;
  if (packageName) {
    const packageRow = await masterDb.query.packages.findFirst({
      where: eq(masterSchema.packages.name, packageName),
    });
    if (packageRow) return packageRow.id;
  }

  if (subscription?.items?.data?.[0]?.price?.nickname) {
    const packageRow = await masterDb.query.packages.findFirst({
      where: eq(masterSchema.packages.name, subscription.items.data[0].price.nickname),
    });
    if (packageRow) return packageRow.id;
  }

  const starter = await masterDb.query.packages.findFirst({
    where: eq(masterSchema.packages.name, 'Starter Plan'),
  });
  if (starter) return starter.id;

  throw new Error('Unable to resolve a package for the Stripe subscription event.');
}

async function resolveOrCreateCompany(metadata: StripeMetadata) {
  const companyId = parseId(metadata.companyId);
  const email = (metadata.email || metadata.customerEmail || '').trim().toLowerCase();
  const name = (metadata.companyName || metadata.name || '').trim();
  const subdomain = normalizeSubdomain((metadata.subdomain || metadata.companySubdomain || name).trim());

  let company: CompanyRow | undefined;

  if (companyId) {
    company = await masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.id, companyId),
    });
  }

  if (!company && subdomain) {
    company = await masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.subdomain, subdomain),
    });
  }

  if (!company && email) {
    company = await masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.email, email),
    });
  }

  if (!company) {
    if (!email) {
      throw new Error('Stripe metadata must include email or companyId to create a tenant company.');
    }

    if (!name) {
      throw new Error('Stripe metadata must include companyName to create a tenant company.');
    }

    if (!subdomain) {
      throw new Error('Stripe metadata must include subdomain (or a company name that can be normalized).');
    }

    const baseConnectionString = process.env.TENANT_DATABASE_BASE_URL || process.env.TENANT_DATABASE_SERVER_URL || process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL;
    if (!baseConnectionString) {
      throw new Error('Missing tenant database connection string for Stripe provisioning.');
    }

    const [createdCompany] = await masterDb
      .insert(masterSchema.companies)
      .values({
        name,
        email,
        subdomain,
        dbConnectionString: baseConnectionString,
        dbSchema: 'public',
        status: 'Pending',
      })
      .returning();

    company = createdCompany;
  }

  const updates: Partial<typeof masterSchema.companies.$inferInsert> = {};
  if (name && company.name !== name) updates.name = name;
  if (email && company.email !== email) updates.email = email;
  if (subdomain && company.subdomain !== subdomain) updates.subdomain = subdomain;

  if (Object.keys(updates).length > 0) {
    const [updatedCompany] = await masterDb
      .update(masterSchema.companies)
      .set(updates)
      .where(eq(masterSchema.companies.id, company.id))
      .returning();
    company = updatedCompany;
  }

  return company;
}

async function upsertCompanySubscription(companyId: number, packageId: number, status: 'Active' | 'Pending' | 'Suspended' | 'Inactive', periodStart?: number, periodEnd?: number) {
  const existing = await masterDb.query.subscriptions.findFirst({
    where: eq(masterSchema.subscriptions.companyId, companyId),
    orderBy: [desc(masterSchema.subscriptions.createdAt)],
  });

  const startDate = periodStart ? new Date(periodStart * 1000) : new Date();
  const expiryDate = periodEnd ? new Date(periodEnd * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (existing) {
    await masterDb
      .update(masterSchema.subscriptions)
      .set({
        packageId,
        status,
        startDate,
        expiryDate,
      })
      .where(eq(masterSchema.subscriptions.id, existing.id));

    return existing.id;
  }

  const [created] = await masterDb
    .insert(masterSchema.subscriptions)
    .values({
      companyId,
      packageId,
      status,
      startDate,
      expiryDate,
    })
    .returning();

  return created.id;
}

export async function processStripeTenantSubscriptionEvent(params: {
  subscription: Stripe.Subscription;
  customer?: Stripe.Customer | Stripe.DeletedCustomer | null;
}) {
  const runtimeSubscription = params.subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  const subscriptionMetadata = getStripeMetadata(params.subscription);
  const customerMetadata = params.customer && 'metadata' in params.customer ? getStripeMetadata(params.customer) : {};
  const metadata = { ...customerMetadata, ...subscriptionMetadata };

  console.log('[Stripe Billing] Processing subscription event:', {
    subscriptionId: params.subscription.id,
    status: params.subscription.status,
    metadata,
  });

  const company = await resolveOrCreateCompany(metadata);
  console.log('[Stripe Billing] Company resolved/created:', { companyId: company.id, name: company.name });

  await ensureCompanyDedicatedDatabase(company.id);
  console.log('[Stripe Billing] Company database ensured');

  const packageId = await resolvePackageId(metadata, params.subscription);
  const normalizedStatus = mapStripeStatus(params.subscription.status);

  console.log('[Stripe Billing] Resolved package and status:', {
    packageId,
    normalizedStatus,
    stripeStatus: params.subscription.status,
  });

  await upsertCompanySubscription(
    company.id,
    packageId,
    normalizedStatus,
    runtimeSubscription.current_period_start,
    runtimeSubscription.current_period_end,
  );

  console.log('[Stripe Billing] Subscription upserted');

  await masterDb
    .update(masterSchema.companies)
    .set({ status: normalizedStatus })
    .where(eq(masterSchema.companies.id, company.id));

  console.log('[Stripe Billing] Company status updated to:', normalizedStatus);

  return {
    companyId: company.id,
    subdomain: company.subdomain,
    status: normalizedStatus,
    packageId,
  };
}

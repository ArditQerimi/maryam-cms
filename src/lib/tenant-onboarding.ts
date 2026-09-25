import { Client } from 'pg';
import { eq } from 'drizzle-orm';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { provisionTenant } from './tenant-provisioning';

function normalizeSubdomain(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function toSafeDatabaseName(value: string) {
  const normalized = normalizeSubdomain(value) || 'tenant';
  const prefix = process.env.TENANT_DATABASE_PREFIX || 'pos_tenant_';
  return `${prefix}${normalized}`.replace(/[^a-z0-9_]/g, '_').slice(0, 63);
}

function getTenantAdminConnectionString() {
  const source = process.env.TENANT_DATABASE_SERVER_URL || process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL;
  if (!source) {
    throw new Error('Missing TENANT_DATABASE_SERVER_URL (or MASTER_DATABASE_URL/DATABASE_URL) for tenant onboarding.');
  }

  const url = new URL(source);
  url.pathname = '/postgres';
  return url.toString();
}

function buildTenantConnectionString(databaseName: string, baseConnectionString?: string) {
  const source = baseConnectionString || process.env.TENANT_DATABASE_BASE_URL || process.env.TENANT_DATABASE_SERVER_URL || process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL;
  if (!source) {
    throw new Error('Missing tenant database base connection string. Set TENANT_DATABASE_BASE_URL or TENANT_DATABASE_SERVER_URL.');
  }

  const url = new URL(source);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function ensurePhysicalDatabase(databaseName: string) {
  const adminConnectionString = getTenantAdminConnectionString();
  const client = new Client({ connectionString: adminConnectionString });

  try {
    await client.connect();
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } catch (error: any) {
    if (error?.code !== '42P04') {
      throw error;
    }
  } finally {
    await client.end();
  }
}

export async function ensureCompanyDedicatedDatabase(companyId: number) {
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, companyId),
  });

  if (!company) {
    throw new Error('Company not found for provisioning.');
  }

  const databaseName = toSafeDatabaseName(company.subdomain);
  const dbConnectionString = buildTenantConnectionString(databaseName, company.dbConnectionString || undefined);

  await ensurePhysicalDatabase(databaseName);
  await provisionTenant(company.subdomain, dbConnectionString, 'public');

  if (company.dbConnectionString !== dbConnectionString || company.dbSchema !== 'public') {
    await masterDb
      .update(masterSchema.companies)
      .set({
        dbConnectionString,
        dbSchema: 'public',
      })
      .where(eq(masterSchema.companies.id, company.id));
  }

  return {
    companyId: company.id,
    subdomain: company.subdomain,
    dbConnectionString,
    dbSchema: 'public' as const,
    databaseName,
  };
}

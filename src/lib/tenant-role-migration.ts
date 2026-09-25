import { sql } from 'drizzle-orm';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { getTenantDb } from '@/db';
import { eq } from 'drizzle-orm';

export type TenantRoleMigrationResult = {
  companyId: number;
  subdomain: string;
  name: string;
  success: boolean;
  message: string;
};

async function migrateTenantRoleSchema(connectionString: string, schemaName: string | null | undefined) {
  const tenantDb = getTenantDb(connectionString, schemaName || 'public');

  await tenantDb.execute(sql.raw('ALTER TABLE "tenant_roles" DROP CONSTRAINT IF EXISTS "tenant_roles_company_id_companies_id_fk";'));
  await tenantDb.execute(sql.raw('DROP INDEX IF EXISTS "tenant_role_company_idx";'));
  await tenantDb.execute(sql.raw('DROP INDEX IF EXISTS "unique_role_per_company";'));
  await tenantDb.execute(sql.raw('ALTER TABLE "tenant_roles" DROP COLUMN IF EXISTS "company_id";'));
  await tenantDb.execute(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS "unique_role_per_company" ON "tenant_roles" USING btree ("name");'));
}

export async function migrateTenantRoleSchemaForCompany(companyId: number): Promise<TenantRoleMigrationResult> {
  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, companyId),
  });

  if (!company) {
    return {
      companyId,
      subdomain: 'unknown',
      name: 'Unknown Company',
      success: false,
      message: 'Company not found.',
    };
  }

  try {
    await migrateTenantRoleSchema(company.dbConnectionString, company.dbSchema);
    return {
      companyId: company.id,
      subdomain: company.subdomain,
      name: company.name,
      success: true,
      message: 'Migrated tenant_roles successfully.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown migration error.';
    return {
      companyId: company.id,
      subdomain: company.subdomain,
      name: company.name,
      success: false,
      message,
    };
  }
}

export async function migrateAllTenantRoleSchemas(): Promise<TenantRoleMigrationResult[]> {
  const companies = await masterDb.query.companies.findMany({
    orderBy: (company, { asc }) => [asc(company.id)],
  });

  return Promise.all(companies.map((company) => migrateTenantRoleSchemaForCompany(company.id)));
}

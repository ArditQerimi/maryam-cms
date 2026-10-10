import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema-tenant';

// Cache connection pools to avoid re-creating them on every request
const globalForTenantPools = globalThis as unknown as { tenantPools: Record<string, Pool> };
if (!globalForTenantPools.tenantPools) globalForTenantPools.tenantPools = {};
const pools = globalForTenantPools.tenantPools;

/**
 * Standalone mode (no multi-tenancy): when STANDALONE_DATABASE_URL is set, the business's data and
 * the platform tables (companies, plan, permissions) live in that ONE database, so every tenant
 * connection goes there whatever the company row says. Unset = the usual database-per-tenant.
 */
export function standaloneDatabaseUrl() {
  return (process.env.STANDALONE_DATABASE_URL ?? '').trim();
}

export function getTenantDb(connectionString: string, schemaName?: string) {
  const standalone = standaloneDatabaseUrl();
  if (standalone) {
    connectionString = standalone;
    schemaName = undefined;
  }
  let finalConnectionString = connectionString;
  
  if (schemaName && schemaName !== 'public') {
    const url = new URL(connectionString);
    url.searchParams.set('options', `-c search_path=${schemaName},public`);
    finalConnectionString = url.toString();
  }

  if (!pools[finalConnectionString]) {
    pools[finalConnectionString] = new Pool({
      connectionString: finalConnectionString,
      max: 10,
    });
  }

  const pool = pools[finalConnectionString];
  return drizzle(pool, { schema });
}

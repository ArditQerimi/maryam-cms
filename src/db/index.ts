import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema-tenant';

// Cache connection pools to avoid re-creating them on every request
const globalForTenantPools = globalThis as unknown as { tenantPools: Record<string, Pool> };
if (!globalForTenantPools.tenantPools) globalForTenantPools.tenantPools = {};
const pools = globalForTenantPools.tenantPools;

export function getTenantDb(connectionString: string, schemaName?: string) {
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

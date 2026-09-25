import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema-master';
import dotenv from 'dotenv';

dotenv.config();

function deriveDatabaseUrl(baseUrl: string, databaseName: string) {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

const globalForDb = globalThis as unknown as { cachedMasterDb: NodePgDatabase<typeof schema> | null };

function createMasterDb(): NodePgDatabase<typeof schema> {
  const masterConnectionString =
    process.env.MASTER_DATABASE_URL ||
    (process.env.DATABASE_URL ? deriveDatabaseUrl(process.env.DATABASE_URL, 'pos_master') : undefined);

  if (!masterConnectionString) {
    throw new Error('Missing MASTER_DATABASE_URL (or DATABASE_URL) for master database connection.');
  }

  if (process.env.NODE_ENV === 'production' && !process.env.MASTER_DATABASE_URL) {
    console.warn('MASTER_DATABASE_URL is not set in production; falling back to DATABASE_URL.');
  }

  const pool = new Pool({
    connectionString: masterConnectionString,
  });

  return drizzle(pool, { schema });
}

export function getMasterDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.cachedMasterDb) {
    globalForDb.cachedMasterDb = createMasterDb();
  }

  return globalForDb.cachedMasterDb;
}

export const masterDb = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    const db = getMasterDb() as any;
    const value = db[prop];
    return typeof value === 'function' ? value.bind(db) : value;
  },
}) as NodePgDatabase<typeof schema>;

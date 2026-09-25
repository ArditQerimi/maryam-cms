import { getTenantDb } from '@/db/index';
import { sql, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { createTenantCloudinaryFolders } from '@/lib/tenant-media-storage';

const SHARED_TABLES = [
  'companies', 
  'packages', 
  'platform_roles', 
  'subscriptions', 
  'permission_definitions'
];

export async function provisionTenant(subdomain: string, connectionString: string, dbSchema: string = 'public') {
  console.log(`Provisioning tenant: ${subdomain} in schema: ${dbSchema}...`);
  
  const db = getTenantDb(connectionString);

  // 1. Create the schema if not public
  if (dbSchema !== 'public') {
    await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`));
    console.log(`Schema "${dbSchema}" created or already exists.`);
  }

  // 2. Load the full migration SQL history in filename order.
  const migrationDir = path.join(process.cwd(), 'drizzle');
  const migrationFiles = fs
    .readdirSync(migrationDir)
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  const migrationSql = migrationFiles
    .map((file) => fs.readFileSync(path.join(migrationDir, file), 'utf8'))
    .join('\n');

  // Split by statement-breakpoint
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // 3. Execute each statement in the context of the new schema
  const tenantDb = getTenantDb(connectionString, dbSchema);
  
  console.log(`Applying migrations to schema "${dbSchema}"...`);
  
  for (let statement of statements) {
    // Determine if this statement is creating/modifying a shared table
    const isSharedTableOp = SHARED_TABLES.some(table => 
      statement.includes(`CREATE TABLE "${table}"`) || 
      statement.includes(`CREATE TABLE "public"."${table}"`) ||
      statement.includes(`ALTER TABLE "${table}"`) ||
      statement.includes(`ALTER TABLE "public"."${table}"`) ||
      statement.includes(`ON "${table}"`) || // Catch indexes on shared tables
      statement.includes(`ON "public"."${table}"`)
    );

    if (isSharedTableOp) {
      // console.log(`Skipping shared table operation: ${statement.substring(0, 50)}...`);
      continue;
    }

    const normalizedStatement = statement.trimStart();
    let skipStatement = false;

    // Skip legacy company-scoped indexes and ALTER TABLE constraints that only exist
    // because older generated migrations still carried company_id on tenant tables.
    if (
      (normalizedStatement.startsWith('CREATE INDEX') || normalizedStatement.startsWith('CREATE UNIQUE INDEX') || normalizedStatement.startsWith('ALTER TABLE')) &&
      statement.includes('"company_id"')
    ) {
      skipStatement = true;
    }

    // These ALTER TABLE statements point back to shared tables and cannot be replayed
    // inside the tenant database context.
    if (statement.toUpperCase().startsWith('ALTER TABLE')) {
      for (const sharedTable of SHARED_TABLES) {
        if (statement.includes(`REFERENCES "public"."${sharedTable}"`)) {
          skipStatement = true;
          break;
        }
      }
    }

    if (skipStatement) {
      // console.log(`Skipping company-scoped legacy operation: ${statement.substring(0, 100)}...`);
      continue;
    }

    // 2. Clean up table names: remove "public". for tenant-local tables
    // This ensures that tables are always created/referenced in the current schema/database context.
    statement = statement.replace(/"public"\."([^"]+)"/g, (match, tableName) => {
      if (SHARED_TABLES.includes(tableName)) {
        return match; 
      }
      return `"${tableName}"`; // Remove public. for tenant-local tables
    });

    if (normalizedStatement.startsWith('CREATE TABLE') && statement.includes('"company_id"')) {
      statement = statement
        .replace(/^\s*"company_id"\s+[^,\n]+,?\s*$/gm, '')
        .replace(/,\s*"company_id"\s+[^,\n]+/gm, '')
        .replace(/\("company_id"\s*,\s*/g, '(')
        .replace(/,\s*"company_id"\s*/g, ', ')
        .replace(/\s*"company_id"\s*,\s*/g, '')
        .replace(/\s*"company_id"\s*/g, '');
    }

    // Remove foreign key constraints to shared tables
    // Pattern 1: Inline REFERENCES "public"."shared_table"("id") ...
    for (const sharedTable of SHARED_TABLES) {
      const inlineRefRegex = new RegExp(`REFERENCES\\s+"public"\\."${sharedTable}"\\s*\\([^\\)]+\\)[^,;\\n\\)]*`, 'gi');
      statement = statement.replace(inlineRefRegex, '');
      
      // Pattern 2: Standalone CONSTRAINT "..." FOREIGN KEY ("...") REFERENCES "public"."shared_table" ("id") ...
      const constraintRegex = new RegExp(`CONSTRAINT\\s+"[^"]+"\\s+FOREIGN\\s+KEY\\s+\\([^\\)]+\\)\\s+REFERENCES\\s+"public"\\."${sharedTable}"\\s*\\([^\\)]+\\)[^,;\\n\\)]*`, 'gi');
      statement = statement.replace(constraintRegex, '');
    }

    // Clean up: 
    // 1. Remove dangling commas before closing parenthesis (handles multiple spaces/newlines)
    statement = statement.replace(/,\s*\)\s*;?$/g, '\n);');
    // 2. Remove empty lines created by removals
    statement = statement.replace(/^\s*[\r\n]/gm, '');
    // 3. Remove double commas
    statement = statement.replace(/,\s*,/g, ',');
    // 4. Remove commas before the final semicolon if they exist
    statement = statement.replace(/,\s*;/g, ';');
    // 5. Remove any leading commas (if first column/constraint was removed)
    statement = statement.replace(/\(\s*,/g, '(');
    // 6. Final safety: remove ANY comma followed directly by a closing paren
    statement = statement.replace(/,\s*\)/g, ')');

    // Also handle types/enums - usually we want these to be shared in public for efficiency,
    // but if the migration tries to create them and they exist, we skip.
    // My catch block already handles "already exists".

    try {
      // console.log('Executing Provisioning Statement:', statement);
      await tenantDb.execute(sql.raw(statement));
    } catch (e: any) {
      const errorMessage = e.message?.toLowerCase() || '';
      const causeMessage = e.cause?.message?.toLowerCase() || '';
      const pgCode = e.cause?.code || e.code || (e as any).pgCode;

      // 1. Skip if already exists
      if (
        errorMessage.includes('already exists') || 
        causeMessage.includes('already exists') ||
        pgCode === '42710' || // duplicate_object
        pgCode === '42P07'    // duplicate_table
      ) {
        continue;
      }

      // 2. Skip 'undefined table' errors
      // These are usually cross-db foreign keys or indexes referencing platform tables
      if (pgCode === '42P01') {
        console.log(`Skipping missing table reference: ${statement.substring(0, 80)}...`);
        continue;
      }

      console.error(`Error executing statement (Code: ${pgCode}): ${statement.substring(0, 100)}...`);
      throw e;
    }
  }

  console.log(`Tenant ${subdomain} provisioned successfully.`);
  // Attempt to create Cloudinary folders for the tenant (if Cloudinary is configured)
  try {
    const company = await masterDb.query.companies.findFirst({ where: eq(masterSchema.companies.subdomain, subdomain) });
    if (company) {
      await createTenantCloudinaryFolders(company.id);
    }
  } catch (err) {
    console.warn('Failed to create tenant Cloudinary folders:', err);
  }
}

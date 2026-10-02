import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import { config as loadEnv } from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
loadEnv({ path: path.join(root, '.env') });

const storeFrontMigrations = [
  'src/db/storefront-migrations/001_storefront_cart_wishlist.sql',
  'src/db/storefront-migrations/002_blog_cms.sql',
  'src/db/storefront-migrations/003_storefront_checkout.sql',
  'src/db/storefront-migrations/004_contact_messages.sql',
  'src/db/storefront-migrations/005_compare_items.sql',
  'src/db/storefront-migrations/006_product_reviews.sql',
  'src/db/storefront-migrations/007_auth_email_tokens.sql',
  'src/db/storefront-migrations/008_user_type.sql',
  'src/db/storefront-migrations/009_customer_addresses.sql',
  'drizzle/add_cms_tables.sql',
];

function readSql(relative) {
  return readFileSync(path.join(root, relative), 'utf8');
}

async function listTenantUrls() {
  const client = new Client({ connectionString: process.env.MASTER_DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query('select db_connection_string from companies order by id asc');
    return result.rows.map((row) => row.db_connection_string).filter(Boolean);
  } finally {
    await client.end();
  }
}

async function applyTo(url, label) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const file of storeFrontMigrations) {
      const sql = readSql(file);
      try {
        await client.query(sql);
        console.log(`  ok    ${path.basename(file)}`);
      } catch (error) {
        console.log(`  FAIL  ${path.basename(file)}: ${error.message}`);
        throw error;
      }
    }
    console.log(`  done  ${label}`);
  } finally {
    await client.end();
  }
}

async function main() {
  const explicit = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const targets = explicit.length ? explicit : await listTenantUrls();

  if (!targets.length) {
    console.log('No tenant databases found in the master database.');
    return;
  }

  for (const url of targets) {
    const label = url.replace(/\/\/[^@]*@/, '//***@');
    console.log(`Applying migrations to ${label}`);
    await applyTo(url, label);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

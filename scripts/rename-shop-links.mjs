/**
 * One-off data migration for the `/shop` → `/home` storefront route rename.
 *
 * Code paths were rewritten in source, but URLs authored through the CMS live
 * in the database (nav menus, footer links, hero slides, page blocks), so they
 * would 404 until they are rewritten too.
 *
 *   node scripts/rename-shop-links.mjs           # dry run — counts only
 *   node scripts/rename-shop-links.mjs --apply   # perform the rewrite
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import { config as loadEnv } from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
loadEnv({ path: path.join(root, '.env') });

const APPLY = process.argv.includes('--apply');
const FROM = '/shop';
const TO = '/home';

/** Each target: a countable expression and the matching update. */
const TARGETS = [
  {
    label: 'settings_store.value',
    count: `select count(*)::int as n from settings_store where value like '%${FROM}%'`,
    update: `update settings_store set value = replace(value, '${FROM}', '${TO}') where value like '%${FROM}%'`,
  },
  {
    label: 'theme_settings.customizations',
    count: `select count(*)::int as n from theme_settings where customizations::text like '%${FROM}%'`,
    update: `update theme_settings set customizations = replace(customizations::text, '${FROM}', '${TO}')::jsonb where customizations::text like '%${FROM}%'`,
  },
  {
    label: 'cms_pages.blocks',
    count: `select count(*)::int as n from cms_pages where blocks::text like '%${FROM}%'`,
    update: `update cms_pages set blocks = replace(blocks::text, '${FROM}', '${TO}')::jsonb where blocks::text like '%${FROM}%'`,
  },
  {
    label: 'cms_pages.content',
    count: `select count(*)::int as n from cms_pages where content like '%${FROM}%'`,
    update: `update cms_pages set content = replace(content, '${FROM}', '${TO}') where content like '%${FROM}%'`,
  },
];

async function listTenantUrls() {
  const client = new Client({ connectionString: process.env.MASTER_DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      'select name, db_connection_string from companies order by id asc',
    );
    return result.rows.filter((row) => row.db_connection_string);
  } finally {
    await client.end();
  }
}

async function processTenant(row) {
  const client = new Client({ connectionString: row.db_connection_string });
  await client.connect();
  console.log(`\n— ${row.name}`);
  try {
    for (const target of TARGETS) {
      try {
        const { rows } = await client.query(target.count);
        const pending = rows[0]?.n ?? 0;
        if (pending === 0) {
          console.log(`   ${target.label}: nothing to change`);
          continue;
        }
        if (!APPLY) {
          console.log(`   ${target.label}: ${pending} row(s) would change`);
          continue;
        }
        const result = await client.query(target.update);
        console.log(`   ${target.label}: rewrote ${result.rowCount} row(s)`);
      } catch (error) {
        console.log(`   ${target.label}: skipped (${error.message.split('\n')[0]})`);
      }
    }
  } finally {
    await client.end();
  }
}

const tenants = await listTenantUrls();
console.log(
  APPLY
    ? `Rewriting ${FROM} → ${TO} across ${tenants.length} tenant(s).`
    : `Dry run — no changes written. ${tenants.length} tenant(s).`,
);
for (const tenant of tenants) await processTenant(tenant);
console.log(APPLY ? '\nDone.' : '\nRe-run with --apply to write these changes.');

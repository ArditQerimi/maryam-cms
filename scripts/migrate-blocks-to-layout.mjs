/**
 * Lift every stored page-builder document from the flat block list to the
 * layout tree (rows -> columns -> modules).
 *
 * The lift runs through the very same `normalizeBlocks` the app uses at read
 * time, so a migrated document is byte-for-byte what the storefront already
 * renders — and re-running the script is a no-op.
 *
 *   node scripts/migrate-blocks-to-layout.mjs            # migrate everything
 *   node scripts/migrate-blocks-to-layout.mjs --dry-run  # show what would change
 *
 * Originals are saved to `.backups/cms-blocks-<timestamp>.json` first.
 * Only `cms_pages.blocks` is ever written, and only when it changes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { config as loadEnv } from 'dotenv';

import { normalizeBlocks } from '../src/app/cms/builder/blocks.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
loadEnv({ path: path.join(root, '.env') });

const dryRun = process.argv.includes('--dry-run');

/** A document is already migrated when every top-level node is a row. */
function isMigrated(blocks) {
  return Array.isArray(blocks) && blocks.length > 0 && blocks.every((b) => b && b.type === 'row');
}

async function listTenantUrls() {
  const client = new Client({ connectionString: process.env.MASTER_DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      'select id, name, db_connection_string from companies order by id asc',
    );
    return result.rows.filter((row) => row.db_connection_string);
  } finally {
    await client.end();
  }
}

async function migrateTenant(tenant, backup) {
  const client = new Client({ connectionString: tenant.db_connection_string });
  await client.connect();
  try {
    const { rows } = await client.query(
      'select id, title, slug, blocks from cms_pages order by id asc',
    );

    let already = 0;
    let migrated = 0;
    let empty = 0;

    for (const page of rows) {
      const blocks = page.blocks;
      if (!Array.isArray(blocks) || blocks.length === 0) {
        empty += 1;
        continue;
      }
      if (isMigrated(blocks)) {
        already += 1;
        continue;
      }

      const lifted = normalizeBlocks(blocks);
      if (!lifted.length) continue;

      backup.push({ tenant: tenant.name, pageId: page.id, slug: page.slug, before: blocks });

      if (dryRun) {
        console.log(
          `  would lift #${page.id} "${page.title}" (${blocks.length} flat -> ${lifted.length} rows)`,
        );
      } else {
        await client.query('update cms_pages set blocks = $1::jsonb where id = $2', [
          JSON.stringify(lifted),
          page.id,
        ]);
        console.log(
          `  lifted #${page.id} "${page.title}" (${blocks.length} flat -> ${lifted.length} rows)`,
        );
      }
      migrated += 1;
    }

    console.log(
      `  ${tenant.name}: ${rows.length} pages — ${migrated} ${dryRun ? 'to lift' : 'lifted'}, ${already} already rows, ${empty} empty`,
    );
    return migrated;
  } finally {
    await client.end();
  }
}

async function main() {
  if (!process.env.MASTER_DATABASE_URL) {
    console.error('MASTER_DATABASE_URL is missing from .env');
    process.exit(1);
  }

  const tenants = await listTenantUrls();
  if (!tenants.length) {
    console.log('No tenant databases found in the master database.');
    return;
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}Migrating cms_pages.blocks to the layout tree…`);

  const backup = [];
  let total = 0;
  for (const tenant of tenants) {
    total += await migrateTenant(tenant, backup);
  }

  if (backup.length && !dryRun) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(root, '.backups');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `cms-blocks-${stamp}.json`);
    writeFileSync(file, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`Backup of every original document: ${path.relative(root, file)}`);
  }

  console.log(dryRun ? `[dry-run] ${total} documents would change.` : `Done: ${total} documents rewritten.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const migrationPath = resolve(
  __dirname,
  '../../db/storefront-migrations/003_storefront_checkout.sql',
);
const rolloutPath = resolve(
  __dirname,
  '../../db/storefront-migrations/003_storefront_checkout_rollout.md',
);
const checksum = '37f904104e2374d85f71a30d4571c65af976c7470d75db937e16006de33ef3cc';

test('checkout migration is transactional, tenant-local, additive, and checksum-bound', () => {
  const sql = readFileSync(migrationPath, 'utf8');
  const rollout = readFileSync(rolloutPath, 'utf8');
  const normalized = sql.replaceAll(`sha256:${checksum}`, '__MIGRATION_CHECKSUM__');

  assert.equal(createHash('sha256').update(normalized, 'utf8').digest('hex'), checksum);
  assert.match(rollout, new RegExp(`sha256:${checksum}`));
  assert.match(sql, /^-- Authoritative storefront checkout/m);
  assert.match(sql, /\bBEGIN;/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\('storefront:003_checkout:v2'\)\)/);
  assert.match(sql, /\bCOMMIT;\s*$/);
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(sql, /\bUPDATE\s+sales\b/i);
  assert.doesNotMatch(sql, /\bUPDATE\s+storefront_order_details\b/i);
  assert.doesNotMatch(sql, /\b(?:company_id|tenant_id)\b/i);

  for (const object of [
    'customer_user_id',
    'currency',
    'storefront_order_details_currency_check',
    'storefront_order_details',
    'storefront_order_access',
    'storefront_checkout_idempotency',
    'sales_customer_user_online_idx',
  ]) {
    assert.match(sql, new RegExp(object));
  }
});

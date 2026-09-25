import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLOG_CMS_CHECKSUM,
  BLOG_CMS_REQUIREMENTS,
  STOREFRONT_CART_CHECKSUM,
  STOREFRONT_CART_REQUIREMENTS,
  STOREFRONT_CHECKOUT_CHECKSUM,
  STOREFRONT_CHECKOUT_REQUIREMENTS,
  assessReviewedMigration,
  schemaFactsFromArrays,
  type PersistenceRequirement,
} from './readiness';

function factsFor(
  requirements: readonly PersistenceRequirement[],
  ledger: Record<string, string> = {},
) {
  return schemaFactsFromArrays({
    tables: requirements.map((requirement) => requirement.table),
    columns: requirements.flatMap((requirement) => (
      requirement.columns.map((column) => `${requirement.table}.${column}`)
    )),
    ledger,
  });
}

test('missing legacy blog columns are reported unavailable without mutation', () => {
  const facts = schemaFactsFromArrays({
    tables: ['blog_posts'],
    columns: ['blog_posts.id', 'blog_posts.title', 'blog_posts.status', 'blog_posts.published_at'],
  });
  const result = assessReviewedMigration({
    facts,
    requirements: BLOG_CMS_REQUIREMENTS,
    migrationKey: '002_blog_cms',
    expectedChecksum: BLOG_CMS_CHECKSUM,
    readyDetail: 'ready',
  });

  assert.equal(result.status, 'unavailable');
  assert.match(result.detail, /No migration was run automatically/);
});

test('blog schema with a missing or mismatched migration ledger is unverified, not ready', () => {
  const missingLedger = assessReviewedMigration({
    facts: factsFor(BLOG_CMS_REQUIREMENTS),
    requirements: BLOG_CMS_REQUIREMENTS,
    migrationKey: '002_blog_cms',
    expectedChecksum: BLOG_CMS_CHECKSUM,
    readyDetail: 'ready',
  });
  assert.equal(missingLedger.status, 'unverified');

  const mismatch = assessReviewedMigration({
    facts: factsFor(BLOG_CMS_REQUIREMENTS, { '002_blog_cms': 'sha256:wrong' }),
    requirements: BLOG_CMS_REQUIREMENTS,
    migrationKey: '002_blog_cms',
    expectedChecksum: BLOG_CMS_CHECKSUM,
    readyDetail: 'ready',
  });
  assert.equal(mismatch.status, 'unverified');

  const ready = assessReviewedMigration({
    facts: factsFor(BLOG_CMS_REQUIREMENTS, { '002_blog_cms': BLOG_CMS_CHECKSUM }),
    requirements: BLOG_CMS_REQUIREMENTS,
    migrationKey: '002_blog_cms',
    expectedChecksum: BLOG_CMS_CHECKSUM,
    readyDetail: 'ready',
  });
  assert.equal(ready.status, 'ready');
});

test('missing checkout order details are unavailable and never treated as zero orders', () => {
  const incomplete = factsFor(STOREFRONT_CHECKOUT_REQUIREMENTS);
  const missingDetails = schemaFactsFromArrays({
    tables: [...incomplete.tables].filter((table) => table !== 'storefront_order_details'),
    columns: [...incomplete.columns].filter((column) => !column.startsWith('storefront_order_details.')),
    ledger: { '003_storefront_checkout': STOREFRONT_CHECKOUT_CHECKSUM },
  });
  const result = assessReviewedMigration({
    facts: missingDetails,
    requirements: STOREFRONT_CHECKOUT_REQUIREMENTS,
    migrationKey: '003_storefront_checkout',
    expectedChecksum: STOREFRONT_CHECKOUT_CHECKSUM,
    readyDetail: 'ready',
  });

  assert.equal(result.status, 'unavailable');
  assert.match(result.detail, /required tenant table or column is missing/i);
});

test('complete checkout schema remains unverified until its checksum-bound ledger matches', () => {
  const facts = factsFor(STOREFRONT_CHECKOUT_REQUIREMENTS);
  const unverified = assessReviewedMigration({
    facts,
    requirements: STOREFRONT_CHECKOUT_REQUIREMENTS,
    migrationKey: '003_storefront_checkout',
    expectedChecksum: STOREFRONT_CHECKOUT_CHECKSUM,
    readyDetail: 'ready',
  });
  assert.equal(unverified.status, 'unverified');

  const ready = assessReviewedMigration({
    facts: schemaFactsFromArrays({
      tables: [...facts.tables],
      columns: [...facts.columns],
      ledger: { '003_storefront_checkout': STOREFRONT_CHECKOUT_CHECKSUM },
    }),
    requirements: STOREFRONT_CHECKOUT_REQUIREMENTS,
    migrationKey: '003_storefront_checkout',
    expectedChecksum: STOREFRONT_CHECKOUT_CHECKSUM,
    readyDetail: 'ready',
  });
  assert.equal(ready.status, 'ready');
});

test('reviewed cart rollout uses its own checksum and key', () => {
  const result = assessReviewedMigration({
    facts: factsFor(STOREFRONT_CART_REQUIREMENTS, {
      '001_storefront_cart_wishlist': STOREFRONT_CART_CHECKSUM,
    }),
    requirements: STOREFRONT_CART_REQUIREMENTS,
    migrationKey: '001_storefront_cart_wishlist',
    expectedChecksum: STOREFRONT_CART_CHECKSUM,
    readyDetail: 'ready',
  });
  assert.equal(result.status, 'ready');
});

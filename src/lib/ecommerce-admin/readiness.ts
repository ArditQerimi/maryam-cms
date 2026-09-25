export type PersistenceRequirement = {
  table: string;
  columns: readonly string[];
};

export type SchemaFacts = {
  tables: ReadonlySet<string>;
  columns: ReadonlySet<string>;
  ledger: ReadonlyMap<string, string>;
};

export type PersistenceAssessment =
  | { status: 'ready'; detail: string }
  | { status: 'unavailable'; detail: string }
  | { status: 'unverified'; detail: string };

export const STOREFRONT_CART_CHECKSUM =
  'sha256:ea31dc178040a5eb80dc521670b9bf93910537e0d0eb8adbe71c79f4236f5c76';
export const BLOG_CMS_CHECKSUM =
  'sha256:fa8cd683b2c15714aa6eba65a0dc530fcad8b7251e00302a3fbbe3546f4de796';
export const STOREFRONT_CHECKOUT_CHECKSUM =
  'sha256:37f904104e2374d85f71a30d4571c65af976c7470d75db937e16006de33ef3cc';

export const CATALOG_REQUIREMENTS: readonly PersistenceRequirement[] = [
  { table: 'products', columns: ['id', 'status', 'stock_quantity', 'store_id'] },
  { table: 'product_variants', columns: ['id', 'product_id', 'status'] },
];

export const VARIANT_STOCK_REQUIREMENTS: readonly PersistenceRequirement[] = [
  { table: 'product_stocks', columns: ['variant_id', 'quantity'] },
];

export const SALE_ORDER_REQUIREMENTS: readonly PersistenceRequirement[] = [
  {
    table: 'sales',
    columns: ['id', 'reference', 'grand_total', 'status', 'is_online', 'created_at'],
  },
  { table: 'sale_items', columns: ['id', 'sale_id', 'variant_id', 'quantity'] },
];

export const STOREFRONT_CART_REQUIREMENTS: readonly PersistenceRequirement[] = [
  { table: 'carts', columns: ['id', 'user_id'] },
  { table: 'cart_items', columns: ['id', 'cart_id', 'product_id', 'variant_id', 'quantity'] },
  { table: 'wishlist_items', columns: ['user_id', 'product_id'] },
  { table: 'storefront_migration_ledger', columns: ['migration_key', 'checksum'] },
];

export const STOREFRONT_CHECKOUT_REQUIREMENTS: readonly PersistenceRequirement[] = [
  ...SALE_ORDER_REQUIREMENTS,
  { table: 'sales', columns: ['customer_user_id'] },
  { table: 'storefront_order_details', columns: ['sale_id', 'currency'] },
  { table: 'storefront_order_access', columns: ['sale_id'] },
  { table: 'storefront_checkout_idempotency', columns: ['scope_hash', 'idempotency_key_hash'] },
  { table: 'storefront_migration_ledger', columns: ['migration_key', 'checksum'] },
];

export const STOREFRONT_REVENUE_REQUIREMENTS: readonly PersistenceRequirement[] = [
  {
    table: 'sales',
    columns: ['id', 'grand_total', 'status', 'is_online'],
  },
  { table: 'storefront_order_details', columns: ['sale_id', 'currency'] },
];

export const BLOG_CMS_REQUIREMENTS: readonly PersistenceRequirement[] = [
  {
    table: 'blog_posts',
    columns: [
      'id',
      'title',
      'status',
      'published_at',
      'excerpt',
      'cover_image_url',
      'updated_at',
    ],
  },
];

export const CUSTOMER_REQUIREMENTS: readonly PersistenceRequirement[] = [
  { table: 'customers', columns: ['id'] },
];

export const MARKETING_REQUIREMENTS: readonly PersistenceRequirement[] = [
  { table: 'coupons', columns: ['id'] },
  { table: 'gift_cards', columns: ['id'] },
  { table: 'product_discounts', columns: ['id', 'product_id'] },
  { table: 'category_discounts', columns: ['id', 'category_id'] },
];

export const CONTENT_REQUIREMENTS: readonly PersistenceRequirement[] = [
  ...BLOG_CMS_REQUIREMENTS,
  { table: 'cms_pages', columns: ['id'] },
  { table: 'cms_faqs', columns: ['id'] },
];

export const WEBSITE_SETTINGS_REQUIREMENTS: readonly PersistenceRequirement[] = [
  { table: 'settings_store', columns: ['id', 'key', 'updated_at'] },
];

export function schemaHasRequirements(facts: SchemaFacts | null, requirements: readonly PersistenceRequirement[]) {
  if (!facts) return false;
  return requirements.every((requirement) => (
    facts.tables.has(requirement.table)
    && requirement.columns.every((column) => facts.columns.has(`${requirement.table}.${column}`))
  ));
}

export function missingRequirementCount(
  facts: SchemaFacts | null,
  requirements: readonly PersistenceRequirement[],
) {
  if (!facts) return requirements.length;
  let missing = 0;
  for (const requirement of requirements) {
    if (!facts.tables.has(requirement.table)) {
      missing += 1;
      continue;
    }
    missing += requirement.columns.filter((column) => !facts.columns.has(`${requirement.table}.${column}`)).length;
  }
  return missing;
}

export function assessReviewedMigration(input: {
  facts: SchemaFacts | null;
  requirements: readonly PersistenceRequirement[];
  migrationKey: string;
  expectedChecksum: string;
  readyDetail: string;
}): PersistenceAssessment {
  if (!input.facts) {
    return { status: 'unverified', detail: 'Tenant schema state could not be verified.' };
  }

  if (!schemaHasRequirements(input.facts, input.requirements)) {
    return {
      status: 'unavailable',
      detail: 'A required tenant table or column is missing. No migration was run automatically.',
    };
  }

  const recordedChecksum = input.facts.ledger.get(input.migrationKey);
  if (recordedChecksum !== input.expectedChecksum) {
    return {
      status: 'unverified',
      detail: 'Required schema is present, but the reviewed tenant migration ledger is missing or does not match.',
    };
  }

  return { status: 'ready', detail: input.readyDetail };
}

export function schemaFactsFromArrays(input: {
  tables: readonly string[];
  columns: readonly string[];
  ledger?: Readonly<Record<string, string>>;
}): SchemaFacts {
  return {
    tables: new Set(input.tables),
    columns: new Set(input.columns),
    ledger: new Map(Object.entries(input.ledger || {})),
  };
}

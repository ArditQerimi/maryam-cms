-- Storefront cart/wishlist persistence: additive tenant-local migration.
-- REVIEWED TEXT ONLY: do not run automatically from application startup.
-- Apply this file once to each tenant database (or tenant search_path), never
-- to the master database. It contains no tenant discriminator and no
-- destructive DDL.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('storefront:001_cart_wishlist:v1'));

CREATE TABLE IF NOT EXISTS storefront_migration_ledger (
  migration_key varchar(160) PRIMARY KEY,
  checksum varchar(128) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY,
  user_id integer,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id serial PRIMARY KEY,
  cart_id uuid NOT NULL,
  product_id integer NOT NULL,
  variant_id integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  user_id integer NOT NULL,
  product_id integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- Column guards cover a pre-existing empty table with the same logical name;
-- no existing values are rewritten or deleted.
ALTER TABLE carts ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS user_id integer;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
ALTER TABLE carts ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS id serial;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS cart_id uuid;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS product_id integer;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS variant_id integer;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS user_id integer;
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS product_id integer;
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

-- These IF NOT EXISTS forms make a retry safe when the ledger insert was not
-- reached (for example, a connection ended after DDL committed).
CREATE UNIQUE INDEX IF NOT EXISTS carts_user_unique ON carts (user_id);
CREATE INDEX IF NOT EXISTS carts_updated_at_idx ON carts (updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_variant_unique
  ON cart_items (cart_id, variant_id);
CREATE INDEX IF NOT EXISTS cart_items_cart_idx ON cart_items (cart_id);
CREATE INDEX IF NOT EXISTS cart_items_variant_idx ON cart_items (variant_id);
CREATE INDEX IF NOT EXISTS cart_items_product_idx ON cart_items (product_id);
CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_user_product_unique
  ON wishlist_items (user_id, product_id);
CREATE INDEX IF NOT EXISTS wishlist_items_user_idx ON wishlist_items (user_id);
CREATE INDEX IF NOT EXISTS wishlist_items_product_idx ON wishlist_items (product_id);
CREATE INDEX IF NOT EXISTS storefront_migration_ledger_applied_at_idx
  ON storefront_migration_ledger (applied_at);

-- Add checks only when a previous partial rollout did not already create them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'carts_user_id_positive_check' AND conrelid = 'carts'::regclass
  ) THEN
    ALTER TABLE carts
      ADD CONSTRAINT carts_user_id_positive_check
      CHECK (user_id IS NULL OR user_id > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_quantity_check' AND conrelid = 'cart_items'::regclass
  ) THEN
    ALTER TABLE cart_items
      ADD CONSTRAINT cart_items_quantity_check
      CHECK (quantity >= 1 AND quantity <= 99);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wishlist_items_user_id_positive_check' AND conrelid = 'wishlist_items'::regclass
  ) THEN
    ALTER TABLE wishlist_items
      ADD CONSTRAINT wishlist_items_user_id_positive_check
      CHECK (user_id > 0);
  END IF;
END;
$$;

-- Foreign keys are additive and are added only when their named constraint is
-- absent. Existing data must be reviewed before applying this file.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'carts_user_id_fkey' AND conrelid = 'carts'::regclass
  ) THEN
    ALTER TABLE carts
      ADD CONSTRAINT carts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_cart_id_fkey' AND conrelid = 'cart_items'::regclass
  ) THEN
    ALTER TABLE cart_items
      ADD CONSTRAINT cart_items_cart_id_fkey
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_product_id_fkey' AND conrelid = 'cart_items'::regclass
  ) THEN
    ALTER TABLE cart_items
      ADD CONSTRAINT cart_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_variant_id_fkey' AND conrelid = 'cart_items'::regclass
  ) THEN
    ALTER TABLE cart_items
      ADD CONSTRAINT cart_items_variant_id_fkey
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wishlist_items_user_id_fkey' AND conrelid = 'wishlist_items'::regclass
  ) THEN
    ALTER TABLE wishlist_items
      ADD CONSTRAINT wishlist_items_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wishlist_items_product_id_fkey' AND conrelid = 'wishlist_items'::regclass
  ) THEN
    ALTER TABLE wishlist_items
      ADD CONSTRAINT wishlist_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Catalog prerequisite for the variant-required cart API. This runs before
-- the ledger row below, inside the same transaction. The table lock makes the
-- "no variants" check stable against concurrent catalog inserts; the unique
-- SKU plus ON CONFLICT makes retries/races harmless.
LOCK TABLE products, product_variants IN SHARE ROW EXCLUSIVE MODE;

-- Fail before writing if a deterministic BASE-<productId> SKU is already
-- owned by a different product that otherwise has no variant. Never rename,
-- overwrite, or delete an existing catalog row to resolve a collision.
DO $$
DECLARE
  conflicting_base_skus integer;
BEGIN
  SELECT count(*)
    INTO conflicting_base_skus
  FROM products AS p
  JOIN product_variants AS conflicting
    ON conflicting.sku = 'BASE-' || p.id::text
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_variants AS existing
    WHERE existing.product_id = p.id
  )
    AND conflicting.product_id <> p.id;

  IF conflicting_base_skus > 0 THEN
    RAISE EXCEPTION
      'storefront default-variant preflight found % conflicting BASE SKU(s)',
      conflicting_base_skus;
  END IF;
END;
$$;

-- Every product without any variant receives one active deterministic default.
-- Product price is copied; a legacy NULL price becomes 0.00 so the existing
-- NOT NULL variant-price constraint is respected. No product_stocks rows are
-- synthesized: those rows are variant/warehouse-specific. The storefront
-- resolver uses products.stock_quantity only when no rows exist for the
-- selected variant.
INSERT INTO product_variants (
  product_id,
  name,
  sku,
  price,
  status,
  created_at,
  updated_at
)
SELECT
  p.id,
  'Default',
  'BASE-' || p.id::text,
  COALESCE(p.price, 0::numeric),
  'Active',
  now(),
  now()
FROM products AS p
WHERE NOT EXISTS (
  SELECT 1
  FROM product_variants AS existing
  WHERE existing.product_id = p.id
)
ON CONFLICT (sku) DO NOTHING;

-- Do not mark the migration complete if a product still has no variant (for
-- example, because a manually managed SKU collision was detected).
DO $$
DECLARE
  products_without_variants integer;
BEGIN
  SELECT count(*)
    INTO products_without_variants
  FROM products AS p
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_variants AS existing
    WHERE existing.product_id = p.id
  );

  IF products_without_variants > 0 THEN
    RAISE EXCEPTION
      'storefront default-variant backfill incomplete for % product(s)',
      products_without_variants;
  END IF;
END;
$$;

-- The ledger is written last, inside the same transaction as the DDL and
-- catalog prerequisite. The checksum identifies this reviewed logical schema
-- version. A mismatch is an operational stop, never an automatic overwrite.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storefront_migration_ledger
    WHERE migration_key = '001_storefront_cart_wishlist'
      AND checksum <> 'sha256:ea31dc178040a5eb80dc521670b9bf93910537e0d0eb8adbe71c79f4236f5c76'
  ) THEN
    RAISE EXCEPTION 'storefront migration checksum mismatch';
  END IF;
END;
$$;

INSERT INTO storefront_migration_ledger (migration_key, checksum)
VALUES ('001_storefront_cart_wishlist', 'sha256:ea31dc178040a5eb80dc521670b9bf93910537e0d0eb8adbe71c79f4236f5c76')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;

-- Storefront compare-list increment 005.
-- REVIEWED TEXT ONLY: apply manually once per tenant database/search path.
-- Never run from application startup and never apply to the master database.
-- This migration is additive, tenant-local, and contains no tenant discriminator.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('storefront:005_compare:v1'));

CREATE TABLE IF NOT EXISTS storefront_migration_ledger (
  migration_key varchar(160) PRIMARY KEY,
  checksum varchar(128) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now()
);

-- Read-only preconditions: users and products must exist so both foreign
-- keys are real tenant references (no guessed identities).
DO $$
BEGIN
  IF to_regclass('users') IS NULL OR to_regclass('products') IS NULL THEN
    RAISE EXCEPTION
      'storefront compare migration 005 missing required tenant users/products tables';
  END IF;
END;
$$;

-- Signed-in shoppers' comparison lists. Mirrors wishlist_items: the exact
-- tenant user id is the ownership boundary; guests keep their browser-local
-- session list (no guest rows, no cookies in the database).
CREATE TABLE IF NOT EXISTS compare_items (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id),
  CONSTRAINT compare_items_user_positive CHECK (user_id > 0),
  CONSTRAINT compare_items_product_positive CHECK (product_id > 0)
);

CREATE INDEX IF NOT EXISTS compare_items_user_created_idx
  ON compare_items (user_id, created_at);

-- Postcondition: the table exists.
DO $$
BEGIN
  IF to_regclass('compare_items') IS NULL THEN
    RAISE EXCEPTION 'storefront compare migration 005 compare_items postcondition failed';
  END IF;
END;
$$;

-- Logical checksum: SHA-256 of this reviewed SQL with the two checksum values
-- below represented by the literal f9fbb36611543e940ee19e2aa44f7b844f92167a68e56993bfcb4a97ab408297.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storefront_migration_ledger
    WHERE migration_key = '005_compare_items'
      AND checksum <> 'f9fbb36611543e940ee19e2aa44f7b844f92167a68e56993bfcb4a97ab408297'
  ) THEN
    RAISE EXCEPTION 'storefront compare migration 005 checksum mismatch';
  END IF;
END;
$$;

INSERT INTO storefront_migration_ledger (migration_key, checksum)
VALUES ('005_compare_items', 'f9fbb36611543e940ee19e2aa44f7b844f92167a68e56993bfcb4a97ab408297')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;

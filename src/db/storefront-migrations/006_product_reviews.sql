-- Storefront product reviews increment 006.
-- REVIEWED TEXT ONLY: apply manually once per tenant database/search path.
-- Never run from application startup and never apply to the master database.
-- This migration is additive, tenant-local, and contains no tenant discriminator.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('storefront:006_product_reviews:v1'));

CREATE TABLE IF NOT EXISTS storefront_migration_ledger (
  migration_key varchar(160) PRIMARY KEY,
  checksum varchar(128) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now()
);

-- Read-only preconditions: users and products must exist so both foreign
-- keys reference real tenant rows (no guessed identities).
DO $$
BEGIN
  IF to_regclass('users') IS NULL OR to_regclass('products') IS NULL THEN
    RAISE EXCEPTION
      'storefront product reviews migration 006 missing required tenant users/products tables';
  END IF;
END;
$$;

-- Public product reviews written by signed-in shoppers. One row per
-- (product, customer): re-submitting replaces that customer's own review
-- instead of stacking duplicates. status defaults to 'approved' because
-- submissions publish immediately for signed-in customers; the column stays
-- so a moderation queue can be introduced later without another migration.
-- author_name is denormalised so the display name survives the user row
-- being removed (user_id becomes NULL through ON DELETE SET NULL).
CREATE TABLE IF NOT EXISTS product_reviews (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  author_name varchar(120) NOT NULL,
  rating integer NOT NULL,
  body text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'approved',
  verified_purchase boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT product_reviews_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT product_reviews_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT product_reviews_body_length_check
    CHECK (char_length(btrim(body)) >= 10),
  CONSTRAINT product_reviews_user_positive
    CHECK (user_id IS NULL OR user_id > 0)
);

-- PostgreSQL treats NULL user_id entries as distinct, so any future guest
-- rows will not collide; signed-in customers always write a concrete
-- user_id, which makes re-submission an in-place replacement of one row.
CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_product_user_idx
  ON product_reviews (product_id, user_id);

CREATE INDEX IF NOT EXISTS product_reviews_product_status_idx
  ON product_reviews (product_id, status, created_at DESC);

-- Postcondition: the table exists.
DO $$
BEGIN
  IF to_regclass('product_reviews') IS NULL THEN
    RAISE EXCEPTION 'storefront product reviews migration 006 postcondition failed';
  END IF;
END;
$$;

-- Logical checksum: SHA-256 of this reviewed SQL with the two embedded
-- checksum values below represented by the literal placeholder <<CHECKSUM>>.
-- Recompute after any edit by replacing both embedded literals with
-- <<CHECKSUM>> and hashing the resulting file bytes as UTF-8.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storefront_migration_ledger
    WHERE migration_key = '006_product_reviews'
      AND checksum <> 'd8525d59e5084f65fdeb7a642e750bee955aaa5b7ab81b1297d56f330ca6e943'
  ) THEN
    RAISE EXCEPTION 'storefront product reviews migration 006 checksum mismatch';
  END IF;
END;
$$;

INSERT INTO storefront_migration_ledger (migration_key, checksum)
VALUES ('006_product_reviews', 'd8525d59e5084f65fdeb7a642e750bee955aaa5b7ab81b1297d56f330ca6e943')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;

-- Storefront saved addresses increment 009.
-- REVIEWED TEXT ONLY: apply manually once per tenant database/search path.
-- Never run from application startup and never apply to the master database.
-- This migration is additive and tenant-local.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('storefront:009_customer_addresses:v1'));

DO $$
BEGIN
  IF to_regclass('users') IS NULL THEN
    RAISE EXCEPTION 'storefront migration 009 missing required tenant users table';
  END IF;
END;
$$;

-- One billing and one shipping address per signed-in shopper; the exact
-- tenant user id is the ownership boundary.
CREATE TABLE IF NOT EXISTS customer_addresses (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(16) NOT NULL,
  address jsonb NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind),
  CONSTRAINT customer_addresses_kind_check CHECK (kind IN ('billing', 'shipping')),
  CONSTRAINT customer_addresses_object_check CHECK (jsonb_typeof(address) = 'object')
);

DO $$
BEGIN
  IF to_regclass('customer_addresses') IS NULL THEN
    RAISE EXCEPTION 'storefront migration 009 customer_addresses postcondition failed';
  END IF;
END;
$$;

COMMIT;

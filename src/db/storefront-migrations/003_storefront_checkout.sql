-- Authoritative storefront checkout increment 003.
-- REVIEWED TEXT ONLY: apply manually once per tenant database/search path.
-- Never run from application startup and never apply to the master database.
-- This migration is additive, tenant-local, and contains no tenant discriminator.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('storefront:003_checkout:v2'));

CREATE TABLE IF NOT EXISTS storefront_migration_ledger (
  migration_key varchar(160) PRIMARY KEY,
  checksum varchar(128) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now()
);

-- Read-only preconditions. The migration deliberately stops instead of
-- repairing, coercing, deleting, or attributing legacy customer/order data.
DO $$
BEGIN
  IF to_regclass('users') IS NULL
    OR to_regclass('products') IS NULL
    OR to_regclass('product_variants') IS NULL
    OR to_regclass('product_stocks') IS NULL
    OR to_regclass('sales') IS NULL
    OR to_regclass('sale_items') IS NULL THEN
    RAISE EXCEPTION
      'storefront checkout migration 003 missing a required tenant catalog/sales table';
  END IF;

  IF EXISTS (
    SELECT 1 FROM products WHERE stock_quantity < 0
  ) THEN
    RAISE EXCEPTION
      'storefront checkout migration 003 found negative parent product stock';
  END IF;

  IF EXISTS (
    SELECT 1 FROM product_stocks WHERE quantity < 0
  ) THEN
    RAISE EXCEPTION
      'storefront checkout migration 003 found negative variant stock';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM sale_items
    WHERE quantity <= 0 OR unit_price < 0 OR subtotal < 0
  ) THEN
    RAISE EXCEPTION
      'storefront checkout migration 003 found invalid legacy sale item money/quantity';
  END IF;
END;
$$;

-- CRM customer_id and POS operator user_id are intentionally untouched.
-- Existing sales remain NULL here; no legacy owner is guessed or backfilled.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_user_id integer;

CREATE TABLE IF NOT EXISTS storefront_order_details (
  sale_id integer PRIMARY KEY,
  currency varchar(3) NOT NULL,
  contact_email varchar(254) NOT NULL,
  contact_phone varchar(32),
  marketing_opt_in boolean NOT NULL DEFAULT false,
  shipping_address jsonb NOT NULL,
  billing_address jsonb NOT NULL,
  billing_same_as_shipping boolean NOT NULL DEFAULT false,
  delivery_method_id varchar(50) NOT NULL,
  payment_method_id varchar(50) NOT NULL,
  terms_accepted_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT storefront_order_details_currency_check CHECK (
    currency IN ('EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD')
  ),
  CONSTRAINT storefront_order_addresses_object_check CHECK (
    jsonb_typeof(shipping_address) = 'object'
    AND jsonb_typeof(billing_address) = 'object'
  )
);

-- Safe only for a not-yet-applied 003. If a manually pre-existing details table
-- has rows, stop rather than guessing/backfilling historical currency.
ALTER TABLE storefront_order_details ADD COLUMN IF NOT EXISTS currency varchar(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storefront_order_details
    WHERE currency IS NULL
       OR currency NOT IN ('EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD')
  ) THEN
    RAISE EXCEPTION
      'storefront checkout migration 003 found missing or unsupported order currency';
  END IF;
END;
$$;

ALTER TABLE storefront_order_details ALTER COLUMN currency SET NOT NULL;

CREATE TABLE IF NOT EXISTS storefront_order_access (
  access_id uuid PRIMARY KEY,
  sale_id integer NOT NULL,
  token_hash varchar(64) NOT NULL,
  expires_at timestamp NOT NULL,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT storefront_order_access_sale_unique UNIQUE (sale_id),
  CONSTRAINT storefront_order_access_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT storefront_order_access_token_hash_check CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT storefront_order_access_expiry_check CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS storefront_checkout_idempotency (
  scope_kind varchar(16) NOT NULL,
  scope_hash varchar(64) NOT NULL,
  idempotency_key_hash varchar(64) NOT NULL,
  request_hash varchar(64) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'processing',
  sale_id integer,
  response_payload jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp,
  PRIMARY KEY (scope_hash, idempotency_key_hash),
  CONSTRAINT storefront_checkout_idempotency_sale_unique UNIQUE (sale_id),
  CONSTRAINT storefront_checkout_idempotency_scope_kind_check CHECK (
    scope_kind IN ('customer', 'guest')
  ),
  CONSTRAINT storefront_checkout_idempotency_status_check CHECK (
    status IN ('processing', 'completed')
  ),
  CONSTRAINT storefront_checkout_idempotency_hash_checks CHECK (
    scope_hash ~ '^[0-9a-f]{64}$'
    AND idempotency_key_hash ~ '^[0-9a-f]{64}$'
    AND request_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT storefront_checkout_idempotency_completion_check CHECK (
    (
      status = 'processing'
      AND sale_id IS NULL
      AND response_payload IS NULL
      AND completed_at IS NULL
    )
    OR (
      status = 'completed'
      AND sale_id IS NOT NULL
      AND jsonb_typeof(response_payload) = 'object'
      AND completed_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS sales_customer_user_online_idx
  ON sales (is_online, customer_user_id, created_at);
CREATE INDEX IF NOT EXISTS storefront_order_details_created_at_idx
  ON storefront_order_details (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS storefront_order_access_sale_unique
  ON storefront_order_access (sale_id);
CREATE UNIQUE INDEX IF NOT EXISTS storefront_order_access_token_hash_unique
  ON storefront_order_access (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS storefront_checkout_idempotency_sale_unique
  ON storefront_checkout_idempotency (sale_id);
CREATE INDEX IF NOT EXISTS storefront_order_access_expires_at_idx
  ON storefront_order_access (expires_at);
CREATE INDEX IF NOT EXISTS storefront_checkout_idempotency_created_at_idx
  ON storefront_checkout_idempotency (created_at);

-- Named constraints make a reviewed retry/partial pre-existing table safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_customer_user_id_fkey'
      AND conrelid = 'sales'::regclass
  ) THEN
    ALTER TABLE sales
      ADD CONSTRAINT sales_customer_user_id_fkey
      FOREIGN KEY (customer_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_customer_user_id_positive_check'
      AND conrelid = 'sales'::regclass
  ) THEN
    ALTER TABLE sales
      ADD CONSTRAINT sales_customer_user_id_positive_check
      CHECK (customer_user_id IS NULL OR customer_user_id > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_items_quantity_positive_check'
      AND conrelid = 'sale_items'::regclass
  ) THEN
    ALTER TABLE sale_items
      ADD CONSTRAINT sale_items_quantity_positive_check
      CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_items_money_nonnegative_check'
      AND conrelid = 'sale_items'::regclass
  ) THEN
    ALTER TABLE sale_items
      ADD CONSTRAINT sale_items_money_nonnegative_check
      CHECK (unit_price >= 0 AND subtotal >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_stock_quantity_nonnegative_check'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_stock_quantity_nonnegative_check
      CHECK (stock_quantity IS NULL OR stock_quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_stocks_quantity_nonnegative_check'
      AND conrelid = 'product_stocks'::regclass
  ) THEN
    ALTER TABLE product_stocks
      ADD CONSTRAINT product_stocks_quantity_nonnegative_check
      CHECK (quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_order_details_currency_check'
      AND conrelid = 'storefront_order_details'::regclass
  ) THEN
    ALTER TABLE storefront_order_details
      ADD CONSTRAINT storefront_order_details_currency_check
      CHECK (currency IN ('EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_order_addresses_object_check'
      AND conrelid = 'storefront_order_details'::regclass
  ) THEN
    ALTER TABLE storefront_order_details
      ADD CONSTRAINT storefront_order_addresses_object_check
      CHECK (
        jsonb_typeof(shipping_address) = 'object'
        AND jsonb_typeof(billing_address) = 'object'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_order_access_token_hash_check'
      AND conrelid = 'storefront_order_access'::regclass
  ) THEN
    ALTER TABLE storefront_order_access
      ADD CONSTRAINT storefront_order_access_token_hash_check
      CHECK (token_hash ~ '^[0-9a-f]{64}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_order_access_expiry_check'
      AND conrelid = 'storefront_order_access'::regclass
  ) THEN
    ALTER TABLE storefront_order_access
      ADD CONSTRAINT storefront_order_access_expiry_check
      CHECK (expires_at > created_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_checkout_idempotency_scope_kind_check'
      AND conrelid = 'storefront_checkout_idempotency'::regclass
  ) THEN
    ALTER TABLE storefront_checkout_idempotency
      ADD CONSTRAINT storefront_checkout_idempotency_scope_kind_check
      CHECK (scope_kind IN ('customer', 'guest'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_checkout_idempotency_status_check'
      AND conrelid = 'storefront_checkout_idempotency'::regclass
  ) THEN
    ALTER TABLE storefront_checkout_idempotency
      ADD CONSTRAINT storefront_checkout_idempotency_status_check
      CHECK (status IN ('processing', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_checkout_idempotency_hash_checks'
      AND conrelid = 'storefront_checkout_idempotency'::regclass
  ) THEN
    ALTER TABLE storefront_checkout_idempotency
      ADD CONSTRAINT storefront_checkout_idempotency_hash_checks
      CHECK (
        scope_hash ~ '^[0-9a-f]{64}$'
        AND idempotency_key_hash ~ '^[0-9a-f]{64}$'
        AND request_hash ~ '^[0-9a-f]{64}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_checkout_idempotency_completion_check'
      AND conrelid = 'storefront_checkout_idempotency'::regclass
  ) THEN
    ALTER TABLE storefront_checkout_idempotency
      ADD CONSTRAINT storefront_checkout_idempotency_completion_check
      CHECK (
        (
          status = 'processing'
          AND sale_id IS NULL
          AND response_payload IS NULL
          AND completed_at IS NULL
        )
        OR (
          status = 'completed'
          AND sale_id IS NOT NULL
          AND jsonb_typeof(response_payload) = 'object'
          AND completed_at IS NOT NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_order_details_sale_fkey'
      AND conrelid = 'storefront_order_details'::regclass
  ) THEN
    ALTER TABLE storefront_order_details
      ADD CONSTRAINT storefront_order_details_sale_fkey
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_order_access_sale_fkey'
      AND conrelid = 'storefront_order_access'::regclass
  ) THEN
    ALTER TABLE storefront_order_access
      ADD CONSTRAINT storefront_order_access_sale_fkey
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_checkout_idempotency_sale_fkey'
      AND conrelid = 'storefront_checkout_idempotency'::regclass
  ) THEN
    ALTER TABLE storefront_checkout_idempotency
      ADD CONSTRAINT storefront_checkout_idempotency_sale_fkey
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
  END IF;
END;
$$;

COMMENT ON COLUMN sales.customer_user_id IS
  'Dedicated authenticated storefront purchaser; CRM customer_id and POS user_id are not ownership.';
COMMENT ON COLUMN storefront_order_details.currency IS
  'Persisted reviewed ISO 4217 checkout currency; never inferred from the browser.';
COMMENT ON TABLE storefront_order_details IS
  'Tenant-local validated storefront contact, address, capability selections, and terms acceptance.';
COMMENT ON TABLE storefront_order_access IS
  'Guest order capabilities; only a SHA-256 token digest is persisted.';
COMMENT ON TABLE storefront_checkout_idempotency IS
  'Tenant-local checkout key/result binding scoped to an exact Customer or opaque guest cart.';

-- Postconditions fail before the ledger is marked complete.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sales'
      AND column_name = 'customer_user_id'
      AND data_type = 'integer'
  ) THEN
    RAISE EXCEPTION 'storefront checkout migration 003 customer_user_id postcondition failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'storefront_order_details'
      AND column_name = 'currency'
      AND data_type = 'character varying'
      AND character_maximum_length = 3
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'storefront checkout migration 003 order currency postcondition failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storefront_order_details_currency_check'
      AND conrelid = 'storefront_order_details'::regclass
  ) THEN
    RAISE EXCEPTION 'storefront checkout migration 003 currency constraint postcondition failed';
  END IF;

  IF to_regclass('storefront_order_details') IS NULL
    OR to_regclass('storefront_order_access') IS NULL
    OR to_regclass('storefront_checkout_idempotency') IS NULL THEN
    RAISE EXCEPTION 'storefront checkout migration 003 table postcondition failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM storefront_order_details
    WHERE currency IS NULL
       OR currency NOT IN ('EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD')
  ) THEN
    RAISE EXCEPTION 'storefront checkout migration 003 persisted currency postcondition failed';
  END IF;

  IF EXISTS (SELECT 1 FROM products WHERE stock_quantity < 0)
    OR EXISTS (SELECT 1 FROM product_stocks WHERE quantity < 0) THEN
    RAISE EXCEPTION 'storefront checkout migration 003 stock postcondition failed';
  END IF;

  IF EXISTS (SELECT 1 FROM sales WHERE customer_user_id <= 0) THEN
    RAISE EXCEPTION 'storefront checkout migration 003 ownership postcondition failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_customer_user_id_fkey'
      AND conrelid = 'sales'::regclass
  ) THEN
    RAISE EXCEPTION 'storefront checkout migration 003 purchaser FK postcondition failed';
  END IF;
END;
$$;

-- Logical checksum: SHA-256 of this reviewed SQL with the two checksum values
-- below represented by the literal __MIGRATION_CHECKSUM__.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storefront_migration_ledger
    WHERE migration_key = '003_storefront_checkout'
      AND checksum <> 'sha256:37f904104e2374d85f71a30d4571c65af976c7470d75db937e16006de33ef3cc'
  ) THEN
    RAISE EXCEPTION 'storefront checkout migration 003 checksum mismatch';
  END IF;
END;
$$;

INSERT INTO storefront_migration_ledger (migration_key, checksum)
VALUES ('003_storefront_checkout', 'sha256:37f904104e2374d85f71a30d4571c65af976c7470d75db937e16006de33ef3cc')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;

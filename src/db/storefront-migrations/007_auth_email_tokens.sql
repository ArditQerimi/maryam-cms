-- Storefront auth email tokens increment 007.
-- REVIEWED TEXT ONLY: apply manually once per tenant database/search path.
-- Never run from application startup and never apply to the master database.
-- This migration is additive, tenant-local, and contains no tenant discriminator.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('storefront:007_auth_email_tokens:v1'));

CREATE TABLE IF NOT EXISTS storefront_migration_ledger (
  migration_key varchar(160) PRIMARY KEY,
  checksum varchar(128) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now()
);

-- Read-only precondition: users must exist (the foreign key targets it).
DO $$
BEGIN
  IF to_regclass('users') IS NULL THEN
    RAISE EXCEPTION
      'storefront auth email tokens migration 007 missing required tenant users table';
  END IF;
END;
$$;

-- Single-use, short-lived tokens for password resets and email confirmations.
-- Only the SHA-256 digest of a token is stored, so a database leak cannot be
-- replayed against the storefront. Rows are consumed (used_at) on first use
-- and older unconsumed rows for the same user/purpose are superseded when a
-- new token is issued.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose varchar(32) NOT NULL,
  token_hash varchar(64) NOT NULL,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_tokens_purpose_check
    CHECK (purpose IN ('password_reset', 'email_verification')),
  CONSTRAINT password_reset_tokens_hash_format_check
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT password_reset_tokens_user_positive
    CHECK (user_id > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_hash_idx
  ON password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_purpose_idx
  ON password_reset_tokens (user_id, purpose, created_at DESC);

-- Email confirmation state on the customer record. Nullable on purpose: the
-- existing customer base starts out unverified and login stays open — the
-- column only records when (or whether) a customer confirmed their address.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp;

-- Postconditions: the table and the new column both exist.
DO $$
BEGIN
  IF to_regclass('password_reset_tokens') IS NULL THEN
    RAISE EXCEPTION 'storefront auth email tokens migration 007 postcondition failed (table)';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_verified_at'
  ) THEN
    RAISE EXCEPTION 'storefront auth email tokens migration 007 postcondition failed (column)';
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
    WHERE migration_key = '007_auth_email_tokens'
      AND checksum <> 'a96b47c28cf7405ce4ee0dcc90303da45a2d2199174cf05178773b497364cbe3'
  ) THEN
    RAISE EXCEPTION 'storefront auth email tokens migration 007 checksum mismatch';
  END IF;
END;
$$;

INSERT INTO storefront_migration_ledger (migration_key, checksum)
VALUES ('007_auth_email_tokens', 'a96b47c28cf7405ce4ee0dcc90303da45a2d2199174cf05178773b497364cbe3')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;

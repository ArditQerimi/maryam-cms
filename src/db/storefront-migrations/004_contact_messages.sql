-- Storefront contact-form increment 004.
-- REVIEWED TEXT ONLY: apply manually once per tenant database/search path.
-- Never run from application startup and never apply to the master database.
-- This migration is additive, tenant-local, and contains no tenant discriminator.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('storefront:004_contact:v1'));

CREATE TABLE IF NOT EXISTS storefront_migration_ledger (
  migration_key varchar(160) PRIMARY KEY,
  checksum varchar(128) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now()
);

-- Read-only precondition: the tenant must own the users table so an optional
-- signed-in submitter can be linked without guessing any identity.
DO $$
BEGIN
  IF to_regclass('users') IS NULL THEN
    RAISE EXCEPTION
      'storefront contact migration 004 missing the required users table';
  END IF;
END;
$$;

-- Public contact-form submissions. No raw IP is stored: ip_hash keeps a
-- SHA-256 digest for abuse throttling only. read_at is the merchant inbox
-- acknowledgement marker.
CREATE TABLE IF NOT EXISTS contact_messages (
  id serial PRIMARY KEY,
  name varchar(160) NOT NULL,
  email varchar(254) NOT NULL,
  subject varchar(200) NOT NULL,
  message text NOT NULL,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  ip_hash varchar(64),
  read_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT contact_messages_name_length
    CHECK (char_length(name) BETWEEN 2 AND 160),
  CONSTRAINT contact_messages_email_length
    CHECK (char_length(email) BETWEEN 5 AND 254),
  CONSTRAINT contact_messages_email_format
    CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT contact_messages_subject_length
    CHECK (char_length(subject) BETWEEN 2 AND 200),
  CONSTRAINT contact_messages_message_length
    CHECK (char_length(message) BETWEEN 5 AND 5000),
  CONSTRAINT contact_messages_ip_hash_format
    CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT contact_messages_read_after_create
    CHECK (read_at IS NULL OR read_at >= created_at)
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
  ON contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_unread_idx
  ON contact_messages (read_at, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS contact_messages_ip_hash_idx
  ON contact_messages (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

-- Postcondition: the table exists with the expected columns.
DO $$
BEGIN
  IF to_regclass('contact_messages') IS NULL THEN
    RAISE EXCEPTION 'storefront contact migration 004 contact_messages postcondition failed';
  END IF;
END;
$$;

-- Logical checksum: SHA-256 of this reviewed SQL with the two checksum values
-- below represented by the literal 61e5f0402b33dd4e29575ed9f42b86422562f00a96e3c0be7d5cbcaaab579afa.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storefront_migration_ledger
    WHERE migration_key = '004_contact_messages'
      AND checksum <> '61e5f0402b33dd4e29575ed9f42b86422562f00a96e3c0be7d5cbcaaab579afa'
  ) THEN
    RAISE EXCEPTION 'storefront contact migration 004 checksum mismatch';
  END IF;
END;
$$;

INSERT INTO storefront_migration_ledger (migration_key, checksum)
VALUES ('004_contact_messages', '61e5f0402b33dd4e29575ed9f42b86422562f00a96e3c0be7d5cbcaaab579afa')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;

-- Storefront account type increment 008.
-- REVIEWED TEXT ONLY: apply manually once per tenant database/search path.
-- Never run from application startup and never apply to the master database.
-- This migration is additive, tenant-local, and contains no tenant discriminator.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('storefront:008_user_type:v1'));

CREATE TABLE IF NOT EXISTS storefront_migration_ledger (
  migration_key varchar(160) PRIMARY KEY,
  checksum varchar(128) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now()
);

-- Read-only preconditions: users and tenant_roles must exist so the
-- backfill below joins real tenant rows (no guessed identities).
DO $$
BEGIN
  IF to_regclass('users') IS NULL OR to_regclass('tenant_roles') IS NULL THEN
    RAISE EXCEPTION
      'storefront account type migration 008 missing required tenant users/tenant_roles tables';
  END IF;
END;
$$;

-- users.user_type distinguishes e-commerce (storefront) accounts from the
-- ERP/staff accounts that manage the CMS. Existing rows default to 'erp' and
-- are backfilled below from the Customer role, so the distinction is explicit
-- and queryable instead of being inferred from role names at read time.
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type varchar(16) NOT NULL DEFAULT 'erp';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_user_type_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_user_type_check CHECK (user_type IN ('storefront', 'erp'));
  END IF;
END;
$$;

-- Backfill: anyone holding the storefront Customer role is an e-commerce
-- account; everything else (staff, managers, admins) stays ERP.
UPDATE users u
SET user_type = 'storefront'
FROM tenant_roles r
WHERE u.tenant_role_id = r.id
  AND lower(r.name) = 'customer'
  AND u.user_type <> 'storefront';

-- Postconditions: the column and its check constraint both exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'user_type'
  ) THEN
    RAISE EXCEPTION 'storefront account type migration 008 postcondition failed (column)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_user_type_check'
  ) THEN
    RAISE EXCEPTION 'storefront account type migration 008 postcondition failed (constraint)';
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
    WHERE migration_key = '008_user_type'
      AND checksum <> 'a2090c7a92ff7f6d3f7c6d16fffb336d3911b0f4ee5a35a7477779008f057e78'
  ) THEN
    RAISE EXCEPTION 'storefront account type migration 008 checksum mismatch';
  END IF;
END;
$$;

INSERT INTO storefront_migration_ledger (migration_key, checksum)
VALUES ('008_user_type', 'a2090c7a92ff7f6d3f7c6d16fffb336d3911b0f4ee5a35a7477779008f057e78')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;

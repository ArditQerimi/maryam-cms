-- Storefront blog CMS additive increment.
-- REVIEWED TEXT ONLY: do not run automatically from application startup.
-- Apply once to each tenant database (or tenant search_path), never to the
-- master database. This increment adds no company discriminator and performs
-- no destructive DDL.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('storefront:002_blog_cms:v1'));

CREATE TABLE IF NOT EXISTS storefront_migration_ledger (
  migration_key varchar(160) PRIMARY KEY,
  checksum varchar(128) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now()
);

-- These are additive column guards. A retry after a partial/manual rollout is
-- safe, and no existing post values are removed.
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS excerpt varchar(320);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS updated_at timestamp;

-- Build a short, plain-text summary for legacy rows. HTML is used only as text
-- here and is stripped rather than exposed as trusted markup.
UPDATE blog_posts
SET excerpt = left(
  trim(regexp_replace(coalesce(content, ''), '<[^>]+>', ' ', 'g')),
  320
)
WHERE excerpt IS NULL
  AND trim(coalesce(content, '')) <> '';

UPDATE blog_posts
SET excerpt = ''
WHERE excerpt IS NULL;

UPDATE blog_posts
SET updated_at = coalesce(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE blog_posts ALTER COLUMN excerpt SET DEFAULT '';
ALTER TABLE blog_posts ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE blog_posts ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS blog_posts_updated_at_idx
  ON blog_posts (updated_at);

COMMENT ON COLUMN blog_posts.excerpt IS
  'Plain-text storefront summary, bounded to 320 characters by the application.';
COMMENT ON COLUMN blog_posts.cover_image_url IS
  'Validated root-relative path or HTTP(S) image URL; application controlled.';
COMMENT ON COLUMN blog_posts.updated_at IS
  'Timestamp updated by blog CMS writes.';

-- The checksum identifies this reviewed logical schema version. A mismatch is
-- an operational stop, never an automatic overwrite.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storefront_migration_ledger
    WHERE migration_key = '002_blog_cms'
      AND checksum <> 'sha256:fa8cd683b2c15714aa6eba65a0dc530fcad8b7251e00302a3fbbe3546f4de796'
  ) THEN
    RAISE EXCEPTION 'storefront migration checksum mismatch';
  END IF;
END;
$$;

INSERT INTO storefront_migration_ledger (migration_key, checksum)
VALUES (
  '002_blog_cms',
  'sha256:fa8cd683b2c15714aa6eba65a0dc530fcad8b7251e00302a3fbbe3546f4de796'
)
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;

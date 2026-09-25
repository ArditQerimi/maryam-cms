# Blog CMS increment 002 rollout

**Status:** review-only additive increment. This migration was not executed by
application startup and must not be run with `db:push`, `db:migrate`, seed,
reset, or bootstrap as part of this change.

## Added contract

`002_blog_cms.sql` targets each tenant database (or the tenant `search_path`),
not the master database. It adds only these `blog_posts` columns:

- `excerpt varchar(320)` — plain-text storefront summary;
- `cover_image_url text` — application-validated root-relative or HTTP(S) URL;
- `updated_at timestamp NOT NULL DEFAULT now()` — CMS update timestamp.

It also adds the non-unique `blog_posts_updated_at_idx` index and the
`002_blog_cms` row in the tenant-local `storefront_migration_ledger`. Legacy
posts receive a stripped, bounded plain-text excerpt and an `updated_at` value
equal to `created_at`. No post, tag, category, comment, or tenant discriminator
is deleted or rewritten beyond those additive backfills.

Logical migration checksum:

```text
sha256:fa8cd683b2c15714aa6eba65a0dc530fcad8b7251e00302a3fbbe3546f4de796
```

## Application contract

The CMS writes only through the tenant database resolved from the current
staff session's exact host. It maps the editorial **Draft / Published** choice
to the existing tenant `status` enum as **Inactive / Active**. A draft is
therefore excluded by the storefront's existing public-post filter, while a
published post uses a current-or-past publish date and is revalidated at both
`/shop/blogs` and `/shop/blogs/[slug]` after each successful mutation.

The blog admin requires an active, non-customer staff account and a current
`cms.view` permission to read; add, edit, publish, and delete additionally
require `cms.manage`. Current role permissions are resolved from the existing
master permission map; client role IDs, permission arrays, tenant IDs, and
company IDs are not accepted as mutation authority.

## Review and rollout steps

1. Read `002_blog_cms.sql` as text and confirm the target is one tenant
   database/search path. Confirm `blog_posts` and the tenant migration ledger
   from increment 001 already exist. Do not substitute the master database.
2. Take a tenant backup and record counts for `blog_posts`, `blog_post_tags`,
   `blog_tags`, and `blog_categories`. Confirm the existing unique index
   `blog_post_company_slug_idx` is present despite its legacy name; the table is
   tenant-local and no company discriminator is required.
3. Have a database reviewer apply the SQL manually in a controlled migration
   window. Its transaction, advisory lock, `IF NOT EXISTS` guards, and ledger
   conflict check permit a safe retry. Stop on a checksum mismatch.
4. Verify on a non-production tenant that the three columns and update index
   exist, `updated_at` is non-null for every row, existing post counts are
   unchanged, and the ledger contains the expected checksum.
5. Deploy the application only after the reviewed SQL is present on each target
   tenant. The admin list intentionally fails visibly rather than silently
   degrading if rollout order is reversed.
6. Smoke-test with a staff account: create a draft and confirm it is absent
   from `/shop/blogs`; publish it and confirm it appears in the list and detail
   page; edit its slug and confirm both the new detail route and storefront
   cache refresh; unpublish and confirm immediate removal; then test typed-title
   deletion and tenant/category/tag linking.
7. Keep customer data intact during rollback. If application rollback is needed,
   disable write access first; do not drop the added columns as an automatic
   rollback step.

## Reviewer checklist

- [ ] Target is a tenant database/search path, not master.
- [ ] Backup/count snapshot exists.
- [ ] Existing `blog_posts` rows and public slugs remain intact.
- [ ] Only the three documented columns/index and ledger row are added.
- [ ] Drafts do not become public and published posts revalidate immediately.
- [ ] Application rollout follows the SQL rollout on every target tenant.

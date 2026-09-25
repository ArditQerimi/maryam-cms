# Storefront cart and wishlist rollout

**Status:** review-only additive increment. The SQL in this directory is not
executed by application startup and must not be run with `db:push`,
`db:migrate`, seed, reset, or bootstrap commands as part of this change.

## Contracts

### Tenant boundary

- `carts`, `cart_items`, `wishlist_items`, and `storefront_migration_ledger`
  are tenant-local tables. They intentionally have no tenant discriminator
  column.
- Every cart/wishlist read and write uses the selected tenant database and an
  owner predicate (`user_id` or an opaque guest-cart UUID plus `user_id IS
  NULL`).
- The API resolves one exact storefront host to one `companies.subdomain`.
  There is no default-tenant or first-company fallback. A logged-in session
  must have the same `companyId`, and the user must be `Active` with the
  `Customer` tenant role.

### Cart API

All successful responses are `Cache-Control: no-store` and contain server
catalog data. The response has top-level `items`/`subtotal` fields and a
`cart` object. Clients never submit or persist prices, names, images, or other
catalog display fields.

- `GET /api/storefront/cart` — read the current guest/customer cart.
- `POST /api/storefront/cart` with `{ productId, variantId, quantity? }` —
  add/increment a line. `variantId` is mandatory; no implicit default variant
  is selected.
- `PATCH`/`PUT /api/storefront/cart` with `{ itemId, quantity }` — update.
- `DELETE /api/storefront/cart/items` with `{ itemId }`, or
  `DELETE /api/storefront/cart/items/:itemId` — remove.
- `DELETE /api/storefront/cart` or `POST|DELETE
  /api/storefront/cart/clear` — clear.
- `POST /api/storefront/cart/import` with `{ items: [{ productId, variantId,
  quantity? }] }` (or a top-level legacy array; `id`/`qty` aliases are
  accepted) — validate/merge a legacy payload. Client display fields are
  ignored.
- `POST /api/storefront/cart/merge` — merge the host's guest cart into the
  authenticated Customer cart. Authenticated cart mutations also perform this
  merge when a guest cookie is present; a successful merge expires the guest
  cookie.

Line quantity is an integer from 1 through 99. A cart is limited to 100
lines/9,999 total units. Stock is checked from the tenant catalog/variant
stock at add, update, and import time. Prices are read from the active
`product_variants` row on every response; no client price is trusted. Legacy
lines without a concrete active variant are rejected with a field such as
`items[0].variantId`; the import path never chooses a default variant. The
client should resolve or remove those lines before importing. The server
decodes and validates the signed session payload against the exact host
company without invoking the legacy fallback-tenant session resolver.

### Guest identity and CSRF

- A guest receives a cryptographically random UUID cart identifier in the
  `storefront_cart` cookie.
- The cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`,
  and has no `Domain` attribute (therefore host-only).
- Cart cookie mutations require an `Origin` header matching the exact request
  authority and protocol. Missing or cross-origin mutation requests are
  rejected. Do not add a permissive CORS policy for these endpoints.

### Wishlist API

Wishlist endpoints require an authenticated, active Customer and never accept
a guest identity.

- `GET /api/storefront/wishlist`
- `POST /api/storefront/wishlist` with `{ productId }`
- `DELETE /api/storefront/wishlist/items` with `{ productId }`, or
  `DELETE /api/storefront/wishlist/items/:productId`
- `DELETE /api/storefront/wishlist` or `POST|DELETE
  /api/storefront/wishlist/clear`
- `POST /api/storefront/wishlist/import` with `{ items: [productId or
  { productId }] }` (or `{ productIds: [...] }`)

Wishlist rows are keyed by `(user_id, product_id)` and are always queried with
the authenticated owner predicate. Product names, images, and prices in the
response are read from the tenant catalog.

## Catalog variant prerequisite

The variant-required cart API depends on every existing catalog product having
at least one concrete variant. The reviewed migration now performs this
prerequisite before writing the migration ledger:

- It locks `products` and `product_variants` while checking for products with
  no variants, making the check stable against concurrent catalog inserts.
- It inserts exactly one active variant named `Default` for each such product.
- The variant SKU is deterministic and tenant-catalog unique:
  `BASE-<productId>`.
- The variant price comes from `products.price`; a legacy `NULL` price becomes
  `0.00` so the existing non-null constraint is respected.
- `ON CONFLICT (sku) DO NOTHING` makes retries and concurrent runs safe. A
  preflight rejects a `BASE-<productId>` SKU owned by another product rather
  than renaming or deleting data.
- Products that already have any variant are untouched. The migration does not
  update, merge, or remove existing variants.
- It does not create `product_stocks` rows. Those rows are variant/warehouse
  specific; the API uses parent `products.stock_quantity` only when no stock
  rows exist for the selected variant, and uses those rows when present.
- A postcondition verifies that no product remains variantless. The ledger row
  is inserted only after that check passes.
- This backfill covers existing rows at rollout time; future product-creation
  flows must create an explicit variant before publishing the product.

The SQL preflight should be run/reviewed per tenant before applying the
migration. Useful read-only checks are:

```sql
-- Products that will receive BASE-<productId>
SELECT p.id, p.price
FROM products AS p
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants AS v WHERE v.product_id = p.id
)
ORDER BY p.id;

-- A SKU collision must be resolved by review, never by an update.
SELECT v.sku, v.product_id
FROM product_variants AS v
WHERE v.sku LIKE 'BASE-%'
ORDER BY v.sku;
```

If a checksum mismatch or default-SKU collision is found, stop and resolve it
through a separately reviewed change; do not overwrite the ledger.

## Review and rollout steps

1. Have a database reviewer read `001_storefront_cart_wishlist.sql` as text.
   Confirm the target is each tenant database/search path, not the master DB.
   Do not use `db:generate` to create a competing migration for this increment;
   reconcile the schema snapshot only after the reviewed SQL rollout.
2. Confirm `STOREFRONT_BASE_DOMAIN` (or the existing
   `NEXT_PUBLIC_DOMAIN`) describes the storefront domain. Configure the
   trusted proxy/host forwarding before enabling mutations.
3. Take a tenant backup and verify that `users`, `products`,
   `product_variants`, and `product_stocks` exist in the target schema. Check
   for orphan rows and run the catalog preflight for products without variants,
   null prices (which intentionally become `0.00`), and conflicting
   `BASE-<productId>` SKUs before applying the default-variant insert.
4. Apply the reviewed SQL manually/per tenant in a controlled migration
   window. The transaction, catalog table lock, postcondition, and
   `IF NOT EXISTS`/`ON CONFLICT` guards make a retry safe; the ledger row is
   written only after the variant backfill completes and records
   `001_storefront_cart_wishlist`.
5. Smoke-test on a non-production tenant: confirm every product has a concrete
   active variant, then test exact-host resolution, guest add, HttpOnly cookie
   attributes, same-origin rejection, authenticated wishlist, guest-to-customer
   merge, import bounds/missing-variant errors, and ownership isolation.
6. Deploy the application code only after the tenant tables are present. Do
   not enable a global feature flag or client integration until the smoke
   tests pass on every target tenant.
7. Keep a rollback plan at the database level: disable the new endpoints/client
   integration first. Do not drop customer cart/wishlist data as an
   application rollback step.

**Checkout is not enabled by this increment.** Cart persistence is not a
checkout authorization or payment boundary. Existing checkout/Stripe flows
remain unchanged and must not treat a cart response as a trusted price or
inventory reservation until a separately reviewed checkout implementation
exists.

# Authoritative storefront checkout increment 003 rollout

**Status:** review-only, additive, tenant-local migration. It was not executed by
application startup and must not be run with `db:push`, `db:migrate`, `db:update`,
seed, reset, or bootstrap. A database reviewer must apply the SQL manually to
one tenant database or tenant `search_path` at a time, never to master.

Logical migration checksum (SHA-256 of the reviewed SQL with each checksum
placeholder represented by the literal `__MIGRATION_CHECKSUM__`):

```text
sha256:37f904104e2374d85f71a30d4571c65af976c7470d75db937e16006de33ef3cc
```

## Added tenant-local contract

Increment `003_storefront_checkout.sql` adds no tenant discriminator. The
selected tenant database/schema remains the isolation boundary.

- `sales.customer_user_id integer NULL` is the only dedicated purchaser owner.
  It references `users(id)` with `ON DELETE SET NULL`. Existing `customer_id`
  (CRM) and `user_id` (POS operator) are not rewritten or treated as ownership.
  All legacy sales remain unscoped by this nullable field.
- `storefront_order_details` is a one-to-one `sale_id` record for the persisted
  reviewed ISO 4217 currency, validated contact data, shipping/billing address
  JSON, selected delivery/payment IDs, marketing preference, and
  terms-acceptance time. Currency is one of `EUR`, `USD`, `GBP`, `CHF`, `CAD`,
  or `AUD`; it is never inferred from the browser. The record never stores a
  card number, CVC, bank account, or provider token.
- `storefront_order_access` gives each guest sale a random access nonce. The
  browser capability is HMAC-keyed and domain-separated by the exact resolved
  tenant subdomain; only its lowercase SHA-256 digest is
  stored. The nonce is used to re-derive the same token after an idempotent
  replay. The capability is HttpOnly, SameSite=Lax, Secure in production,
  host-only, separate from `storefront_cart`, and expires after 180 days. The
  merchant privacy/legal owner must approve that confirmation-access retention
  period before rollout.
- `storefront_checkout_idempotency` uniquely binds a hashed client key to a
  hashed exact Customer/guest-cart scope, normalized request hash, sale, and
  exact success response. Email is not an ownership or idempotency scope.
- Named checks prevent negative parent/variant stock, non-positive sale-item
  quantities, negative sale-item money, unsupported/missing persisted currency,
  invalid hash/status/result state, and invalid order-address JSON. Named FKs and unique/query indexes support buyer
  history, replay, access lookup, and operational retention review.

The SQL is wrapped in one transaction and takes
`pg_advisory_xact_lock(hashtext('storefront:003_checkout:v2'))`. It uses additive
column/index/constraint guards, checks the ledger checksum before writing the
ledger row, and stops on a mismatch. The ledger row is written last, after
postconditions, inside the same transaction.

## Read-only preflight

Run these checks in the intended tenant schema during a controlled window. Save
the output and a backup reference. Do not switch to master or rely on a default
tenant.

```sql
SELECT current_database(), current_schema(), current_setting('search_path');
SELECT migration_key, checksum, applied_at
FROM storefront_migration_ledger
WHERE migration_key IN ('001_storefront_cart_wishlist', '002_blog_cms')
ORDER BY migration_key;

SELECT to_regclass('users') AS users,
       to_regclass('products') AS products,
       to_regclass('product_variants') AS variants,
       to_regclass('product_stocks') AS stocks,
       to_regclass('sales') AS sales,
       to_regclass('sale_items') AS sale_items;

SELECT count(*) AS sales_count FROM sales;
SELECT count(*) AS sale_item_count FROM sale_items;
SELECT count(*) AS invalid_parent_stock
FROM products WHERE stock_quantity < 0;
SELECT count(*) AS invalid_variant_stock
FROM product_stocks WHERE quantity < 0;
SELECT count(*) AS invalid_sale_items
FROM sale_items
WHERE quantity <= 0 OR unit_price < 0 OR subtotal < 0;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'sales'
  AND column_name = 'customer_user_id';
```

If `customer_user_id` or any checkout table already exists, reconcile its type,
constraints, indexes, and contents through a separately reviewed change. In
particular, a pre-existing non-empty `storefront_order_details` table without a
valid persisted currency is an operational stop; 003 never guesses or
backfills it. Do not delete, coerce, backfill, or repurpose CRM/POS ownership. Any nonzero result
from the invalid-stock/sale-item checks is an operational stop for review.

## Application configuration

Apply the SQL before deploying code that can call checkout. Keep the existing
UI submit adapter disconnected until all rollout and smoke tests pass.

```dotenv
STOREFRONT_BASE_DOMAIN=stores.example.com
STOREFRONT_CHECKOUT_CONFIG_JSON={"acme":{"enabled":true,"currency":"EUR","deliveryMethodIds":["standard"],"paymentMethodIds":["cash_on_delivery"],"shippingCents":0,"taxBasisPoints":0}}
STOREFRONT_ORDER_ACCESS_SECRET=<stable-random-secret-at-least-32-bytes>
```

The JSON object is keyed by the exact active `companies.subdomain` already
resolved from the request host. A missing tenant entry, unknown/extra key,
disabled entry, unsupported method/currency, invalid amount, or missing
capability setting fails closed. Currency must be uppercase and in the reviewed
six-code allowlist; the amount model intentionally supports only two-minor-unit
currencies. Never derive the tenant key, currency, or capability from a
submitted company ID, hostname, role, purchaser, browser locale, or browser
amount. Add only reviewed per-merchant entries; do not use one merchant's
currency/tax/shipping policy for every tenant.

Generate a deployment secret with the environment's approved secret manager (for
example, at least 48 random bytes encoded as base64). Do not commit it, expose
it as a `NEXT_PUBLIC_*` value, reuse it in checkout requests, or rotate it
without a reviewed guest-access invalidation plan.

`standard` and `cash_on_delivery` are merely configured capability IDs; the
backend does not create a shipping promise or process cash. The minimum safe
enablement is explicit zero shipping and zero tax. A merchant may configure
nonzero integer cents and basis points only after its tax/shipping owner approves
that tenant-wide policy and applicable rounding behavior. The implementation uses
half-up tax rounding to the nearest cent and applies the configured basis points
to the authoritative subtotal. It does not infer jurisdiction, tax exemptions,
shipping zones, free-shipping rules, or delivery estimates.

Card is deliberately not an implemented payment capability. Even if a request
passes contract validation with `payment.methodId = "card"`, checkout returns
`payment-method-unavailable`; the config loader rejects `card` as an allowed
method. Raw card fields are rejected as unknown request properties. Promotion
codes likewise return `promotion-code-unavailable`. Do not add Stripe, legacy
card helpers, guessed discounts, or a provider token field as part of this
rollout.

The trusted reverse proxy must preserve/overwrite `Host` or
`X-Forwarded-Host` and `X-Forwarded-Proto` so exact-host and same-origin checks
remain authoritative. Production must terminate HTTPS. Do not add permissive
CORS for checkout.

## Checkout API contracts

`GET /api/storefront/checkout/capabilities` uses the exact active storefront
host and authenticated Customer session, or the opaque guest cart cookie. It
requires an exact same-origin `Origin`, or the browser's explicit
`Sec-Fetch-Site: same-origin` signal when GET has no `Origin`. Query strings
and GET bodies are rejected. It never creates a cart, accepts product/price/total input, takes
row locks, or reserves stock.

A successful HTTP 200/no-store response is:

```json
{
  "ok": true,
  "capabilities": {
    "deliveryMethods": [{ "id": "standard", "label": "Standard delivery" }],
    "paymentMethods": [{ "id": "cash_on_delivery", "label": "Cash on delivery" }],
    "promotions": { "available": false, "code": "unavailable" },
    "quote": {
      "currency": "EUR",
      "lineCount": 2,
      "totalQuantity": 3,
      "subtotal": "25.00",
      "shipping": "0.00",
      "tax": "0.00",
      "grandTotal": "25.00",
      "fingerprint": "<64-lowercase-hex-characters>",
      "empty": false
    }
  }
}
```

Labels are neutral and contain no speed/date promise. Card is never exposed.
The response contains no secret, tenant/company/user/owner ID, product or
stock identity, product name/image, cost price, or internal tax basis points.
The fingerprint is a keyed opaque hash of the canonical server-cart lines,
current variant prices, public capability configuration, currency, and totals;
it is not a writable capability. It changes when canonical cart contents or
quote totals change. A missing or empty owned cart returns a successful typed
zero quote with `empty: true`, `lineCount: 0`, and `totalQuantity: 0` rather
than creating state.

The quote runs in a PostgreSQL `REPEATABLE READ READ ONLY` transaction so its
cart and price reads are coherent, but it remains non-reserving. The subsequent
locked POST checkout is always final authority for availability, stock,
prices, and totals.

`POST /api/storefront/checkout` accepts only `Content-Type: application/json`,
an exact same-origin `Origin`, the authenticated Customer session or opaque
guest-cart cookie, and a bounded 16–128 character `Idempotency-Key`. Its JSON
body is exactly the `CheckoutRequest` in
`src/app/shop/checkout/checkout-contract.ts`; `cart`, amount, product, stock,
discount, user/role, company, tenant, purchaser, and payment-instrument fields
are rejected. Bodies are streamed with a 32 KiB hard cap.

A new success returns HTTP 201; a bound replay returns HTTP 200 with the same
confirmation, including the currency persisted on the authoritative sale. Failures use `{ ok: false, error: { code, message, retryable,
fieldErrors? } }`. Every API response is `Cache-Control: no-store`. Validation
messages are fixed and never reflect raw input. The endpoint re-prices and
re-locks the owned server cart even if the browser sends a familiar subtotal.

`confirmationPath` is always the root-relative static
`/shop/order-confirmation`; no order/cart UUID is placed in a path or query.
An authenticated Customer sees only the newest sale whose dedicated
`customer_user_id` matches the validated session. A guest sees only the sale
selected by the separate unexpired host-only order-access cookie, looked up by
its stored SHA-256 digest. The page uses Next.js 16 `connection()` request-time
rendering, so its user-specific response receives private/no-store cache
headers.

## Transaction and lock contract

A successful checkout uses one tenant database transaction in this order:

1. Insert-or-conflict on the scoped idempotency key. A concurrent identical
   request waits for the first transaction and then replays its committed
   result; a concurrent changed payload conflicts.
2. Lock the exact owned cart row, then its ordered cart-item rows. Customer
   ownership is `carts.user_id`; guest ownership is the opaque cart UUID **and**
   `user_id IS NULL`. The cart UUID is never used for a Customer cart.
3. Lock active product rows by `productId`, then their exact product/variant
   rows by `variantId`.
4. Only after all catalog locks, lock stock rows by `variantId`, then
   `warehouseId`, then stock-row `id`.
5. Recheck quantities. Any `product_stocks` row for a variant makes those rows
   authoritative, even if they total zero. Only a variant with no stock rows
   uses the already-locked parent quantity; shared parent fallback is aggregated
   across all fallback variants.
6. Compute exact integer-cent subtotal, configured shipping, configured tax, and
   grand total in the reviewed persisted currency. Validate the existing
   `decimal(12,2)` range. Do not accept a
   browser amount, name, stock value, tax, shipping, discount, role ID, company
   ID, or purchaser ID.
7. Atomically decrement with compare-and-set predicates, insert
   `sales`/`sale_items`/details/access, consume only the locked owned cart's
   items, and complete the idempotency result. Any failure rolls back all of it.

A replay returns before reading or clearing the now-empty cart and cannot
decrement stock or insert another sale. The guest access token is deterministically
re-derived from the persisted random nonce and server secret for a safe
idempotent `Set-Cookie`; the plaintext token is not stored in the database.

## Postconditions and smoke tests

After the reviewer applies the SQL, verify all of the following before enabling
configuration or UI integration:

```sql
SELECT migration_key, checksum, applied_at
FROM storefront_migration_ledger
WHERE migration_key = '003_storefront_checkout';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'sales'
  AND column_name = 'customer_user_id';

SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'storefront_order_details'
  AND column_name = 'currency';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'storefront_order_details'::regclass
  AND conname = 'storefront_order_details_currency_check';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND indexname IN (
    'sales_customer_user_online_idx',
    'storefront_order_access_expires_at_idx',
    'storefront_checkout_idempotency_created_at_idx'
  )
ORDER BY indexname;

SELECT count(*) AS legacy_unscoped_sales
FROM sales WHERE customer_user_id IS NULL;
```

The reviewer should also confirm the named FK/check/unique constraints exist,
`storefront_order_details.currency` is non-null `varchar(3)` with the reviewed
allowlist constraint, `sales` and `sale_items` counts did not change, no row was
attributed from CRM/operator IDs, and increment 001/002 ledger rows remain
unchanged.

On a non-production tenant, smoke-test exact host and cross-origin rejection
for GET and POST, capabilities no-store failures, empty/customer/guest quote
ownership, quote fingerprint changes, a 32 KiB body limit, field validation,
persisted/replayed currency, server-cart-only pricing, variant-stock
precedence, parent fallback, concurrent same-key replay, changed-payload
conflict, atomic cart consumption, and no stock decrement on replay. Verify an
authenticated Customer sees only `customer_user_id = session.userId` sales and
that a guest sees only the order selected by the separate unexpired host-only
capability. Verify `/shop/order-confirmation` has no order/cart UUID in its
path or query string. Card and promotion requests must make no writes.

## Customer-order compatibility and rollback

The existing fail-closed customer-orders page dynamically requires
`sales.customerUserId`; no ownership-compatibility edit was needed in this
increment. After schema rollout it can query dedicated ownership, while legacy
sales with `customer_user_id IS NULL` remain absent rather than being exposed
tenant-wide. Its current money formatter still assumes USD and is outside this
owned increment; before exposing storefront history amounts, it must join
`storefront_order_details` and format each sale with its persisted currency.
Keep schema rollout ahead of any traffic to that page on each tenant.

For rollback, first set the exact tenant entry's `enabled` to `false` (or
remove it) and keep the UI
adapter disconnected. Existing orders, access hashes, and idempotency records
must remain. Do not drop columns/tables or null already populated ownership as
an automatic rollback. Rolling the application back before the SQL is applied
also requires first disabling checkout traffic.

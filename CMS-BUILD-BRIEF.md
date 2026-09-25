# Maryam CMS — build brief (read this first)

## What this is
A WordPress/WooCommerce-style CMS at `C:\Users\Ardit\Desktop\maryam-cms`.
It is a **sibling of `C:\Users\Ardit\Desktop\point-of-sale`** and shares the **same PostgreSQL
databases** (master `pos_master`, tenants `pos_tenant_admin` / `pos_tenant_arditi`).

**NEVER modify anything under `C:\Users\Ardit\Desktop\point-of-sale`.** Read only.
**NEVER run migrations** — all tables/columns already exist (see `drizzle/add_cms_tables.sql`).

Dev server runs on **http://localhost:3003** (already running — do NOT start another one).

## Environment facts
- Next.js **16.3.6**, React 19, Tailwind **v4** (`@import "tailwindcss"` in `src/app/globals.css`).
- Routing convention: **`src/proxy.ts`** is the middleware (Next 16 renamed middleware → proxy).
- Admin routes live in **`src/app/cms/`** → URLs `/cms/*` (NOT a `(cms)` route group).
- Login lives in **`src/app/login/`** → URL `/login`.
- Storefront copied verbatim from point-of-sale lives in **`src/app/shop/`** → URL `/shop`.
- Path alias `@/*` → `src/*`.
- Shell is PowerShell: use `npx.cmd`, `npm.cmd` (bare `npx`/`npm` fail with an execution-policy error).

## Database access (server components)
```ts
import { getContextDb } from '@/lib/tenant';          // tenant DB (products, sales, …)
import { masterDb } from '@/db/master';               // master DB (companies, …)
import * as t from '@/db/schema-tenant';              // Drizzle table definitions
import { eq, desc, asc, and, or, sql, gte, lte, like, count } from 'drizzle-orm';
```
`const db = await getContextDb();` then `db.select()...from(t.products)...`.

The tenant is resolved from the request host. On `localhost:3003` it resolves to the
default dev tenant (`admin` → `pos_tenant_admin`).

## Conventions (must follow)
1. Every admin page: `export const dynamic = 'force-dynamic';`
2. First line of every admin page component: `await requireCmsSession();`
   from `@/lib/cms/session`.
3. Data fetching in **async server components**. Mutations in **server actions**
   (`'use server'`) in a co-located `actions.ts`.
4. Client components only where interactivity is needed (`'use client'`).
5. **Tailwind only** for admin UI. No CSS modules in `src/app/cms/**`.
   `/shop/**` keeps its copied CSS modules — do not restyle it.
6. Use the shared primitives below instead of re-inventing them.
7. TypeScript strict — run `npx.cmd tsc --noEmit --incremental false` when you finish.

## Shared primitives — `@/components/admin/ui`
```tsx
import {
  Button,        // variant: primary | secondary | ghost | danger | outline ; size: sm|md|lg
  Card, CardHeader, CardTitle, CardContent,
  Badge,         // tone: neutral|info|success|warning|danger|brand
  StatusBadge,   // <StatusBadge status={order.status} /> — shared colour mapping
  statusTone, Input, Textarea, Select, Label, Field,
  PageHeader,    // title, description, actions
  EmptyState,    // title, description, action, icon
  Table, Th, Td, // <Table bare> when placed inside a Card
  Skeleton, cn, inputClass,
} from '@/components/admin/ui';
```
Also available:
- `@/components/admin/Pagination` (client) — `<Pagination basePath="/cms/products" page={n} totalPages={n} total={n} searchParams={sp} />`
- `@/components/admin/Sidebar`, `@/components/admin/Topbar` (already wired in the layout)
- `@/components/admin/charts/SalesChart` (recharts client component)
- `@/lib/cms/format` — `formatMoney(value, currency?)`, `formatDate(value, withTime?)`, `slugify(text)`, `cn(...)`
- `@/lib/cms/session` — `requireCmsSession()`, `safeCmsReturnTo(value)`
- `sonner` toasts: `import { toast } from 'sonner'` (toaster is mounted in the root layout)

## Database tables you can rely on
Existing point-of-sale tables: `products`, `product_variants`, `product_stocks`,
`categories`, `sub_categories`, `brands`, `customers`, `sales`, `sale_items`,
`coupons`, `product_discounts`, `category_discounts`, `cms_pages`, `cms_countries`,
`cms_states`, `cms_cities`, `cms_faqs`, `cms_testimonials`, `blog_posts`,
`blog_categories`, `blog_tags`, `blog_comments`, `settings_store`, `users`,
`storefront_order_details`, `carts`, `cart_items`, `wishlist_items`, …

Added by `drizzle/add_cms_tables.sql` (already applied, also declared in
`src/db/schema-tenant.ts`):
`shipping_zones`, `shipping_zone_locations`, `shipping_methods`, `order_tracking`,
`order_notes`, `customer_notes`, `theme_settings`, `cms_media`, `tax_rates`.

`cms_pages` extra columns: `blocks` (jsonb `CmsBlock[]`), `page_type`, `excerpt`,
`featured_image`, `meta_title`, `meta_description`, `author_user_id`, `updated_by`.

`settings_store` is a simple `key`/`value` table — use it for all settings
(key convention below, keep yours inside your own namespace to avoid collisions).

## Settings key namespaces (do not collide)
- Appearance agent → `active_theme`, `theme_customizations`, `nav_menus`, `footer_config`, `widgets`, `theme_*`
- Settings agent → `general_*`, `reading_*`, `discussion_*`, `media_*`, `permalink_*`,
  `smtp_*`, `payment_*`, `tax_*`, `shipping_classes`
- Everyone else: prefix with your module name.

## Ports / URLs
- Admin: `http://localhost:3003/cms/dashboard`
- Login: `http://localhost:3003/login` (test account: `admin@dreamspos.com`)
- Storefront: `http://localhost:3003/shop`

## Storefront routes that render CMS content
- `/shop/pages/[slug]` → `src/app/shop/pages/[slug]/page.tsx` renders published `cms_pages`
  (builder pages go through `BlockRenderer mode="live"` with active products/categories,
  classic pages render their Tiptap HTML). Only `status = 'Active'` rows resolve; anything else 404s.
- `/shop/blogs` and `/shop/blogs/[slug]` read `blog_posts` through `@/lib/storefront/blogs`
  (already copied) — no wiring needed for blog content.
- Public permalink for a CMS page is therefore `/shop/pages/{slug}`; use it for every
  "View page" link in the admin.

## What NOT to touch
`src/proxy.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`,
`src/app/login/**`, `src/app/cms/layout.tsx`, `src/components/admin/**`
(except *adding* new files under `src/components/admin/`),
`src/db/schema-tenant.ts`, `src/db/schema-master.ts`, `package.json`, `.env`,
`drizzle/**`, `scripts/**`, and the whole of `src/app/shop/**`
(the only exception is documented per-agent).

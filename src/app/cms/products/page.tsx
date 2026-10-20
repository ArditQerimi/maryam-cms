import Link from 'next/link';
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { Copy, ExternalLink, Layers, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { categories, products, productStocks, productVariants } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { formatMoney } from '@/lib/cms/format';
import { parseImageUrl } from '@/lib/image-url';
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Td,
  Th,
  Table,
} from '@/components/admin/ui';
import Pagination from '@/components/admin/Pagination';
import ConfirmActionButton from '@/components/store/ConfirmActionButton';
import ProductStatusSwitch from '@/components/store/ProductStatusSwitch';
import { deleteProduct, duplicateProduct } from '@/app/cms/actions/products';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
/** Narrowed to the `status` pgEnum values before it reaches `eq()`. */
const STATUS_OPTIONS = ['Active', 'Inactive', 'Pending', 'Archived', 'Suspended'] as const;
type ProductStatusFilter = (typeof STATUS_OPTIONS)[number];

type SearchParams = {
  q?: string;
  category?: string;
  status?: string;
  variants?: string;
  page?: string;
};

/**
 * Every product has at least one "base" variant that only stands for the product itself: "Default"
 * (SKU BASE-<n>, from the import), "<name> Default" (SKU PRD-<id>-DEFAULT, added by the POS), or
 * one with the product's own name / SKU. A product has variants when it has more than one, or a
 * single one that is not the base.
 */
const baseVariant = sql`(${productVariants.name} in ('Default', ${products.name}, ${products.name} || ' Default') or coalesce(${productVariants.sku}, '') ~ '^(PRD-[0-9]+-DEFAULT|BASE-[0-9]+)$' or ${productVariants.sku} = ${products.sku})`;
const hasRealVariants = sql`(exists (select 1 from ${productVariants} where ${productVariants.productId} = ${products.id} and not ${baseVariant}) or (select count(*) from ${productVariants} where ${productVariants.productId} = ${products.id}) > 1)`;

function isBaseVariant(variant: { name: string | null; sku: string | null }, product: { name: string; sku: string | null }) {
  const name = variant.name ?? '';
  const sku = variant.sku ?? '';
  return (
    name === 'Default' ||
    name === product.name ||
    name === `${product.name} Default` ||
    /^(PRD-\d+-DEFAULT|BASE-\d+)$/.test(sku) ||
    (Boolean(sku) && sku === product.sku)
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireCmsSession();
  const t = await getT();
  const params = await searchParams;

  const q = (params.q || '').trim().slice(0, 120);
  const categoryValue = Number(params.category);
  const categoryId =
    Number.isSafeInteger(categoryValue) && categoryValue > 0 ? categoryValue : null;
  const status: ProductStatusFilter | '' =
    params.status && (STATUS_OPTIONS as readonly string[]).includes(params.status)
      ? (params.status as ProductStatusFilter)
      : '';
  const variantsFilter = params.variants === 'with' || params.variants === 'without' ? params.variants : '';
  const page = Math.max(1, Math.floor(Number(params.page) || 1));

  const filters = [
    q
      ? or(
          ilike(products.name, `%${q}%`),
          ilike(products.sku, `%${q}%`),
          // a variant's name or SKU finds its product too
          sql`exists (select 1 from ${productVariants} where ${productVariants.productId} = ${products.id} and (${productVariants.name} ilike ${`%${q}%`} or ${productVariants.sku} ilike ${`%${q}%`}))`,
        )
      : undefined,
    variantsFilter === 'with' ? hasRealVariants : variantsFilter === 'without' ? sql`not ${hasRealVariants}` : undefined,
    categoryId ? eq(products.categoryId, categoryId) : undefined,
    status ? eq(products.status, status) : undefined,
  ].filter((value): value is SQL => value !== undefined);
  const where = filters.length ? and(...filters) : undefined;

  const db = await getContextDb();

  const [rows, countRows, allCategories, stats] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        sku: products.sku,
        price: products.price,
        stockQuantity: products.stockQuantity,
        minStockLevel: products.minStockLevel,
        status: products.status,
        imageUrl: products.imageUrl,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(where)
      .orderBy(desc(products.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(products)
      .where(where),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(categories.name),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${products.status} = 'Active')::int`,
        outOfStock: sql<number>`count(*) filter (where coalesce(${products.stockQuantity}, 0) <= 0)::int`,
        lowStock: sql<number>`count(*) filter (where coalesce(${products.stockQuantity}, 0) > 0 AND coalesce(${products.stockQuantity}, 0) <= coalesce(${products.minStockLevel}, 0))::int`,
      })
      .from(products),
  ]);

  // Variants of the products on this page (one query). Stock: product_stocks rows when the variant
  // has them, otherwise the product's own stock (same rule as the editor and the storefront).
  const variantRows = rows.length
    ? await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          name: productVariants.name,
          sku: productVariants.sku,
          price: productVariants.price,
          status: productVariants.status,
          stock: sql<number>`coalesce(sum(${productStocks.quantity}), 0)::int`,
          stockRows: sql<number>`count(${productStocks.id})::int`,
        })
        .from(productVariants)
        .leftJoin(productStocks, eq(productStocks.variantId, productVariants.id))
        .where(inArray(productVariants.productId, rows.map((row) => row.id)))
        .groupBy(productVariants.id)
        .orderBy(asc(productVariants.id))
    : [];
  const variantsByProduct = new Map<number, typeof variantRows>();
  for (const variant of variantRows) {
    if (variant.productId === null) continue;
    variantsByProduct.set(variant.productId, [...(variantsByProduct.get(variant.productId) ?? []), variant]);
  }

  const total = countRows[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stat = stats[0] ?? { total: 0, active: 0, outOfStock: 0, lowStock: 0 };

  const statCards = [
    { label: t('cmscatalog.stat.total'), value: stat.total, href: '/cms/products' },
    { label: t('cmscatalog.stat.active'), value: stat.active, href: '/cms/products?status=Active' },
    { label: t('cmscatalog.stat.out_of_stock'), value: stat.outOfStock, href: '/cms/products' },
    { label: t('cmscatalog.stat.low_stock'), value: stat.lowStock, href: '/cms/products' },
  ];

  const paginationParams: Record<string, string | undefined> = {};
  if (q) paginationParams.q = q;
  if (categoryId) paginationParams.category = String(categoryId);
  if (status) paginationParams.status = status;
  if (variantsFilter) paginationParams.variants = variantsFilter;

  return (
    <div>
      <PageHeader
        title={t('cmscatalog.title')}
        description={t('cmscatalog.description')}
        actions={
          <Link
            href="/cms/products/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#6d6be8] px-4 text-sm font-medium text-white transition hover:bg-[#5b59d6]"
          >
            <Plus size={15} /> {t('cmscatalog.new')}
          </Link>
        }
      />

      {/* Stat strip */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href} className="group block">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition group-hover:border-[#6d6be8]/40">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {card.label}
              </p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900">
                {card.value.toLocaleString()}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <form
        method="get"
        className="mb-5 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label
            htmlFor="q"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            {t('cmscatalog.filter.search')}
          </label>
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder={t('cmscatalog.filter.search_placeholder')}
              className="pl-9"
            />
          </div>
        </div>
        <div className="sm:w-52">
          <label
            htmlFor="category"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            {t('cmscatalog.filter.category')}
          </label>
          <Select id="category" name="category" defaultValue={categoryId ? String(categoryId) : ''}>
            <option value="">{t('cmscatalog.filter.all_categories')}</option>
            {allCategories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-44">
          <label
            htmlFor="status"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            {t('cmscatalog.filter.status')}
          </label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">{t('cmscatalog.filter.all_statuses')}</option>
            {STATUS_OPTIONS.map((option) => (
              // Stored pgEnum values: the value AND the visible label stay as-is
              // (mirrors <StatusBadge>, which renders the raw status).
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-44">
          <label
            htmlFor="variants"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            {t('cmscatalog.filter.variants')}
          </label>
          <Select id="variants" name="variants" defaultValue={variantsFilter}>
            <option value="">{t('cmscatalog.filter.variants_all')}</option>
            <option value="with">{t('cmscatalog.filter.variants_with')}</option>
            <option value="without">{t('cmscatalog.filter.variants_without')}</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="md">
            {t('cmscatalog.filter.submit')}
          </Button>
          <Link
            href="/cms/products"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            {t('cmscatalog.filter.clear')}
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={
            q || categoryId || status || variantsFilter
              ? t('cmscatalog.empty.filtered_title')
              : t('cmscatalog.empty.title')
          }
          description={
            q || categoryId || status || variantsFilter
              ? t('cmscatalog.empty.filtered_description')
              : t('cmscatalog.empty.description')
          }
          icon={<Package size={28} />}
          action={
            <Link
              href="/cms/products/new"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#6d6be8] px-4 text-sm font-medium text-white transition hover:bg-[#5b59d6]"
            >
              <Plus size={15} /> {t('cmscatalog.new')}
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-14">{t('cmscatalog.th.image')}</Th>
              <Th>{t('cmscatalog.th.name')}</Th>
              <Th>{t('cmscatalog.th.sku')}</Th>
              <Th>{t('cmscatalog.th.category')}</Th>
              <Th className="text-right">{t('cmscatalog.th.price')}</Th>
              <Th className="text-right">{t('cmscatalog.th.stock')}</Th>
              <Th>{t('cmscatalog.th.status')}</Th>
              <Th className="text-right">{t('cmscatalog.th.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((product) => {
              const image = parseImageUrl(product.imageUrl);
              const stock = product.stockQuantity ?? 0;
              const low = product.minStockLevel ?? 0;
              const allVariants = variantsByProduct.get(product.id) ?? [];
              // Only the base variant: the product has no variants to show.
              const variants =
                allVariants.length > 1 || allVariants.some((variant) => !isBaseVariant(variant, product)) ? allVariants : [];
              const variantStock = (variant: (typeof variants)[number]) => (variant.stockRows > 0 ? variant.stock : stock);
              const prices = variants.map((variant) => Number(variant.price)).filter((value) => Number.isFinite(value) && value > 0);
              const minPrice = prices.length ? Math.min(...prices) : null;
              const maxPrice = prices.length ? Math.max(...prices) : null;
              return (
                <tr key={product.id} className="transition hover:bg-zinc-50">
                  <Td>
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt={product.name}
                        className="h-10 w-10 rounded-lg border border-zinc-200 object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
                        <Package size={16} />
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/cms/products/${product.id}/edit`}
                      className="font-medium text-zinc-900 hover:text-[#5b59d6]"
                    >
                      {product.name}
                    </Link>
                    <span className="block max-w-[240px] truncate text-xs text-zinc-400">
                      /{product.slug || product.id}
                    </span>
                    {variants.length > 0 ? (
                      <details className="mt-1.5 text-xs">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full bg-[#6d6be8]/10 px-2 py-0.5 font-medium text-[#4f4dd6] ring-1 ring-inset ring-[#6d6be8]/30">
                          <Layers size={12} /> {t('cmscatalog.variants_count', { count: variants.length })}
                        </summary>
                        <ul className="mt-2 space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                          {variants.map((variant) => {
                            const left = variantStock(variant);
                            return (
                              <li key={variant.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                <span className="font-medium text-zinc-800">{variant.name}</span>
                                <span className="text-zinc-400">{variant.sku || '—'}</span>
                                <span className="text-zinc-700">{formatMoney(variant.price)}</span>
                                <span className={left <= 0 ? 'text-red-600' : 'text-zinc-500'}>
                                  {left <= 0 ? t('cmscatalog.stock.out') : t('cmscatalog.variant_stock', { stock: left })}
                                </span>
                                {variant.status && variant.status !== 'Active' ? <StatusBadge status={variant.status} /> : null}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap text-zinc-500">{product.sku || '—'}</Td>
                  <Td className="max-w-[160px] truncate">{product.categoryName || '—'}</Td>
                  <Td className="whitespace-nowrap text-right font-medium text-zinc-900">
                    {minPrice !== null && maxPrice !== null && minPrice !== maxPrice
                      ? `${formatMoney(minPrice)} – ${formatMoney(maxPrice)}`
                      : formatMoney(product.price)}
                  </Td>
                  <Td className="text-right">
                    {stock <= 0 ? (
                      <Badge tone="danger">{t('cmscatalog.stock.out')}</Badge>
                    ) : stock <= low ? (
                      <Badge tone="warning">{t('cmscatalog.stock.low', { stock })}</Badge>
                    ) : (
                      <span className="text-zinc-700">{stock}</span>
                    )}
                  </Td>
                  <Td>
                    <ProductStatusSwitch productId={product.id} name={product.name} status={product.status} />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        href={`/cms/products/${product.id}/edit`}
                        title={t('cmscatalog.action.edit')}
                        aria-label={t('cmscatalog.action.edit')}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <Pencil size={15} />
                      </Link>
                      <Link
                        href={`/home/products/${product.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title={t('cmscatalog.action.view')}
                        aria-label={t('cmscatalog.action.view')}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <ExternalLink size={15} />
                      </Link>
                      <ConfirmActionButton
                        action={duplicateProduct}
                        args={[product.id]}
                        successMessage={t('cmscatalog.toast.duplicated')}
                        variant="ghost"
                        title={t('cmscatalog.action.duplicate')}
                        className="h-8 w-8 px-0 text-zinc-500 hover:text-zinc-900"
                      >
                        <Copy size={15} />
                      </ConfirmActionButton>
                      <ConfirmActionButton
                        action={deleteProduct}
                        args={[product.id]}
                        confirmMessage={t('cmscatalog.confirm.delete', { name: product.name })}
                        successMessage={t('cmscatalog.toast.deleted')}
                        variant="ghost"
                        title={t('cmscatalog.action.delete')}
                        className="h-8 w-8 px-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={15} />
                      </ConfirmActionButton>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Pagination
        basePath="/cms/products"
        page={page}
        totalPages={totalPages}
        total={total}
        searchParams={paginationParams}
      />
    </div>
  );
}

import Link from 'next/link';
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { Package, Plus, Search } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { categories, products } from '@/db/schema-tenant';
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
  page?: string;
};

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
  const page = Math.max(1, Math.floor(Number(params.page) || 1));

  const filters = [
    q ? or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`)) : undefined,
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
            q || categoryId || status
              ? t('cmscatalog.empty.filtered_title')
              : t('cmscatalog.empty.title')
          }
          description={
            q || categoryId || status
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
                  </Td>
                  <Td className="whitespace-nowrap text-zinc-500">{product.sku || '—'}</Td>
                  <Td className="max-w-[160px] truncate">{product.categoryName || '—'}</Td>
                  <Td className="whitespace-nowrap text-right font-medium text-zinc-900">
                    {formatMoney(product.price)}
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
                    <StatusBadge status={product.status} />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/cms/products/${product.id}/edit`}
                        className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        {t('cmscatalog.action.edit')}
                      </Link>
                      <Link
                        href={`/home/products/${product.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        {t('cmscatalog.action.view')}
                      </Link>
                      <ConfirmActionButton
                        action={duplicateProduct}
                        args={[product.id]}
                        successMessage={t('cmscatalog.toast.duplicated')}
                        variant="ghost"
                      >
                        {t('cmscatalog.action.duplicate')}
                      </ConfirmActionButton>
                      <ConfirmActionButton
                        action={deleteProduct}
                        args={[product.id]}
                        confirmMessage={t('cmscatalog.confirm.delete', { name: product.name })}
                        successMessage={t('cmscatalog.toast.deleted')}
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                      >
                        {t('cmscatalog.action.delete')}
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

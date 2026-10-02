import Link from 'next/link';
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { Receipt, Search } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { customers, sales, users } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { formatDate, formatMoney } from '@/lib/cms/format';
import { getT } from '@/lib/i18n/server';
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import Pagination from '@/components/admin/Pagination';
import { ORDER_STATUSES, type OrderStatus } from '@/components/store/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
const STATUS_TABS = ['All', ...ORDER_STATUSES] as const;

type SearchParams = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
};

function parseDate(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(endOfDay ? `${value}T23:59:59` : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireCmsSession();
  const t = await getT();
  const params = await searchParams;

  const q = (params.q || '').trim().slice(0, 120);
  // Only real sale statuses may reach `eq(sales.status, …)` — never 'All'.
  const status: OrderStatus | '' =
    params.status && (ORDER_STATUSES as readonly string[]).includes(params.status)
      ? (params.status as OrderStatus)
      : '';
  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  const page = Math.max(1, Math.floor(Number(params.page) || 1));

  const searchFilter = q
    ? or(
        ilike(sales.reference, `%${q}%`),
        ilike(customers.name, `%${q}%`),
        ilike(customers.email, `%${q}%`),
        ilike(users.name, `%${q}%`),
        ilike(users.email, `%${q}%`),
      )
    : undefined;

  const filters: SQL[] = [
    searchFilter,
    status ? eq(sales.status, status) : undefined,
    from ? gte(sales.createdAt, from) : undefined,
    to ? lte(sales.createdAt, to) : undefined,
  ].filter((value): value is SQL => value !== undefined);
  const where = filters.length ? and(...filters) : undefined;

  const db = await getContextDb();

  const [rows, countRows, stats] = await Promise.all([
    db
      .select({
        id: sales.id,
        reference: sales.reference,
        grandTotal: sales.grandTotal,
        status: sales.status,
        paymentMethod: sales.paymentMethod,
        isOnline: sales.isOnline,
        createdAt: sales.createdAt,
        customerName: sql<string | null>`coalesce(${customers.name}, ${users.name})`,
        itemsCount: sql<number>`(select count(*)::int from sale_items si where si.sale_id = ${sales.id})`,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .leftJoin(users, eq(sales.customerUserId, users.id))
      .where(where)
      .orderBy(desc(sales.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    // The count query needs the same joins as the row query: the search
    // filter references `customers.name` / `users.email`.
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .leftJoin(users, eq(sales.customerUserId, users.id))
      .where(where),
    db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${sales.status} = 'Pending')::int`,
        completed: sql<number>`count(*) filter (where ${sales.status} = 'Completed')::int`,
        returned: sql<number>`count(*) filter (where ${sales.status} = 'Returned')::int`,
        revenue: sql<string>`coalesce(sum(${sales.grandTotal}) filter (where ${sales.status} <> 'Cancelled'), '0')`,
      })
      .from(sales),
  ]);

  const total = countRows[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stat = stats[0] ?? { total: 0, pending: 0, completed: 0, returned: 0, revenue: '0' };

  const statCards = [
    { label: t('cmsorders.orders.stat_total'), value: stat.total.toLocaleString(), href: '/cms/orders' },
    { label: t('cmsorders.status.pending'), value: stat.pending.toLocaleString(), href: '/cms/orders?status=Pending' },
    { label: t('cmsorders.status.completed'), value: stat.completed.toLocaleString(), href: '/cms/orders?status=Completed' },
    { label: t('cmsorders.orders.stat_revenue'), value: formatMoney(stat.revenue), href: '/cms/orders' },
  ];

  // Display-only labels for the status tabs; href/status params keep raw values.
  const statusLabel: Record<string, string> = {
    All: t('cmsorders.status.all'),
    Pending: t('cmsorders.status.pending'),
    Completed: t('cmsorders.status.completed'),
    Cancelled: t('cmsorders.status.cancelled'),
    Returned: t('cmsorders.status.returned'),
  };

  const paginationParams: Record<string, string | undefined> = {};
  if (q) paginationParams.q = q;
  if (status) paginationParams.status = status;
  if (params.from) paginationParams.from = params.from;
  if (params.to) paginationParams.to = params.to;

  const hasFilters = Boolean(q || status || params.from || params.to);

  return (
    <div>
      <PageHeader
        title={t('cmsorders.orders.title')}
        description={t('cmsorders.orders.description')}
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
                {card.value}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Status tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {STATUS_TABS.map((tab) => {
          const href =
            tab === 'All'
              ? '/cms/orders'
              : `/cms/orders?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  ...(params.from ? { from: params.from } : {}),
                  ...(params.to ? { to: params.to } : {}),
                  status: tab,
                }).toString()}`;
          const active = tab === 'All' ? !status : status === tab;
          return (
            <Link
              key={tab}
              href={href}
              className={
                active
                  ? 'rounded-lg bg-[#6d6be8] px-3.5 py-1.5 text-xs font-medium text-white'
                  : 'rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50'
              }
            >
              {statusLabel[tab] ?? tab}
            </Link>
          );
        })}
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
            {t('cmsorders.orders.filter_search')}
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder={t('cmsorders.orders.filter_placeholder')}
              className="pl-9"
            />
          </div>
        </div>
        <div className="sm:w-44">
          <label
            htmlFor="from"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            {t('cmsorders.orders.filter_from')}
          </label>
          <Input id="from" name="from" type="date" defaultValue={params.from || ''} />
        </div>
        <div className="sm:w-44">
          <label
            htmlFor="to"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            {t('cmsorders.orders.filter_to')}
          </label>
          <Input id="to" name="to" type="date" defaultValue={params.to || ''} />
        </div>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="md">
            {t('cmsorders.orders.filter_submit')}
          </Button>
          <Link
            href="/cms/orders"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            {t('cmsorders.orders.filter_clear')}
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={
            hasFilters ? t('cmsorders.orders.empty_filtered_title') : t('cmsorders.orders.empty_title')
          }
          description={
            hasFilters
              ? t('cmsorders.orders.empty_filtered_desc')
              : t('cmsorders.orders.empty_desc')
          }
          icon={<Receipt size={28} />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('cmsorders.orders.th_order')}</Th>
              <Th>{t('cmsorders.orders.th_date')}</Th>
              <Th>{t('cmsorders.orders.th_customer')}</Th>
              <Th className="text-right">{t('cmsorders.orders.th_items')}</Th>
              <Th>{t('cmsorders.orders.th_payment')}</Th>
              <Th className="text-right">{t('cmsorders.orders.th_total')}</Th>
              <Th>{t('cmsorders.orders.th_status')}</Th>
              <Th className="text-right">{t('cmsorders.orders.th_actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <tr key={order.id} className="transition hover:bg-zinc-50">
                <Td>
                  <Link
                    href={`/cms/orders/${order.id}`}
                    className="font-medium text-zinc-900 hover:text-[#5b59d6]"
                  >
                    {order.reference}
                  </Link>
                  <span className="block text-xs text-zinc-400">
                    {order.isOnline
                      ? t('cmsorders.orders.channel_storefront')
                      : t('cmsorders.orders.channel_pos')}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {formatDate(order.createdAt, true)}
                </Td>
                <Td className="max-w-[200px] truncate">
                  {order.customerName || t('cmsorders.orders.guest')}
                </Td>
                <Td className="text-right">
                  <Badge tone="neutral">{order.itemsCount}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {order.paymentMethod || '—'}
                </Td>
                <Td className="whitespace-nowrap text-right font-medium text-zinc-900">
                  {formatMoney(order.grandTotal)}
                </Td>
                <Td>
                  <StatusBadge status={order.status} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/cms/orders/${order.id}`}
                      className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      {t('cmsorders.orders.action_view')}
                    </Link>
                    <Link
                      href={`/cms/orders/${order.id}#fulfilment`}
                      className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      {t('cmsorders.orders.action_fulfil')}
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Pagination
        basePath="/cms/orders"
        page={page}
        totalPages={totalPages}
        total={total}
        searchParams={paginationParams}
      />
    </div>
  );
}

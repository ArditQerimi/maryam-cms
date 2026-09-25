import Link from 'next/link';
import { and, desc, eq, gte, ilike, or, sql, type SQL } from 'drizzle-orm';
import { Search, Users } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { customers, sales } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { formatDate, formatMoney } from '@/lib/cms/format';
import {
  Button,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import Pagination from '@/components/admin/Pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
/** Narrowed to the `status` pgEnum values before it reaches `eq()`. */
const STATUS_OPTIONS = ['Active', 'Inactive', 'Pending', 'Archived', 'Suspended'] as const;
type CustomerStatusFilter = (typeof STATUS_OPTIONS)[number];

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireCmsSession();
  const params = await searchParams;

  const q = (params.q || '').trim().slice(0, 120);
  const status: CustomerStatusFilter | '' =
    params.status && (STATUS_OPTIONS as readonly string[]).includes(params.status)
      ? (params.status as CustomerStatusFilter)
      : '';
  const page = Math.max(1, Math.floor(Number(params.page) || 1));

  const filters: SQL[] = [
    q
      ? or(ilike(customers.name, `%${q}%`), ilike(customers.email, `%${q}%`))
      : undefined,
    status ? eq(customers.status, status) : undefined,
  ].filter((value): value is SQL => value !== undefined);
  const where = filters.length ? and(...filters) : undefined;

  const db = await getContextDb();
  const since = monthStart();

  const [rows, countRows, stats] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        status: customers.status,
        createdAt: customers.createdAt,
        orderCount: sql<number>`count(${sales.id})::int`,
        totalSpent: sql<string>`coalesce(sum(${sales.grandTotal}) filter (where ${sales.status} <> 'Cancelled'), '0')`,
      })
      .from(customers)
      .leftJoin(sales, eq(sales.customerId, customers.id))
      .where(where)
      .groupBy(customers.id)
      .orderBy(desc(customers.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: sql<number>`count(*)::int` }).from(customers).where(where),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${customers.status} = 'Active')::int`,
        disabled: sql<number>`count(*) filter (where ${customers.status} = 'Suspended')::int`,
        newThisMonth: sql<number>`count(*) filter (where ${customers.createdAt} >= ${since})::int`,
      })
      .from(customers),
  ]);

  const total = countRows[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stat = stats[0] ?? { total: 0, active: 0, disabled: 0, newThisMonth: 0 };

  const statCards = [
    { label: 'Total customers', value: stat.total, href: '/cms/customers' },
    { label: 'Active', value: stat.active, href: '/cms/customers?status=Active' },
    { label: 'Disabled', value: stat.disabled, href: '/cms/customers?status=Suspended' },
    { label: 'New this month', value: stat.newThisMonth, href: '/cms/customers' },
  ];

  const paginationParams: Record<string, string | undefined> = {};
  if (q) paginationParams.q = q;
  if (status) paginationParams.status = status;

  const hasFilters = Boolean(q || status);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Registered storefront accounts and CRM contacts."
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
            Search
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Name or email…"
              className="pl-9"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <label
            htmlFor="status"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Status
          </label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="md">
            Filter
          </Button>
          <Link
            href="/cms/customers"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No customers match these filters' : 'No customers yet'}
          description={
            hasFilters
              ? 'Try a different search term or clear the filters.'
              : 'Storefront accounts and POS customers will appear here.'
          }
          icon={<Users size={28} />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Email</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Total spent</Th>
              <Th>Registered</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((customer) => (
              <tr key={customer.id} className="transition hover:bg-zinc-50">
                <Td>
                  <Link
                    href={`/cms/customers/${customer.id}`}
                    className="flex items-center gap-3 font-medium text-zinc-900 hover:text-[#5b59d6]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6d6be8]/10 text-xs font-semibold text-[#5b59d6]">
                      {initials(customer.name)}
                    </span>
                    {customer.name}
                  </Link>
                </Td>
                <Td className="max-w-[240px] truncate">{customer.email || '—'}</Td>
                <Td className="text-right">{customer.orderCount}</Td>
                <Td className="whitespace-nowrap text-right font-medium text-zinc-900">
                  {formatMoney(customer.totalSpent)}
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {formatDate(customer.createdAt)}
                </Td>
                <Td>
                  <StatusBadge status={customer.status} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/cms/customers/${customer.id}`}
                      className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      View profile
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Pagination
        basePath="/cms/customers"
        page={page}
        totalPages={totalPages}
        total={total}
        searchParams={paginationParams}
      />
    </div>
  );
}

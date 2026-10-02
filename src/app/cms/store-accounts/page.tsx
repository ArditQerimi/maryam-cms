import Link from 'next/link';
import { and, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { Search, UserCheck } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { sales, users } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { formatDate } from '@/lib/cms/format';
import { getT, type Dictionary } from '@/lib/i18n/server';
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
/** Narrowed to the `user_status` pgEnum values before it reaches `eq()`. */
const STATUS_OPTIONS = ['Active', 'Inactive', 'Pending', 'Suspended'] as const;
type UserStatusFilter = (typeof STATUS_OPTIONS)[number];

/** Localized label per `status` filter value (the `value` prop stays the enum). */
const STATUS_LABEL_KEYS: Record<UserStatusFilter, keyof Dictionary> = {
  Active: 'cmscustomers.status.active',
  Inactive: 'cmscustomers.status.inactive',
  Pending: 'cmscustomers.status.pending',
  Suspended: 'cmscustomers.status.suspended',
};

/** Narrowed before it reaches `isNull`/`isNotNull`. */
const VERIFY_OPTIONS = ['', 'confirmed', 'unconfirmed'] as const;
type VerifyFilter = (typeof VERIFY_OPTIONS)[number];

type SearchParams = {
  q?: string;
  status?: string;
  verified?: string;
  page?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

/**
 * E-commerce accounts (`users.user_type = 'storefront'`): shoppers who can
 * sign in, order, and review. Kept separate from the ERP staff roster that
 * manages the CMS — this page is the admin-side half of that distinction.
 */
export default async function StoreAccountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireCmsSession();
  const t = await getT();
  const params = await searchParams;

  const q = (params.q || '').trim().slice(0, 120);
  const status: UserStatusFilter | '' =
    params.status && (STATUS_OPTIONS as readonly string[]).includes(params.status)
      ? (params.status as UserStatusFilter)
      : '';
  const verified: VerifyFilter = (VERIFY_OPTIONS as readonly string[]).includes(params.verified || '')
    ? ((params.verified || '') as VerifyFilter)
    : '';
  const page = Math.max(1, Math.floor(Number(params.page) || 1));

  const filters: SQL[] = [
    eq(users.userType, 'storefront'),
    q ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)) : undefined,
    status ? eq(users.status, status) : undefined,
    verified === 'confirmed' ? isNotNull(users.emailVerifiedAt) : undefined,
    verified === 'unconfirmed' ? isNull(users.emailVerifiedAt) : undefined,
  ].filter((value): value is SQL => value !== undefined);
  const where = and(...filters);

  const db = await getContextDb();

  const [rows, countRows, stats] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        orderCount: sql<number>`count(${sales.id})::int`,
      })
      .from(users)
      .leftJoin(sales, eq(sales.customerUserId, users.id))
      .where(where)
      .groupBy(users.id)
      .orderBy(desc(users.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: sql<number>`count(*)::int` }).from(users).where(where),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${users.status} = 'Active')::int`,
        confirmed: sql<number>`count(*) filter (where ${users.emailVerifiedAt} is not null)::int`,
        unconfirmed: sql<number>`count(*) filter (where ${users.emailVerifiedAt} is null)::int`,
      })
      .from(users)
      .where(eq(users.userType, 'storefront')),
  ]);

  const total = countRows[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stat = stats[0] ?? { total: 0, active: 0, confirmed: 0, unconfirmed: 0 };

  const statCards = [
    {
      label: t('cmscustomers.storeaccounts.stat.total'),
      value: stat.total,
      href: '/cms/store-accounts',
    },
    { label: t('cmscustomers.status.active'), value: stat.active, href: '/cms/store-accounts?status=Active' },
    {
      label: t('cmscustomers.verified.label'),
      value: stat.confirmed,
      href: '/cms/store-accounts?verified=confirmed',
    },
    {
      label: t('cmscustomers.storeaccounts.stat.unconfirmed'),
      value: stat.unconfirmed,
      href: '/cms/store-accounts?verified=unconfirmed',
    },
  ];

  const paginationParams: Record<string, string | undefined> = {};
  if (q) paginationParams.q = q;
  if (status) paginationParams.status = status;
  if (verified) paginationParams.verified = verified;

  const hasFilters = Boolean(q || status || verified);

  return (
    <div>
      <PageHeader
        title={t('cmscustomers.storeaccounts.title')}
        description={t('cmscustomers.storeaccounts.description')}
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
            {t('cmscustomers.search.label')}
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder={t('cmscustomers.search.placeholder')}
              className="pl-9"
            />
          </div>
        </div>
        <div className="sm:w-44">
          <label
            htmlFor="status"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            {t('cmscustomers.status.label')}
          </label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">{t('cmscustomers.status.all')}</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(STATUS_LABEL_KEYS[option])}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-48">
          <label
            htmlFor="verified"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            {t('cmscustomers.verified.label')}
          </label>
          <Select id="verified" name="verified" defaultValue={verified}>
            <option value="">{t('cmscustomers.verified.all')}</option>
            <option value="confirmed">{t('cmscustomers.verified.confirmed')}</option>
            <option value="unconfirmed">{t('cmscustomers.verified.unconfirmed')}</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="md">
            {t('cmscustomers.filter')}
          </Button>
          <Link
            href="/cms/store-accounts"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            {t('cmscustomers.clear')}
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={
            hasFilters
              ? t('cmscustomers.storeaccounts.no_match.title')
              : t('cmscustomers.storeaccounts.empty.title')
          }
          description={
            hasFilters
              ? t('cmscustomers.no_match.desc')
              : t('cmscustomers.storeaccounts.empty.desc')
          }
          icon={<UserCheck size={28} />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('cmscustomers.storeaccounts.th.account')}</Th>
              <Th>{t('cmscustomers.th.email')}</Th>
              <Th className="text-right">{t('cmscustomers.th.orders')}</Th>
              <Th>{t('cmscustomers.verified.label')}</Th>
              <Th>{t('cmscustomers.registered')}</Th>
              <Th>{t('cmscustomers.status.label')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((account) => (
              <tr key={account.id} className="transition hover:bg-zinc-50">
                <Td>
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                      {initials(account.name)}
                    </span>
                    <span className="font-medium text-zinc-900">{account.name}</span>
                  </div>
                </Td>
                <Td className="max-w-[240px] truncate">{account.email}</Td>
                <Td className="text-right">{account.orderCount}</Td>
                <Td>
                  {account.emailVerifiedAt ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      {t('cmscustomers.verified.confirmed')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      {t('cmscustomers.verified.unconfirmed')}
                    </span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {formatDate(account.createdAt)}
                </Td>
                <Td>
                  <StatusBadge status={account.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Pagination
        basePath="/cms/store-accounts"
        page={page}
        totalPages={totalPages}
        total={total}
        searchParams={paginationParams}
      />
    </div>
  );
}

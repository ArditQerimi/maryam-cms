import Link from 'next/link';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { FileText, Plus } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { cmsPages } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { ensureHomePage } from '@/lib/cms/ensure-home-page';
import { formatDate } from '@/lib/cms/format';
import { getT } from '@/lib/i18n/server';
import {
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import Pagination from '@/components/admin/Pagination';
import ListFilters from '@/components/content/ListFilters';
import PageRowActions from '@/components/content/PageRowActions';
import { ContentStatusBadge, STATUS_FILTERS, dbStatusForFilter } from '@/components/content/content-status';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function PagesListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireCmsSession();
  await ensureHomePage();
  const t = await getT();

  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 120);
  const statusFilter = first(sp.status) || 'All';
  const page = Math.max(1, Math.floor(Number(first(sp.page)) || 1));

  const db = await getContextDb();

  const conditions = [
    q ? or(ilike(cmsPages.title, `%${q}%`), ilike(cmsPages.slug, `%${q}%`)) : undefined,
  ];
  const dbStatus = dbStatusForFilter(statusFilter);
  if (dbStatus) conditions.push(eq(cmsPages.status, dbStatus));
  const where = and(...conditions);

  const [countRows, rows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(cmsPages)
      .where(where),
    db
      .select({
        id: cmsPages.id,
        title: cmsPages.title,
        slug: cmsPages.slug,
        pageType: cmsPages.pageType,
        status: cmsPages.status,
        updatedAt: cmsPages.updatedAt,
      })
      .from(cmsPages)
      .where(where)
      .orderBy(desc(cmsPages.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = countRows[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title={t('cmscontent.pages.title')}
        description={t('cmscontent.pages.description')}
        actions={
          <Link
            href="/cms/pages/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-transparent bg-[#6d6be8] px-4 text-sm font-medium text-white transition hover:bg-[#5b59d6]"
          >
            <Plus size={15} /> {t('cmscontent.pages.new')}
          </Link>
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t('cmscontent.pages.all')}</CardTitle>
          <ListFilters
            basePath="/cms/pages"
            initialQuery={q}
            initialStatus={statusFilter}
            statuses={STATUS_FILTERS}
          />
        </CardHeader>

        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={
                q || statusFilter !== 'All'
                  ? t('cmscontent.pages.emptyFilteredTitle')
                  : t('cmscontent.pages.emptyTitle')
              }
              description={
                q || statusFilter !== 'All'
                  ? t('cmscontent.pages.emptyFilteredDescription')
                  : t('cmscontent.pages.emptyDescription')
              }
              action={
                <Link
                  href="/cms/pages/new"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#6d6be8] px-4 text-sm font-medium text-white transition hover:bg-[#5b59d6]"
                >
                  <Plus size={14} /> {t('cmscontent.pages.new')}
                </Link>
              }
              icon={<FileText size={28} />}
            />
          </div>
        ) : (
          <Table bare>
            <thead>
              <tr>
                <Th>{t('cmscontent.pages.colTitle')}</Th>
                <Th>{t('cmscontent.pages.colType')}</Th>
                <Th>{t('cmscontent.pages.colStatus')}</Th>
                <Th>{t('cmscontent.pages.colUpdated')}</Th>
                <Th className="text-right">{t('cmscontent.pages.colActions')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-zinc-50">
                  <Td>
                    <Link
                      href={`/cms/pages/${row.id}/edit`}
                      className="font-medium text-zinc-900 hover:text-[#5b59d6]"
                    >
                      {row.title}
                    </Link>
                    <span className="mt-0.5 block truncate text-xs text-zinc-400">/{row.slug}</span>
                  </Td>
                  <Td className="capitalize text-zinc-500">
                    {row.pageType || t('cmscontent.pages.pageFallback')}
                  </Td>
                  <Td>
                    <ContentStatusBadge status={row.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-zinc-500">
                    {formatDate(row.updatedAt, true)}
                  </Td>
                  <Td>
                    <PageRowActions id={row.id} title={row.title} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Pagination
        basePath="/cms/pages"
        page={page}
        totalPages={totalPages}
        total={total}
        searchParams={{
          q: q || undefined,
          status: statusFilter !== 'All' ? statusFilter : undefined,
        }}
      />
    </div>
  );
}

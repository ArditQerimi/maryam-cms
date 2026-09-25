import Link from 'next/link';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { PenLine, Plus } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { blogCategories, blogPosts } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { formatDate } from '@/lib/cms/format';
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
import PostRowActions from '@/components/content/PostRowActions';
import {
  ContentStatusBadge,
  STATUS_FILTERS,
  dbStatusForFilter,
} from '@/components/content/content-status';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function PostsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireCmsSession();

  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 120);
  const statusFilter = first(sp.status) || 'All';
  const page = Math.max(1, Math.floor(Number(first(sp.page)) || 1));

  const db = await getContextDb();

  const conditions = [
    q
      ? or(
          ilike(blogPosts.title, `%${q}%`),
          ilike(blogPosts.slug, `%${q}%`),
          ilike(blogPosts.excerpt, `%${q}%`),
        )
      : undefined,
  ];
  const dbStatus = dbStatusForFilter(statusFilter);
  if (dbStatus) conditions.push(eq(blogPosts.status, dbStatus));
  const where = and(...conditions);

  const [countRows, rows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(blogPosts)
      .where(where),
    db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        status: blogPosts.status,
        publishedAt: blogPosts.publishedAt,
        categoryName: blogCategories.name,
      })
      .from(blogPosts)
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .where(where)
      .orderBy(desc(sql`coalesce(${blogPosts.publishedAt}, ${blogPosts.createdAt})`))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = countRows[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q) || statusFilter !== 'All';

  return (
    <div>
      <PageHeader
        title="Posts"
        description="Blog articles shown in the storefront's news section."
        actions={
          <Link
            href="/cms/posts/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-transparent bg-[#6d6be8] px-4 text-sm font-medium text-white transition hover:bg-[#5b59d6]"
          >
            <Plus size={15} /> New post
          </Link>
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All posts</CardTitle>
          <ListFilters
            basePath="/cms/posts"
            initialQuery={q}
            initialStatus={statusFilter}
            statuses={STATUS_FILTERS}
          />
        </CardHeader>

        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={filtered ? 'No posts match your filters' : 'No posts yet'}
              description={
                filtered
                  ? 'Try a different search term or clear the status filter.'
                  : 'Write your first article and publish it to the storefront blog.'
              }
              action={
                <Link
                  href="/cms/posts/new"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#6d6be8] px-4 text-sm font-medium text-white transition hover:bg-[#5b59d6]"
                >
                  <Plus size={14} /> New post
                </Link>
              }
              icon={<PenLine size={28} />}
            />
          </div>
        ) : (
          <Table bare>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th>Published</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-zinc-50">
                  <Td>
                    <Link
                      href={`/cms/posts/${row.id}/edit`}
                      className="font-medium text-zinc-900 hover:text-[#5b59d6]"
                    >
                      {row.title}
                    </Link>
                    <span className="mt-0.5 block truncate text-xs text-zinc-400">/{row.slug}</span>
                  </Td>
                  <Td className="text-zinc-500">{row.categoryName || 'Uncategorized'}</Td>
                  <Td>
                    <ContentStatusBadge status={row.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-zinc-500">
                    {row.publishedAt ? formatDate(row.publishedAt, true) : '—'}
                  </Td>
                  <Td>
                    <PostRowActions id={row.id} title={row.title} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Pagination
        basePath="/cms/posts"
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

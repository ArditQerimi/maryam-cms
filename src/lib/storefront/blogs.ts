import 'server-only';
import { and, desc, eq, lte } from 'drizzle-orm';
import * as schema from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';

export type PublicBlogPostRecord = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  authorName: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: number; name: string; status: string } | null;
  tagLinks: Array<{ tag: { id: number; name: string; status: string } | null }>;
};

/**
 * Public CMS read model. Drafts and future-dated posts are excluded in the
 * database query rather than filtered only after loading into application
 * memory. Tenant selection is performed by getContextDb from the exact host.
 */
export async function getPublicBlogPostRecords(): Promise<PublicBlogPostRecord[]> {
  const db = await getContextDb();
  const now = new Date();

  const rows = await db.query.blogPosts.findMany({
    where: and(
      eq(schema.blogPosts.status, 'Active'),
      lte(schema.blogPosts.publishedAt, now),
    ),
    columns: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImageUrl: true,
      authorName: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      category: {
        columns: { id: true, name: true, status: true },
      },
      tagLinks: {
        with: {
          tag: {
            columns: { id: true, name: true, status: true },
          },
        },
      },
    },
    orderBy: [desc(schema.blogPosts.publishedAt), desc(schema.blogPosts.createdAt)],
    limit: 500,
  }) as unknown as PublicBlogPostRecord[];

  return rows
    .filter((row) => !row.category || row.category.status === 'Active')
    .map((row) => ({
      ...row,
      tagLinks: row.tagLinks.filter((link) => !link.tag || link.tag.status === 'Active'),
    }));
}

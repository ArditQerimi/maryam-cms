import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getContextDb } from '@/lib/tenant';
import { blogCategories, blogPosts } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import PostForm from '@/components/content/PostForm';

export const dynamic = 'force-dynamic';

/** Date → value for `<input type="datetime-local">` (local time). */
function toLocalInputValue(value: Date | null): string {
  if (!value) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
    value.getHours(),
  )}:${pad(value.getMinutes())}`;
}

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCmsSession();
  const t = await getT();

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const db = await getContextDb();
  const [row, categories] = await Promise.all([
    db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1),
    db
      .select({ id: blogCategories.id, name: blogCategories.name })
      .from(blogCategories)
      .where(eq(blogCategories.status, 'Active'))
      .orderBy(asc(blogCategories.name)),
  ]);

  const post = row[0];
  if (!post) notFound();

  return (
    <div>
      <PageHeader
        title={t('cmscontent.posts.editTitle', { title: post.title })}
        description={t('cmscontent.posts.editDescription', {
          date: post.updatedAt.toLocaleString('en-GB'),
        })}
      />
      <PostForm
        categories={categories}
        viewHref={post.status === 'Active' ? `/home/blogs/${post.slug}` : ''}
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          categoryId: post.categoryId,
          excerpt: post.excerpt ?? '',
          coverImageUrl: post.coverImageUrl ?? '',
          content: post.content ?? '',
          status: post.status,
          publishedAt: toLocalInputValue(post.publishedAt),
        }}
      />
    </div>
  );
}

import { asc, eq } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { blogCategories } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import PostForm from '@/components/content/PostForm';

export const dynamic = 'force-dynamic';

export default async function NewPostPage() {
  await requireCmsSession();
  const t = await getT();

  const db = await getContextDb();
  const categories = await db
    .select({ id: blogCategories.id, name: blogCategories.name })
    .from(blogCategories)
    .where(eq(blogCategories.status, 'Active'))
    .orderBy(asc(blogCategories.name));

  return (
    <div>
      <PageHeader
        title={t('cmscontent.posts.new')}
        description={t('cmscontent.posts.newDescription')}
      />
      <PostForm
        categories={categories}
        viewHref=""
        initial={{
          id: null,
          title: '',
          slug: '',
          categoryId: null,
          excerpt: '',
          coverImageUrl: '',
          content: '',
          status: 'Pending',
          publishedAt: '',
        }}
      />
    </div>
  );
}

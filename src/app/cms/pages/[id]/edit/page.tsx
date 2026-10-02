import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { cmsPages } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { normalizeBlocks } from '@/app/cms/builder/blocks';
import { getBuilderPreviewTheme } from '@/lib/theme/builder-preview-theme';
import { getT } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import PageForm from '@/components/content/PageForm';

export const dynamic = 'force-dynamic';

export default async function EditPagePage({
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
  const [row] = await db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1);
  if (!row) notFound();

  const previewTheme = await getBuilderPreviewTheme();

  return (
    <div>
      <PageHeader
        title={t('cmscontent.pages.editTitle', { title: row.title })}
        description={t('cmscontent.pages.editDescription', {
          date: row.updatedAt.toLocaleString('en-GB'),
        })}
      />
      <PageForm
        previewTheme={previewTheme}
        initial={{
          id: row.id,
          title: row.title,
          slug: row.slug,
          content: row.content ?? '',
          blocks: normalizeBlocks(row.blocks),
          pageType: row.pageType || 'page',
          excerpt: row.excerpt ?? '',
          featuredImage: row.featuredImage ?? '',
          metaTitle: row.metaTitle ?? '',
          metaDescription: row.metaDescription ?? '',
          status: row.status,
          editorMode: row.blocks && row.blocks.length > 0 ? 'builder' : 'classic',
        }}
      />
    </div>
  );
}

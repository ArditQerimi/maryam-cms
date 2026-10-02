import { asc } from 'drizzle-orm';
import { requireCmsSession } from '@/lib/cms/session';
import { ensureHomePage } from '@/lib/cms/ensure-home-page';
import { getBuilderPreviewTheme } from '@/lib/theme/builder-preview-theme';
import { normalizeBlocks } from '@/app/cms/builder/blocks';
import { getContextDb } from '@/lib/tenant';
import { cmsPages } from '@/db/schema-tenant';
import { PageHeader } from '@/components/admin/ui';
import { getT } from '@/lib/i18n/server';
import BuilderPlayground from '@/components/content/BuilderPlayground';

export const dynamic = 'force-dynamic';

export default async function BuilderPlaygroundPage() {
  await requireCmsSession();
  await ensureHomePage();
  const t = await getT();

  const db = await getContextDb();
  const rows = await db
    .select({
      id: cmsPages.id,
      title: cmsPages.title,
      slug: cmsPages.slug,
      blocks: cmsPages.blocks,
    })
    .from(cmsPages)
    .orderBy(asc(cmsPages.title))
    .catch(() => []);

  // Ship each page's saved layout so picking a target loads it for editing
  // instead of starting blank (which would overwrite it on save).
  const pages = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    blocks: normalizeBlocks(row.blocks ?? []),
  }));

  // `/home` is the storefront homepage, so editing it is the common case.
  const homeId = pages.find((page) => page.slug === 'home')?.id ?? null;

  return (
    <div>
      <PageHeader
        title={t('cmscontent.builder.title')}
        description={t('cmscontent.builder.description')}
      />
      <BuilderPlayground
        pages={pages}
        defaultPageId={homeId}
        previewTheme={await getBuilderPreviewTheme()}
      />
    </div>
  );
}

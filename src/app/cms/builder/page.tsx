import { asc } from 'drizzle-orm';
import { requireCmsSession } from '@/lib/cms/session';
import { ensureHomePage } from '@/lib/cms/ensure-home-page';
import { getContextDb } from '@/lib/tenant';
import { cmsPages } from '@/db/schema-tenant';
import { PageHeader } from '@/components/admin/ui';
import BuilderPlayground from '@/components/content/BuilderPlayground';

export const dynamic = 'force-dynamic';

export default async function BuilderPlaygroundPage() {
  await requireCmsSession();
  await ensureHomePage();

  const db = await getContextDb();
  const pages = await db
    .select({ id: cmsPages.id, title: cmsPages.title, slug: cmsPages.slug })
    .from(cmsPages)
    .orderBy(asc(cmsPages.title))
    .catch(() => []);

  // `/shop` is the storefront homepage, so editing it is the common case.
  const homeId = pages.find((page) => page.slug === 'home')?.id ?? null;

  return (
    <div>
      <PageHeader
        title="Page builder"
        description="Compose a layout with the drag-and-drop block editor, then save it onto a page."
      />
      <BuilderPlayground pages={pages} defaultPageId={homeId} />
    </div>
  );
}

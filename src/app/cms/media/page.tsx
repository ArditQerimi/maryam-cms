import { desc } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { cmsMedia } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { PageHeader } from '@/components/admin/ui';
import MediaLibrary from '@/components/content/MediaLibrary';

export const dynamic = 'force-dynamic';

const INITIAL_LIMIT = 300;

export default async function MediaPage() {
  await requireCmsSession();

  const db = await getContextDb();
  const items = await db
    .select({
      id: cmsMedia.id,
      filename: cmsMedia.filename,
      originalName: cmsMedia.originalName,
      url: cmsMedia.url,
      mimeType: cmsMedia.mimeType,
      sizeBytes: cmsMedia.sizeBytes,
      width: cmsMedia.width,
      height: cmsMedia.height,
      altText: cmsMedia.altText,
      folder: cmsMedia.folder,
      createdAt: cmsMedia.createdAt,
    })
    .from(cmsMedia)
    .orderBy(desc(cmsMedia.createdAt))
    .limit(INITIAL_LIMIT);

  return (
    <div>
      <PageHeader
        title="Media"
        description="Images, videos and documents used across pages, posts and products."
      />
      <MediaLibrary initialItems={items} />
    </div>
  );
}

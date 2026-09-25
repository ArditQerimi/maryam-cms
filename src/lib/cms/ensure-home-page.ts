import { eq } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { cmsPages } from '@/db/schema-tenant';

/**
 * The storefront front page must always be editable, even on a fresh install,
 * so the CMS keeps a `home` page around. Idempotent: the unique slug means a
 * concurrent call simply loses the insert race without any visible effect.
 */
export async function ensureHomePage(): Promise<void> {
  try {
    const db = await getContextDb();
    const [existing] = await db
      .select({ id: cmsPages.id })
      .from(cmsPages)
      .where(eq(cmsPages.slug, 'home'))
      .limit(1);
    if (existing) return;

    await db.insert(cmsPages).values({
      title: 'Home',
      slug: 'home',
      blocks: [],
      pageType: 'page',
      status: 'Active',
    });
  } catch (error) {
    console.error('[cms] could not ensure the Home page exists', error);
  }
}

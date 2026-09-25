import { and, eq, inArray } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { cmsPages, settingsStore } from '@/db/schema-tenant';
import { normalizeBlocks, type Block } from '@/app/cms/builder/blocks';

/** `settings_store.value` holds JSON, but tolerate a raw string too. */
function readSetting(value: string | undefined): string {
  if (typeof value !== 'string') return '';
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : String(parsed ?? '');
  } catch {
    return value;
  }
}

/**
 * Blocks for the storefront front page. `/shop` is the homepage, so the CMS
 * page with the `home` slug drives it directly — no extra setting to flip.
 * Reading settings still win when they explicitly name another static page.
 * An empty result leaves `/shop` on its built-in section layout.
 */
export async function getStorefrontHomepageBlocks(): Promise<Block[]> {
  try {
    const db = await getContextDb();
    const rows = await db
      .select({ key: settingsStore.key, value: settingsStore.value })
      .from(settingsStore)
      .where(
        inArray(settingsStore.key, ['reading_homepage_type', 'reading_homepage_page_id']),
      );

    const settings = new Map(rows.map((row) => [row.key, readSetting(row.value)]));
    const overrideId = Number(settings.get('reading_homepage_page_id'));
    const usesOverride =
      settings.get('reading_homepage_type') === 'static'
      && Number.isInteger(overrideId)
      && overrideId > 0;

    const [page] = await db
      .select({ blocks: cmsPages.blocks })
      .from(cmsPages)
      .where(
        and(
          usesOverride ? eq(cmsPages.id, overrideId) : eq(cmsPages.slug, 'home'),
          eq(cmsPages.status, 'Active'),
        ),
      )
      .limit(1);

    return normalizeBlocks(page?.blocks ?? []);
  } catch (error) {
    console.error('[shop] could not resolve the homepage document', error);
    return [];
  }
}

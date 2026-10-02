import { asc, desc, eq } from 'drizzle-orm';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { blogPosts, cmsPages, settingsStore, themeSettings } from '@/db/schema-tenant';
import { getT } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import MenuBuilder from '@/components/appearance/MenuBuilder';
import type { NavMenuItem, NavMenus, NavMenuLocation } from '@/lib/theme/types';

export const dynamic = 'force-dynamic';

function normalizeItems(raw: unknown): NavMenuItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Partial<NavMenuItem> => Boolean(entry) && typeof entry === 'object')
    .slice(0, 100)
    .map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `restored-${index}`,
      label: typeof entry.label === 'string' ? entry.label : 'Untitled',
      url: typeof entry.url === 'string' ? entry.url : '#',
      depth: entry.depth === 1 ? 1 : 0,
    }));
}

function normalizeLocation(raw: unknown): NavMenuLocation {
  return raw === 'footer' || raw === 'mobile' ? raw : 'primary';
}

function parseMenus(raw: unknown): NavMenus {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const menus: NavMenus = {};
  for (const [name, record] of Object.entries(raw as Record<string, unknown>)) {
    const value = record as { items?: unknown; location?: unknown };
    menus[name] = {
      items: normalizeItems(value.items),
      location: normalizeLocation(value.location),
    };
  }
  return menus;
}

export default async function MenusPage() {
  await requireCmsSession();
  const t = await getT();

  const company = await getContextCompany();
  const db = await getContextDb();

  const [pages, posts, themeRow, menusRow] = await Promise.all([
    db
      .select({ id: cmsPages.id, title: cmsPages.title, slug: cmsPages.slug })
      .from(cmsPages)
      .where(eq(cmsPages.status, 'Active'))
      .orderBy(asc(cmsPages.title))
      .limit(200),
    db
      .select({ id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug })
      .from(blogPosts)
      .where(eq(blogPosts.status, 'Active'))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(20),
    db
      .select({
        navMenu: themeSettings.navMenu,
        navMenuLocation: themeSettings.navMenuLocation,
      })
      .from(themeSettings)
      .where(eq(themeSettings.companyId, company.id))
      .limit(1),
    db
      .select({ value: settingsStore.value })
      .from(settingsStore)
      .where(eq(settingsStore.key, 'nav_menus'))
      .limit(1),
  ]);

  const menus = parseMenus(menusRow?.[0]?.value ? parseJson(menusRow[0].value) : null);
  const currentItems = normalizeItems(themeRow?.[0]?.navMenu);
  const currentLocation = normalizeLocation(themeRow?.[0]?.navMenuLocation);

  // Name of the menu currently held in theme_settings (fall back to the first
  // saved menu, then to a sensible default for a fresh install).
  const matchingName =
    Object.keys(menus).find(
      (name) => JSON.stringify(menus[name].items) === JSON.stringify(currentItems),
    ) ?? Object.keys(menus)[0];

  const currentName = matchingName || 'Primary menu';
  const initialItems = matchingName ? menus[matchingName].items : currentItems;
  const initialLocation = matchingName ? menus[matchingName].location : currentLocation;

  return (
    <div>
      <PageHeader
        title={t('cmsappearance.menus.title')}
        description={t('cmsappearance.menus.description')}
      />

      <MenuBuilder
        pages={pages.map((page) => ({ id: page.id, title: page.title, slug: page.slug }))}
        posts={posts.map((post) => ({ id: post.id, title: post.title, slug: post.slug }))}
        initialMenus={menus}
        initialCurrentName={currentName}
        initialItems={initialItems}
        initialLocation={initialLocation}
      />
    </div>
  );
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Storefront read model for the navigation menus saved in the CMS.
 *
 * The admin writes the same data in two places (see
 * `src/app/cms/actions/theme.ts` → `saveNavMenu`):
 *
 *  1. every named menu  → `settings_store` key `nav_menus`
 *     (`Record<menuName, { items, location }>`)
 *  2. the menu being edited → `theme_settings.nav_menu` / `nav_menu_location`
 *
 * The storefront shows the *active* menu: the named menu whose items match
 * `theme_settings.nav_menu` (exactly how `src/app/cms/appearance/menus/page.tsx`
 * resolves the current menu name), then progressively falls back so the header
 * never renders emptier than before.
 *
 * Nothing in here throws — a missing/broken row resolves to an empty menu and
 * the caller keeps its hardcoded links.
 */

import { eq } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { themeSettings } from '@/db/schema-tenant';
import { readSetting } from './settings-store';
import {
  normalizeNavMenus,
  type NavMenuItem,
  type NavMenuLocation,
} from './types';

export type ActiveNavMenu = {
  /** Name of the selected menu in the CMS (`null` when only raw items exist). */
  name: string | null;
  items: NavMenuItem[];
};

export const EMPTY_ACTIVE_NAV_MENU: ActiveNavMenu = { name: null, items: [] };

function normalizeLocation(value: unknown): NavMenuLocation {
  return value === 'footer' || value === 'mobile' ? value : 'primary';
}

/**
 * The pre-CMS storefront lived at `/shop`; menus saved back then still hold
 * those paths, which 404 on this storefront (`/home`). Rewrite them onto the
 * live routes so legacy menu rows keep navigating instead of dying.
 */
function normalizeLegacyUrl(url: string): string {
  if (url === '/shop') return '/home';
  if (url.startsWith('/shop/')) return `/home${url.slice('/shop'.length)}`;
  return url;
}

/** Coerce `theme_settings.nav_menu` (jsonb array of the active menu items). */
function normalizeMenuItems(value: unknown): NavMenuItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
    )
    .slice(0, 100)
    .map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `restored-${index}`,
      label: typeof entry.label === 'string' ? entry.label : 'Untitled',
      url: normalizeLegacyUrl(typeof entry.url === 'string' ? entry.url : '#'),
      depth: entry.depth === 1 ? 1 : 0,
    }));
}

/** Stable comparison key — ignores generated ids, compares what the shopper sees. */
function itemsKey(items: NavMenuItem[]): string {
  return JSON.stringify(items.map((item) => [item.label, item.url, item.depth]));
}

/** `theme_settings` row for the active company (never throws). */
async function readActiveMenuRow(companyId?: number): Promise<{
  items: NavMenuItem[];
  location: NavMenuLocation;
}> {
  try {
    const id =
      companyId ?? (await getContextCompany().catch(() => null))?.id ?? null;
    if (!id) return { items: [], location: 'primary' };
    const db = await getContextDb();
    const [row] = await db
      .select({
        navMenu: themeSettings.navMenu,
        navMenuLocation: themeSettings.navMenuLocation,
      })
      .from(themeSettings)
      .where(eq(themeSettings.companyId, id))
      .limit(1);
    return {
      items: normalizeMenuItems(row?.navMenu),
      location: normalizeLocation(row?.navMenuLocation),
    };
  } catch {
    return { items: [], location: 'primary' };
  }
}

/**
 * The menu the storefront should render in the header (and mobile drawer).
 *
 * Resolution order (uses both `settings_store.nav_menus` and
 * `theme_settings.nav_menu` / `nav_menu_location`, exactly like the admin):
 *  1. the active menu (`theme_settings.nav_menu`) when it belongs to the
 *     `primary` location — matched to its name so links keep their identity
 *  2. any named menu assigned to the `primary` location
 *  3. the active menu's raw items (whatever the location)
 *  4. the first saved menu
 *  5. an empty menu → the caller keeps its hardcoded links
 */
export async function getActiveNavMenu(companyId?: number): Promise<ActiveNavMenu> {
  try {
    const [stored, active] = await Promise.all([
      readSetting<unknown>('nav_menus', null),
      readActiveMenuRow(companyId),
    ]);

    const menus = normalizeNavMenus(stored);
    const entries = Object.entries(menus).filter(([, menu]) => menu.items.length > 0);

    const key = active.items.length > 0 ? itemsKey(active.items) : null;
    const matched = key ? entries.find(([, menu]) => itemsKey(menu.items) === key) : undefined;
    const primary = entries.find(([, menu]) => menu.location === 'primary');

    if (key && active.location === 'primary') {
      if (matched) return { name: matched[0], items: matched[1].items };
      return { name: null, items: active.items };
    }
    if (primary) return { name: primary[0], items: primary[1].items };
    if (key) {
      if (matched) return { name: matched[0], items: matched[1].items };
      return { name: null, items: active.items };
    }
    if (entries[0]) return { name: entries[0][0], items: entries[0][1].items };

    return EMPTY_ACTIVE_NAV_MENU;
  } catch {
    return EMPTY_ACTIVE_NAV_MENU;
  }
}

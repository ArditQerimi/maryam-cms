'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { settingsStore, themeSettings } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { getTheme } from '@/lib/theme/themes';
import { mergeCustomizations } from '@/lib/theme/types';
import {
  WIDGET_AREAS,
  WIDGET_TYPES,
  type NavMenuItem,
  type NavMenuLocation,
  type NavMenus,
  type ThemeCustomizations,
  type WidgetAreaKey,
  type WidgetInstance,
  type WidgetLayout,
} from '@/lib/theme/types';

export type ActionResult = { ok: boolean; error?: string };

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

async function requireCompany() {
  await requireCmsSession();
  return getContextCompany();
}

/** Upsert the single `theme_settings` row for a company (unique on company_id). */
async function patchThemeSettings(
  companyId: number,
  patch: Partial<{
    activeTheme: string;
    customizations: unknown;
    navMenu: unknown;
    navMenuLocation: string;
    footerConfig: unknown;
    widgets: unknown;
  }>,
) {
  const db = await getContextDb();
  const [existing] = await db
    .select({ id: themeSettings.id })
    .from(themeSettings)
    .where(eq(themeSettings.companyId, companyId))
    .limit(1);

  if (existing) {
    await db
      .update(themeSettings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(themeSettings.id, existing.id));
    return;
  }

  await db.insert(themeSettings).values({ companyId, ...patch });
}

async function readSettingsKey(key: string): Promise<unknown> {
  const db = await getContextDb();
  const [row] = await db
    .select({ value: settingsStore.value })
    .from(settingsStore)
    .where(eq(settingsStore.key, key))
    .limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

async function writeSettingsKey(key: string, value: unknown): Promise<void> {
  const db = await getContextDb();
  const serialized = JSON.stringify(value);
  const [existing] = await db
    .select({ id: settingsStore.id })
    .from(settingsStore)
    .where(eq(settingsStore.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(settingsStore)
      .set({ value: serialized, updatedAt: new Date() })
      .where(eq(settingsStore.id, existing.id));
    return;
  }

  await db.insert(settingsStore).values({ key, value: serialized });
}

function slice(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function normalizeMenuItem(item: Partial<NavMenuItem>, index: number): NavMenuItem {
  return {
    id: slice(item.id, 60) || `item-${index}-${Date.now().toString(36)}`,
    label: slice(item.label, 160) || 'Untitled',
    url: slice(item.url, 500) || '#',
    depth: item.depth === 1 ? 1 : 0,
  };
}

function normalizeWidgets(value: unknown): WidgetInstance[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is WidgetInstance => Boolean(entry) && typeof entry === 'object')
    .slice(0, 30)
    .map((entry, index) => ({
      id: slice(entry.id, 60) || `w-${index}-${Date.now().toString(36)}`,
      type: (WIDGET_TYPES as readonly string[]).includes(String(entry.type))
        ? (entry.type as WidgetInstance['type'])
        : 'text',
      settings: {
        title: slice(entry.settings?.title, 200),
        limit: Number(entry.settings?.limit) > 0 ? Math.min(Number(entry.settings?.limit), 50) : 5,
        html: slice(entry.settings?.html, 5000),
        links: Array.isArray(entry.settings?.links)
          ? entry.settings.links
              .slice(0, 20)
              .map((link: { label?: string; url?: string }) => ({
                label: slice(link?.label, 120),
                url: slice(link?.url, 500),
              }))
          : [],
      },
    }));
}

/* -------------------------------------------------------------------------- */
/* Appearance — themes                                                         */
/* -------------------------------------------------------------------------- */

export async function setActiveTheme(themeId: string): Promise<ActionResult> {
  try {
    await requireCompany();
    const theme = getTheme(themeId);
    if (!theme || theme.id !== themeId) {
      return { ok: false, error: 'That theme is not installed.' };
    }

    const company = await getContextCompany();
    await patchThemeSettings(company.id, { activeTheme: theme.id });

    revalidatePath('/cms/appearance/themes');
    revalidatePath('/cms/appearance/customize');
    revalidatePath('/home');
    return { ok: true };
  } catch (error) {
    console.error('[cms/appearance] setActiveTheme failed', error);
    return { ok: false, error: 'Could not activate the theme. Please try again.' };
  }
}

/** Publish every customizer panel at once (merged over the active theme first). */
export async function saveThemeCustomizations(payload: unknown): Promise<ActionResult> {
  try {
    const company = await requireCompany();
    const db = await getContextDb();
    const [row] = await db
      .select({ activeTheme: themeSettings.activeTheme })
      .from(themeSettings)
      .where(eq(themeSettings.companyId, company.id))
      .limit(1);

    const base = getTheme(row?.activeTheme);
    if (!base) return { ok: false, error: 'No active theme is installed.' };

    const customizations: ThemeCustomizations = mergeCustomizations(base, payload);

    await patchThemeSettings(company.id, { customizations });

    revalidatePath('/cms/appearance/customize');
    revalidatePath('/home');
    return { ok: true };
  } catch (error) {
    console.error('[cms/appearance] saveThemeCustomizations failed', error);
    return { ok: false, error: 'Could not save the customizations. Please try again.' };
  }
}

/** "Reset to defaults" — clears stored customizations so theme.json wins again. */
export async function resetThemeCustomizations(): Promise<ActionResult> {
  return saveThemeCustomizations({});
}

/* -------------------------------------------------------------------------- */
/* Appearance — navigation menus                                               */
/* -------------------------------------------------------------------------- */

export type SaveNavMenuInput = {
  name: string;
  items: NavMenuItem[];
  location: NavMenuLocation;
};

export async function saveNavMenu(input: SaveNavMenuInput): Promise<ActionResult> {
  try {
    await requireCompany();

    const name = slice(input?.name, 60).trim();
    if (!name) return { ok: false, error: 'Give the menu a name first.' };

    const location: NavMenuLocation =
      input.location === 'footer' || input.location === 'mobile' ? input.location : 'primary';
    const items = (Array.isArray(input.items) ? input.items : [])
      .slice(0, 100)
      .map((item, index) => normalizeMenuItem(item, index));

    // 1. Currently edited menu → theme_settings.nav_menu / nav_menu_location
    await patchThemeSettings((await getContextCompany()).id, {
      navMenu: items,
      navMenuLocation: location,
    });

    // 2. All named menus → settings_store key `nav_menus`
    const existingMenus = await readSettingsKey('nav_menus');
    const menus: NavMenus =
      existingMenus && typeof existingMenus === 'object' && !Array.isArray(existingMenus)
        ? (existingMenus as NavMenus)
        : {};
    menus[name] = { items, location };
    await writeSettingsKey('nav_menus', menus);

    revalidatePath('/cms/appearance/menus');
    revalidatePath('/home');
    return { ok: true };
  } catch (error) {
    console.error('[cms/appearance] saveNavMenu failed', error);
    return { ok: false, error: 'Could not save the menu. Please try again.' };
  }
}

/* -------------------------------------------------------------------------- */
/* Appearance — widgets                                                        */
/* -------------------------------------------------------------------------- */

function normalizeLayout(value: unknown): WidgetLayout {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<WidgetLayout>;
  const layout = { sidebar: [], homepage: [], footer: [] } as WidgetLayout;
  for (const area of WIDGET_AREAS) {
    layout[area] = normalizeWidgets(source[area as WidgetAreaKey]);
  }
  return layout;
}

export async function saveWidgets(layout: unknown): Promise<ActionResult> {
  try {
    const company = await requireCompany();
    const normalized = normalizeLayout(layout);

    // Persisted in both places: settings_store (`widgets`) is the source of
    // truth for the admin, theme_settings.widgets for storefront consumers.
    await writeSettingsKey('widgets', normalized);
    await patchThemeSettings(company.id, { widgets: normalized });

    revalidatePath('/cms/appearance/widgets');
    revalidatePath('/home');
    return { ok: true };
  } catch (error) {
    console.error('[cms/appearance] saveWidgets failed', error);
    return { ok: false, error: 'Could not save the widget layout. Please try again.' };
  }
}

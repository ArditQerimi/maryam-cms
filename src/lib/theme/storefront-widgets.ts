/**
 * Storefront read model for the widget layout saved in the CMS.
 *
 * Mirrors `src/app/cms/appearance/widgets/page.tsx`: `settings_store.widgets`
 * is the source of truth, `theme_settings.widgets` is the fallback for fresh
 * installs that only seeded the column. Everything is normalized through
 * `normalizeWidgetLayout` and never throws — an unreadable store yields an
 * empty layout so the storefront simply renders no widgets.
 */

import { eq } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { themeSettings } from '@/db/schema-tenant';
import { readSetting } from './settings-store';
import {
  WIDGET_AREAS,
  normalizeWidgetLayout,
  type WidgetAreaKey,
  type WidgetInstance,
  type WidgetLayout,
} from './types';

function emptyLayout(): WidgetLayout {
  return { sidebar: [], homepage: [], footer: [] };
}

export async function getStorefrontWidgetLayout(): Promise<WidgetLayout> {
  try {
    const stored = await readSetting<unknown>('widgets', null);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return normalizeWidgetLayout(stored);
    }
  } catch {
    // Fall through to the theme_settings column below.
  }

  try {
    const company = await getContextCompany();
    const db = await getContextDb();
    const [row] = await db
      .select({ widgets: themeSettings.widgets })
      .from(themeSettings)
      .where(eq(themeSettings.companyId, company.id))
      .limit(1);
    if (row) return normalizeWidgetLayout(row.widgets);
  } catch {
    // Fall through to the empty layout.
  }

  return emptyLayout();
}

/** Widgets configured for one area (`sidebar` | `homepage` | `footer`). */
export async function getStorefrontWidgets(area: WidgetAreaKey): Promise<WidgetInstance[]> {
  if (!(WIDGET_AREAS as readonly string[]).includes(area)) return [];
  try {
    const layout = await getStorefrontWidgetLayout();
    return layout[area] ?? [];
  } catch {
    return [];
  }
}

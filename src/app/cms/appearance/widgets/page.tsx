import { eq } from 'drizzle-orm';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { settingsStore, themeSettings } from '@/db/schema-tenant';
import { PageHeader } from '@/components/admin/ui';
import WidgetsManager from '@/components/appearance/WidgetsManager';
import {
  WIDGET_AREAS,
  WIDGET_TYPES,
  type WidgetAreaKey,
  type WidgetInstance,
  type WidgetLayout,
} from '@/lib/theme/types';

export const dynamic = 'force-dynamic';

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeWidgets(raw: unknown): WidgetInstance[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Partial<WidgetInstance> => Boolean(entry) && typeof entry === 'object')
    .slice(0, 30)
    .map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `restored-${index}`,
      type: (WIDGET_TYPES as readonly string[]).includes(String(entry.type))
        ? (entry.type as WidgetType)
        : 'text',
      settings: {
        title: typeof entry.settings?.title === 'string' ? entry.settings.title : '',
        limit: Number(entry.settings?.limit) > 0 ? Number(entry.settings?.limit) : 5,
        html: typeof entry.settings?.html === 'string' ? entry.settings.html : '',
        links: Array.isArray(entry.settings?.links)
          ? entry.settings.links
          : [],
      },
    }));
}

type WidgetType = (typeof WIDGET_TYPES)[number];

function normalizeLayout(raw: unknown): WidgetLayout {
  const source = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Partial<
    Record<WidgetAreaKey, unknown>
  >;
  const layout = { sidebar: [], homepage: [], footer: [] } as WidgetLayout;
  for (const area of WIDGET_AREAS) {
    layout[area] = normalizeWidgets(source[area]);
  }
  return layout;
}

export default async function WidgetsPage() {
  await requireCmsSession();

  let layout: WidgetLayout = { sidebar: [], homepage: [], footer: [] };

  try {
    const company = await getContextCompany();
    const db = await getContextDb();

    // `settings_store.widgets` is the admin's source of truth; fall back to
    // theme_settings.widgets for fresh installs that only seeded the column.
    const [stored] = await db
      .select({ value: settingsStore.value })
      .from(settingsStore)
      .where(eq(settingsStore.key, 'widgets'))
      .limit(1);

    if (stored) {
      layout = normalizeLayout(parseJson(stored.value));
    } else {
      const [row] = await db
        .select({ widgets: themeSettings.widgets })
        .from(themeSettings)
        .where(eq(themeSettings.companyId, company.id))
        .limit(1);
      layout = normalizeLayout(row?.widgets);
    }
  } catch (error) {
    console.error('[cms/appearance] could not load widgets', error);
  }

  return (
    <div>
      <PageHeader
        title="Widgets"
        description="Drag widgets into the sidebar, homepage and footer areas, then save the layout."
      />
      <WidgetsManager initialLayout={layout} />
    </div>
  );
}

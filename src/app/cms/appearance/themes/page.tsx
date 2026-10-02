import { eq } from 'drizzle-orm';
import { Palette } from 'lucide-react';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { themeSettings } from '@/db/schema-tenant';
import { DEFAULT_THEME_ID, getAvailableThemes } from '@/lib/theme/themes';
import { getT } from '@/lib/i18n/server';
import { EmptyState, PageHeader } from '@/components/admin/ui';
import ThemeGrid from '@/components/appearance/ThemeGrid';

export const dynamic = 'force-dynamic';

async function getActiveThemeId(): Promise<string> {
  try {
    const company = await getContextCompany();
    const db = await getContextDb();
    const [row] = await db
      .select({ activeTheme: themeSettings.activeTheme })
      .from(themeSettings)
      .where(eq(themeSettings.companyId, company.id))
      .limit(1);
    return row?.activeTheme || DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export default async function ThemesPage() {
  await requireCmsSession();
  const t = await getT();

  const [themes, activeId] = await Promise.all([getAvailableThemes(), getActiveThemeId()]);

  return (
    <div>
      <PageHeader
        title={t('cmsappearance.themes.title')}
        description={t('cmsappearance.themes.description')}
      />

      {themes.length === 0 ? (
        <EmptyState
          title={t('cmsappearance.themes.emptyTitle')}
          description={t('cmsappearance.themes.emptyDescription')}
          icon={<Palette size={28} />}
        />
      ) : (
        <ThemeGrid themes={themes} activeId={activeId} />
      )}
    </div>
  );
}

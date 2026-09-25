import { eq } from 'drizzle-orm';
import { Palette } from 'lucide-react';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { themeSettings } from '@/db/schema-tenant';
import { DEFAULT_THEME_ID, getTheme } from '@/lib/theme/themes';
import { mergeCustomizations } from '@/lib/theme/types';
import { EmptyState, PageHeader } from '@/components/admin/ui';
import Customizer from '@/components/appearance/Customizer';

export const dynamic = 'force-dynamic';

export default async function CustomizePage() {
  await requireCmsSession();

  let activeTheme = DEFAULT_THEME_ID;
  let savedCustomizations: unknown = {};

  try {
    const company = await getContextCompany();
    const db = await getContextDb();
    const [row] = await db
      .select({
        activeTheme: themeSettings.activeTheme,
        customizations: themeSettings.customizations,
      })
      .from(themeSettings)
      .where(eq(themeSettings.companyId, company.id))
      .limit(1);
    if (row) {
      activeTheme = row.activeTheme || DEFAULT_THEME_ID;
      savedCustomizations = row.customizations;
    }
  } catch (error) {
    console.error('[cms/appearance] could not load theme_settings', error);
  }

  const theme = getTheme(activeTheme);

  return (
    <div>
      <PageHeader
        title="Theme customizer"
        description="Edit colours, typography and content blocks with a live preview of the storefront."
      />

      {theme ? (
        <Customizer theme={theme} initial={mergeCustomizations(theme, savedCustomizations)} />
      ) : (
        <EmptyState
          title="No theme installed"
          description="Add src/themes/<id>/theme.json to make a theme available for customization."
          icon={<Palette size={28} />}
        />
      )}
    </div>
  );
}

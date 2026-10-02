import { eq } from 'drizzle-orm';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextDb } from '@/lib/tenant';
import { settingsStore } from '@/db/schema-tenant';
import { PageHeader } from '@/components/admin/ui';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsCard';
import SettingsForm from '@/components/settings/SettingsForm';
import TaxRatesTable, { type TaxRateRow } from '@/components/settings/TaxRatesTable';
import { saveTaxPreferences, loadTaxRates } from '@/app/cms/actions/settings';
import { getT, type Translator } from '@/lib/i18n/server';
import type { SettingField, SettingsValues } from '@/components/settings/types';

export const dynamic = 'force-dynamic';

type TaxPreferences = { pricesIncludeTax: boolean; showTotals: 'itemised' | 'single' };

const DEFAULT_PREFERENCES: TaxPreferences = {
  pricesIncludeTax: false,
  showTotals: 'itemised',
};

function buildFields(t: Translator): SettingField[] {
  return [
  {
    kind: 'toggle',
    key: 'tax_prices_include_tax',
    label: t('cmssettings.tax.pricesIncludeLabel'),
    hint: t('cmssettings.tax.pricesIncludeHint'),
  },
  {
    kind: 'radio',
    key: 'tax_show_totals',
    label: t('cmssettings.tax.showTotalsLabel'),
    options: [
      { value: 'itemised', label: t('cmssettings.tax.showTotalsItemised') },
      { value: 'single', label: t('cmssettings.tax.showTotalsSingle') },
    ],
  },
  ];
}

async function loadTaxPreferences(): Promise<TaxPreferences> {
  try {
    const db = await getContextDb();
    const [row] = await db
      .select({ value: settingsStore.value })
      .from(settingsStore)
      .where(eq(settingsStore.key, 'tax_preferences'))
      .limit(1);
    if (!row) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(row.value) as Partial<TaxPreferences>;
    return {
      pricesIncludeTax: parsed.pricesIncludeTax === true,
      showTotals: parsed.showTotals === 'single' ? 'single' : 'itemised',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default async function TaxSettingsPage() {
  await requireCmsSession();
  const t = await getT();

  const [preferences, rows] = await Promise.all([loadTaxPreferences(), loadTaxRates()]);

  const initialValues: SettingsValues = {
    tax_prices_include_tax: preferences.pricesIncludeTax,
    tax_show_totals: preferences.showTotals,
  };

  const rateRows: TaxRateRow[] = rows.map((row) => ({
    id: row.id,
    country: row.country,
    state: row.state,
    postcode: row.postcode,
    rate: row.rate,
    name: row.name,
    shipping: row.shipping,
    enabled: row.enabled,
  }));

  return (
    <div>
      <PageHeader
        title={t('cmssettings.tax.title')}
        description={t('cmssettings.tax.description')}
      />

      <div className="space-y-6">
        <div className="max-w-3xl">
          <SettingsCard
            title={t('cmssettings.tax.optionsCardTitle')}
            description={t('cmssettings.tax.optionsCardDescription')}
          >
            <SettingsForm
              fields={buildFields(t)}
              initialValues={initialValues}
              onSubmit={saveTaxPreferences}
              columns={1}
              saveLabel={t('cmssettings.common.saveChanges')}
            >
              <SettingsSection title={t('cmssettings.tax.sectionTitle')}>
                <p className="text-xs text-zinc-500">
                  {preferences.pricesIncludeTax
                    ? t('cmssettings.tax.pricesIncludeTax')
                    : t('cmssettings.tax.pricesExcludeTax')}{' '}
                  {t('cmssettings.tax.totalsShown')}{' '}
                  <span className="font-medium text-zinc-700">
                    {preferences.showTotals === 'single'
                      ? t('cmssettings.tax.totalSingle')
                      : t('cmssettings.tax.totalItemised')}
                  </span>
                  .
                </p>
              </SettingsSection>
            </SettingsForm>
          </SettingsCard>
        </div>

        <SettingsCard
          title={t('cmssettings.tax.ratesCardTitle')}
          description={t('cmssettings.tax.ratesCardDescription')}
        >
          <TaxRatesTable initialRows={rateRows} />
        </SettingsCard>
      </div>
    </div>
  );
}

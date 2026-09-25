import { eq } from 'drizzle-orm';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextDb } from '@/lib/tenant';
import { settingsStore } from '@/db/schema-tenant';
import { PageHeader } from '@/components/admin/ui';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsCard';
import SettingsForm from '@/components/settings/SettingsForm';
import TaxRatesTable, { type TaxRateRow } from '@/components/settings/TaxRatesTable';
import { saveTaxPreferences, loadTaxRates } from '@/app/cms/actions/settings';
import type { SettingField, SettingsValues } from '@/components/settings/types';

export const dynamic = 'force-dynamic';

type TaxPreferences = { pricesIncludeTax: boolean; showTotals: 'itemised' | 'single' };

const DEFAULT_PREFERENCES: TaxPreferences = {
  pricesIncludeTax: false,
  showTotals: 'itemised',
};

const FIELDS: SettingField[] = [
  {
    kind: 'toggle',
    key: 'tax_prices_include_tax',
    label: 'Prices entered tax inclusive',
    hint: 'Product prices already contain tax. Turn off to add tax at checkout.',
  },
  {
    kind: 'radio',
    key: 'tax_show_totals',
    label: 'Display tax totals',
    options: [
      { value: 'itemised', label: 'Itemised — show each tax rate as its own line' },
      { value: 'single', label: 'Single total — one combined tax line' },
    ],
  },
];

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
        title="Tax"
        description="Define how prices include tax and manage the rates applied at checkout."
      />

      <div className="space-y-6">
        <div className="max-w-3xl">
          <SettingsCard
            title="Tax options"
            description="Global behaviour shared by the cart, checkout and invoices."
          >
            <SettingsForm
              fields={FIELDS}
              initialValues={initialValues}
              onSubmit={saveTaxPreferences}
              columns={1}
            >
              <SettingsSection title="Currently applied">
                <p className="text-xs text-zinc-500">
                  {preferences.pricesIncludeTax
                    ? 'Product prices include tax.'
                    : 'Tax is added on top of product prices.'}{' '}
                  Totals are shown{' '}
                  <span className="font-medium text-zinc-700">
                    {preferences.showTotals === 'single' ? 'as a single total' : 'itemised'}
                  </span>
                  .
                </p>
              </SettingsSection>
            </SettingsForm>
          </SettingsCard>
        </div>

        <SettingsCard
          title="Tax rates"
          description="Country / state / postcode specific rates. Leave country blank to apply everywhere."
        >
          <TaxRatesTable initialRows={rateRows} />
        </SettingsCard>
      </div>
    </div>
  );
}

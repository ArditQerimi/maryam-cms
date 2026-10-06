import { desc, like } from 'drizzle-orm';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextDb } from '@/lib/tenant';
import { settingsStore } from '@/db/schema-tenant';
import { formatDate, formatMoney } from '@/lib/cms/format';
import { getT, type Translator } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsCard';
import SettingsForm from '@/components/settings/SettingsForm';
import { loadSettingsByPrefix, saveGeneralSettings } from '@/app/cms/actions/settings';
import { withDefaults, type SettingField, type SettingsValues } from '@/components/settings/types';

export const dynamic = 'force-dynamic';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_DOMAIN ? `http://${process.env.NEXT_PUBLIC_DOMAIN}` : 'http://localhost:3003');

const DEFAULTS: SettingsValues = {
  general_site_title: 'Maryam Store',
  general_tagline: '',
  general_site_url: SITE_URL,
  general_admin_email: '',
  general_timezone: 'Europe/Tirane',
  general_date_format: 'd/m/Y',
  general_time_format: 'H:i',
  general_currency: 'EUR',
  general_currency_position: 'before',
  general_decimal_separator: '.',
  general_map_coordinates: '',
  general_whatsapp_number: '',
};

function buildFields(t: Translator): SettingField[] {
  return [
  { kind: 'text', key: 'general_site_title', label: t('cmssettings.general.siteTitleLabel'), placeholder: t('cmssettings.general.siteTitlePlaceholder') },
  { kind: 'text', key: 'general_tagline', label: t('cmssettings.general.taglineLabel'), placeholder: t('cmssettings.general.taglinePlaceholder') },
  {
    kind: 'text',
    key: 'general_site_url',
    label: t('cmssettings.general.siteUrlLabel'),
    disabled: true,
    inputType: 'url',
    hint: t('cmssettings.general.siteUrlHint'),
  },
  {
    kind: 'text',
    key: 'general_admin_email',
    label: t('cmssettings.general.adminEmailLabel'),
    inputType: 'email',
    placeholder: 'admin@example.com',
  },
  {
    kind: 'text',
    key: 'general_whatsapp_number',
    label: t('cmssettings.general.whatsappLabel'),
    placeholder: '+383 44 123 456',
    hint: t('cmssettings.general.whatsappHint'),
  },
  {
    kind: 'text',
    key: 'general_map_coordinates',
    label: t('cmssettings.general.mapCoordinatesLabel'),
    placeholder: '42.6673, 21.1667',
    hint: t('cmssettings.general.mapCoordinatesHint'),
  },
  {
    kind: 'select',
    key: 'general_timezone',
    label: t('cmssettings.general.timezoneLabel'),
    options: [
      'UTC',
      'Europe/Tirane',
      'Europe/London',
      'Europe/Dublin',
      'Europe/Lisbon',
      'Europe/Madrid',
      'Europe/Paris',
      'Europe/Brussels',
      'Europe/Amsterdam',
      'Europe/Berlin',
      'Europe/Zurich',
      'Europe/Vienna',
      'Europe/Prague',
      'Europe/Warsaw',
      'Europe/Stockholm',
      'Europe/Oslo',
      'Europe/Copenhagen',
      'Europe/Helsinki',
      'Europe/Athens',
      'Europe/Bucharest',
      'Europe/Sofia',
      'Europe/Istanbul',
      'Europe/Kyiv',
      'Europe/Moscow',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Sao_Paulo',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Shanghai',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Africa/Cairo',
      'Africa/Johannesburg',
    ].map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') })),
  },
  {
    kind: 'select',
    key: 'general_date_format',
    label: t('cmssettings.general.dateFormatLabel'),
    options: [
      { value: 'd/m/Y', label: '25/09/2026' },
      { value: 'm/d/Y', label: '09/25/2026' },
      { value: 'Y-m-d', label: '2026-09-25' },
      { value: 'j M Y', label: '25 Sep 2026' },
      { value: 'l, j F Y', label: 'Friday, 25 September 2026' },
    ],
  },
  {
    kind: 'select',
    key: 'general_time_format',
    label: t('cmssettings.general.timeFormatLabel'),
    options: [
      { value: 'H:i', label: '14:32' },
      { value: 'g:i A', label: '2:32 PM' },
      { value: 'g:ia', label: '2:32pm' },
    ],
  },
  {
    kind: 'select',
    key: 'general_currency',
    label: t('cmssettings.general.currencyLabel'),
    options: [
      { value: 'EUR', label: t('cmssettings.general.currencyEur') },
      { value: 'USD', label: t('cmssettings.general.currencyUsd') },
      { value: 'GBP', label: t('cmssettings.general.currencyGbp') },
      { value: 'ALL', label: t('cmssettings.general.currencyAll') },
      { value: 'MKD', label: t('cmssettings.general.currencyMkd') },
      { value: 'RSD', label: t('cmssettings.general.currencyRsd') },
    ],
  },
  {
    kind: 'select',
    key: 'general_currency_position',
    label: t('cmssettings.general.currencyPositionLabel'),
    options: [
      { value: 'before', label: t('cmssettings.general.currencyPositionBefore') },
      { value: 'after', label: t('cmssettings.general.currencyPositionAfter') },
    ],
  },
  {
    kind: 'select',
    key: 'general_decimal_separator',
    label: t('cmssettings.general.decimalSeparatorLabel'),
    options: [
      { value: '.', label: t('cmssettings.general.decimalSeparatorPoint') },
      { value: ',', label: t('cmssettings.general.decimalSeparatorComma') },
    ],
  },
  ];
}

export default async function GeneralSettingsPage() {
  await requireCmsSession();
  const t = await getT();

  const [loaded, lastUpdated] = await Promise.all([
    loadSettingsByPrefix('general_'),
    getLastUpdated(),
  ]);
  const values = withDefaults(DEFAULTS, loaded);

  const currency = typeof values.general_currency === 'string' ? values.general_currency : 'EUR';

  return (
    <div>
      <PageHeader
        title={t('cmssettings.general.title')}
        description={t('cmssettings.general.description')}
      />

      <div className="max-w-4xl space-y-6">
        <SettingsCard
          title={t('cmssettings.general.cardTitle')}
          description={t('cmssettings.general.cardDescription')}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
              <span>
                {t('cmssettings.general.exampleLabel')}{' '}
                <span className="font-medium text-zinc-700">{formatMoney(1234.5, currency)}</span>
                {' · '}
                {formatDate(new Date())}
              </span>
              <span>
                {lastUpdated
                  ? t('cmssettings.general.lastUpdated', {
                      date: formatDate(lastUpdated, true),
                    })
                  : t('cmssettings.general.notSavedYet')}
              </span>
            </div>
          }
        >
          <SettingsForm
            fields={buildFields(t)}
            initialValues={values}
            onSubmit={saveGeneralSettings}
            saveLabel={t('cmssettings.common.saveChanges')}
          >
            <SettingsSection
              title={t('cmssettings.general.sectionTitle')}
              hint={t('cmssettings.general.sectionHint')}
            >
              <p className="text-xs text-zinc-500">
                {t('cmssettings.general.summaryTimezone')}{' '}
                <span className="font-medium text-zinc-700">{String(values.general_timezone)}</span>
                {t('cmssettings.general.summaryDates')}{' '}
                <span className="font-medium text-zinc-700">{String(values.general_date_format)}</span>.
              </p>
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

async function getLastUpdated(): Promise<Date | null> {
  try {
    const db = await getContextDb();
    const [row] = await db
      .select({ updatedAt: settingsStore.updatedAt })
      .from(settingsStore)
      .where(like(settingsStore.key, 'general_%'))
      .orderBy(desc(settingsStore.updatedAt))
      .limit(1);
    return row?.updatedAt ?? null;
  } catch {
    return null;
  }
}

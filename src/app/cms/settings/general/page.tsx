import { desc, like } from 'drizzle-orm';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextDb } from '@/lib/tenant';
import { settingsStore } from '@/db/schema-tenant';
import { formatDate, formatMoney } from '@/lib/cms/format';
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
};

const FIELDS: SettingField[] = [
  { kind: 'text', key: 'general_site_title', label: 'Site title', placeholder: 'My store' },
  { kind: 'text', key: 'general_tagline', label: 'Tagline', placeholder: 'Just another store' },
  {
    kind: 'text',
    key: 'general_site_url',
    label: 'Site URL (WordPress address)',
    disabled: true,
    inputType: 'url',
    hint: 'Read-only — comes from the environment configuration.',
  },
  {
    kind: 'text',
    key: 'general_admin_email',
    label: 'Administration email address',
    inputType: 'email',
    placeholder: 'admin@example.com',
  },
  {
    kind: 'select',
    key: 'general_timezone',
    label: 'Timezone',
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
    label: 'Date format',
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
    label: 'Time format',
    options: [
      { value: 'H:i', label: '14:32' },
      { value: 'g:i A', label: '2:32 PM' },
      { value: 'g:ia', label: '2:32pm' },
    ],
  },
  {
    kind: 'select',
    key: 'general_currency',
    label: 'Currency',
    options: [
      { value: 'EUR', label: 'EUR — Euro (€)' },
      { value: 'USD', label: 'USD — US Dollar ($)' },
      { value: 'GBP', label: 'GBP — Pound Sterling (£)' },
      { value: 'ALL', label: 'ALL — Albanian Lek (L)' },
      { value: 'MKD', label: 'MKD — Macedonian Denar (ден)' },
      { value: 'RSD', label: 'RSD — Serbian Dinar (дин.)' },
    ],
  },
  {
    kind: 'select',
    key: 'general_currency_position',
    label: 'Currency symbol position',
    options: [
      { value: 'before', label: 'Before amount — €1,234.56' },
      { value: 'after', label: 'After amount — 1,234.56 €' },
    ],
  },
  {
    kind: 'select',
    key: 'general_decimal_separator',
    label: 'Decimal separator',
    options: [
      { value: '.', label: 'Point (.) — 1234.56' },
      { value: ',', label: 'Comma (,) — 1234,56' },
    ],
  },
];

export default async function GeneralSettingsPage() {
  await requireCmsSession();

  const [loaded, lastUpdated] = await Promise.all([
    loadSettingsByPrefix('general_'),
    getLastUpdated(),
  ]);
  const values = withDefaults(DEFAULTS, loaded);

  const currency = typeof values.general_currency === 'string' ? values.general_currency : 'EUR';

  return (
    <div>
      <PageHeader
        title="General settings"
        description="Site identity, admin contact, localisation and formatting defaults."
      />

      <div className="max-w-4xl space-y-6">
        <SettingsCard
          title="Site settings"
          description="Shown across the storefront, admin and outgoing emails."
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
              <span>
                Example:{' '}
                <span className="font-medium text-zinc-700">{formatMoney(1234.5, currency)}</span>
                {' · '}
                {formatDate(new Date())}
              </span>
              <span>{lastUpdated ? `Last updated ${formatDate(lastUpdated, true)}` : 'Not saved yet'}</span>
            </div>
          }
        >
          <SettingsForm fields={FIELDS} initialValues={values} onSubmit={saveGeneralSettings}>
            <SettingsSection title="Localisation" hint="Applies to prices, receipts and scheduled content.">
              <p className="text-xs text-zinc-500">
                Timezone <span className="font-medium text-zinc-700">{String(values.general_timezone)}</span>,
                dates as <span className="font-medium text-zinc-700">{String(values.general_date_format)}</span>.
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

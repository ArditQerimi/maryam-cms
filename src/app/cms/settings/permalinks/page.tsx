import { requireCmsSession } from '@/lib/cms/session';
import { getT, type Translator } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsCard';
import SettingsForm from '@/components/settings/SettingsForm';
import { loadSettingsByPrefix, savePermalinkSettings } from '@/app/cms/actions/settings';
import { withDefaults, type SettingField, type SettingsValues } from '@/components/settings/types';

export const dynamic = 'force-dynamic';

const DEFAULTS: SettingsValues = {
  permalink_structure: 'post_name',
  permalink_custom_mask: '/%year%/%monthnum%/%postname%/',
};

function buildFields(t: Translator): SettingField[] {
  return [
  {
    kind: 'permalink',
    key: 'permalink_structure',
    customKey: 'permalink_custom_mask',
    label: t('cmssettings.permalinks.fieldLabel'),
    options: [
      { value: 'plain', label: t('cmssettings.permalinks.optionPlain'), example: '/?p=123' },
      {
        value: 'day_name',
        label: t('cmssettings.permalinks.optionDayName'),
        example: '/2026/09/25/sample-post/',
      },
      {
        value: 'month_name',
        label: t('cmssettings.permalinks.optionMonthName'),
        example: '/2026/09/sample-post/',
      },
      {
        value: 'post_name',
        label: t('cmssettings.permalinks.optionPostName'),
        example: '/sample-post/',
      },
      {
        value: 'custom',
        label: t('cmssettings.permalinks.optionCustom'),
        example: '/%year%/%monthnum%/%postname%/',
      },
    ],
  },
  ];
}

export default async function PermalinkSettingsPage() {
  await requireCmsSession();
  const t = await getT();
  const loaded = await loadSettingsByPrefix('permalink_');
  const values = withDefaults(DEFAULTS, loaded);

  return (
    <div>
      <PageHeader
        title={t('cmssettings.permalinks.title')}
        description={t('cmssettings.permalinks.description')}
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          title={t('cmssettings.permalinks.cardTitle')}
          description={t('cmssettings.permalinks.cardDescription')}
        >
          <SettingsForm
            fields={buildFields(t)}
            initialValues={values}
            onSubmit={savePermalinkSettings}
            columns={1}
            saveLabel={t('cmssettings.common.saveChanges')}
          >
            <SettingsSection title={t('cmssettings.permalinks.sectionTitle')}>
              <p className="text-xs text-zinc-500">
                {t('cmssettings.permalinks.sectionBody')}
              </p>
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

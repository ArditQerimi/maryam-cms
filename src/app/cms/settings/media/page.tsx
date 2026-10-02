import { requireCmsSession } from '@/lib/cms/session';
import { getT, type Translator } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsCard';
import SettingsForm from '@/components/settings/SettingsForm';
import { loadSettingsByPrefix, saveMediaSettings } from '@/app/cms/actions/settings';
import { withDefaults, type SettingField, type SettingsValues } from '@/components/settings/types';

export const dynamic = 'force-dynamic';

const DEFAULTS: SettingsValues = {
  media_thumb_width: '150',
  media_thumb_height: '150',
  media_medium_width: '300',
  media_medium_height: '300',
  media_large_width: '1024',
  media_large_height: '1024',
  media_organise_folders: false,
};

function sizeFields(t: Translator, label: string, widthKey: string, heightKey: string): SettingField[] {
  return [
    { kind: 'number', key: widthKey, label: t('cmssettings.media.sizeWidth', { size: label }), min: 0, max: 4000, suffix: 'px' },
    { kind: 'number', key: heightKey, label: t('cmssettings.media.sizeHeight', { size: label }), min: 0, max: 4000, suffix: 'px' },
  ];
}

function buildFields(t: Translator): SettingField[] {
  return [
  ...sizeFields(t, t('cmssettings.media.sizeThumbnail'), 'media_thumb_width', 'media_thumb_height'),
  ...sizeFields(t, t('cmssettings.media.sizeMedium'), 'media_medium_width', 'media_medium_height'),
  ...sizeFields(t, t('cmssettings.media.sizeLarge'), 'media_large_width', 'media_large_height'),
  {
    kind: 'toggle',
    key: 'media_organise_folders',
    label: t('cmssettings.media.organiseLabel'),
    hint: t('cmssettings.media.organiseHint'),
  },
  ];
}

export default async function MediaSettingsPage() {
  await requireCmsSession();
  const t = await getT();
  const loaded = await loadSettingsByPrefix('media_');
  const values = withDefaults(DEFAULTS, loaded);

  return (
    <div>
      <PageHeader
        title={t('cmssettings.media.title')}
        description={t('cmssettings.media.description')}
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          title={t('cmssettings.media.cardTitle')}
          description={t('cmssettings.media.cardDescription')}
        >
          <SettingsForm
            fields={buildFields(t)}
            initialValues={values}
            onSubmit={saveMediaSettings}
            saveLabel={t('cmssettings.common.saveChanges')}
          >
            <SettingsSection title={t('cmssettings.media.sectionTitle')}>
              <p className="text-xs text-zinc-500">
                {values.media_organise_folders
                  ? t('cmssettings.media.uploadsOrganised')
                  : t('cmssettings.media.uploadsFlat')}
              </p>
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

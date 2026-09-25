import { requireCmsSession } from '@/lib/cms/session';
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

function sizeFields(label: string, widthKey: string, heightKey: string): SettingField[] {
  return [
    { kind: 'number', key: widthKey, label: `${label} width`, min: 0, max: 4000, suffix: 'px' },
    { kind: 'number', key: heightKey, label: `${label} height`, min: 0, max: 4000, suffix: 'px' },
  ];
}

const FIELDS: SettingField[] = [
  ...sizeFields('Thumbnail size', 'media_thumb_width', 'media_thumb_height'),
  ...sizeFields('Medium size', 'media_medium_width', 'media_medium_height'),
  ...sizeFields('Large size', 'media_large_width', 'media_large_height'),
  {
    kind: 'toggle',
    key: 'media_organise_folders',
    label: 'Organise uploads into month-based folders',
    hint: 'New files are stored under /2026/09/ style paths.',
  },
];

export default async function MediaSettingsPage() {
  await requireCmsSession();
  const loaded = await loadSettingsByPrefix('media_');
  const values = withDefaults(DEFAULTS, loaded);

  return (
    <div>
      <PageHeader
        title="Media settings"
        description="Default image sizes generated for thumbnails, cards and detail views."
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          title="Image sizes"
          description="Width and height in pixels. Set to 0 to keep the original dimension."
        >
          <SettingsForm fields={FIELDS} initialValues={values} onSubmit={saveMediaSettings}>
            <SettingsSection title="Uploads">
              <p className="text-xs text-zinc-500">
                {values.media_organise_folders
                  ? 'Files are grouped into month folders, which keeps large libraries manageable.'
                  : 'Files are stored flat in the uploads root.'}
              </p>
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

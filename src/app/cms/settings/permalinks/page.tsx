import { requireCmsSession } from '@/lib/cms/session';
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

const FIELDS: SettingField[] = [
  {
    kind: 'permalink',
    key: 'permalink_structure',
    customKey: 'permalink_custom_mask',
    label: 'Common settings',
    options: [
      { value: 'plain', label: 'Plain — https://example.com/?p=123', example: '/?p=123' },
      {
        value: 'day_name',
        label: 'Day and name — https://example.com/2026/09/25/sample-post/',
        example: '/2026/09/25/sample-post/',
      },
      {
        value: 'month_name',
        label: 'Month and name — https://example.com/2026/09/sample-post/',
        example: '/2026/09/sample-post/',
      },
      {
        value: 'post_name',
        label: 'Post name — https://example.com/sample-post/',
        example: '/sample-post/',
      },
      { value: 'custom', label: 'Custom structure', example: '/%year%/%monthnum%/%postname%/' },
    ],
  },
];

export default async function PermalinkSettingsPage() {
  await requireCmsSession();
  const loaded = await loadSettingsByPrefix('permalink_');
  const values = withDefaults(DEFAULTS, loaded);

  return (
    <div>
      <PageHeader
        title="Permalinks"
        description="Choose the URL structure used for posts and pages."
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          title="Permanent link structure"
          description="Available tags for the custom structure: %year%, %monthnum%, %day%, %postname%, %post_id%, %category%, %author%."
        >
          <SettingsForm
            fields={FIELDS}
            initialValues={values}
            onSubmit={savePermalinkSettings}
            columns={1}
          >
            <SettingsSection title="Good to know">
              <p className="text-xs text-zinc-500">
                The preview shows a sample URL for the selected structure. Existing links keep
                working — permalinks are resolved from the stored slugs either way.
              </p>
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

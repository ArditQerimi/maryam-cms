import { requireCmsSession } from '@/lib/cms/session';
import { getT, type Translator } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsCard';
import SettingsForm from '@/components/settings/SettingsForm';
import { loadSettingsByPrefix, saveDiscussionSettings } from '@/app/cms/actions/settings';
import { withDefaults, type SettingField, type SettingsValues } from '@/components/settings/types';

export const dynamic = 'force-dynamic';

const DEFAULTS: SettingsValues = {
  discussion_allow_comments: true,
  discussion_moderate_comments: true,
  discussion_require_name_email: true,
  discussion_close_after_days: '14',
  discussion_notify_on_comment: true,
};

function buildFields(t: Translator): SettingField[] {
  return [
  {
    kind: 'toggle',
    key: 'discussion_allow_comments',
    label: t('cmssettings.discussion.allowCommentsLabel'),
    hint: t('cmssettings.discussion.allowCommentsHint'),
  },
  {
    kind: 'toggle',
    key: 'discussion_moderate_comments',
    label: t('cmssettings.discussion.moderateLabel'),
    hint: t('cmssettings.discussion.moderateHint'),
  },
  {
    kind: 'toggle',
    key: 'discussion_require_name_email',
    label: t('cmssettings.discussion.requireNameEmailLabel'),
    hint: t('cmssettings.discussion.requireNameEmailHint'),
  },
  {
    kind: 'toggle',
    key: 'discussion_notify_on_comment',
    label: t('cmssettings.discussion.notifyLabel'),
    hint: t('cmssettings.discussion.notifyHint'),
  },
  {
    kind: 'number',
    key: 'discussion_close_after_days',
    label: t('cmssettings.discussion.closeAfterLabel'),
    min: 0,
    max: 3650,
    suffix: t('cmssettings.discussion.closeAfterSuffix'),
    hint: t('cmssettings.discussion.closeAfterHint'),
  },
  ];
}

export default async function DiscussionSettingsPage() {
  await requireCmsSession();
  const t = await getT();
  const loaded = await loadSettingsByPrefix('discussion_');
  const values = withDefaults(DEFAULTS, loaded);

  return (
    <div>
      <PageHeader
        title={t('cmssettings.discussion.title')}
        description={t('cmssettings.discussion.description')}
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          title={t('cmssettings.discussion.cardTitle')}
          description={t('cmssettings.discussion.cardDescription')}
        >
          <SettingsForm
            fields={buildFields(t)}
            initialValues={values}
            onSubmit={saveDiscussionSettings}
            columns={1}
            saveLabel={t('cmssettings.common.saveChanges')}
          >
            <SettingsSection title={t('cmssettings.discussion.sectionTitle')}>
              <p className="text-xs text-zinc-500">
                {values.discussion_moderate_comments
                  ? t('cmssettings.discussion.moderationQueued')
                  : t('cmssettings.discussion.moderationImmediate')}
              </p>
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

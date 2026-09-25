import { requireCmsSession } from '@/lib/cms/session';
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

const FIELDS: SettingField[] = [
  {
    kind: 'toggle',
    key: 'discussion_allow_comments',
    label: 'Allow people to submit new comments',
    hint: 'Turn off to close commenting site-wide.',
  },
  {
    kind: 'toggle',
    key: 'discussion_moderate_comments',
    label: 'Hold comments for moderation',
    hint: 'New comments must be approved before they appear.',
  },
  {
    kind: 'toggle',
    key: 'discussion_require_name_email',
    label: 'Comment author must fill out name and email',
    hint: 'Anonymous comments are rejected when enabled.',
  },
  {
    kind: 'toggle',
    key: 'discussion_notify_on_comment',
    label: 'Email me when anyone comments',
    hint: 'Sends a notification to the administration email address.',
  },
  {
    kind: 'number',
    key: 'discussion_close_after_days',
    label: 'Automatically close comments after N days',
    min: 0,
    max: 3650,
    suffix: 'days',
    hint: '0 disables automatic closing.',
  },
];

export default async function DiscussionSettingsPage() {
  await requireCmsSession();
  const loaded = await loadSettingsByPrefix('discussion_');
  const values = withDefaults(DEFAULTS, loaded);

  return (
    <div>
      <PageHeader
        title="Discussion settings"
        description="Decide who can comment and how much review comments need."
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          title="Comment settings"
          description="Applies to blog posts and any page that accepts comments."
        >
          <SettingsForm
            fields={FIELDS}
            initialValues={values}
            onSubmit={saveDiscussionSettings}
            columns={1}
          >
            <SettingsSection title="Moderation">
              <p className="text-xs text-zinc-500">
                {values.discussion_moderate_comments
                  ? 'Comments are queued in the admin until you approve them.'
                  : 'Comments publish immediately.'}
              </p>
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

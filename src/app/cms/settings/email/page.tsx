import { requireCmsSession } from '@/lib/cms/session';
import { getT, type Translator } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsCard';
import SettingsForm from '@/components/settings/SettingsForm';
import TestEmailPanel from '@/components/settings/TestEmailPanel';
import { loadSettingsByPrefix, saveSmtpSettings } from '@/app/cms/actions/settings';
import { isResendConfigured, resendFromAddress, RESEND_DEFAULT_FROM } from '@/lib/email/send';
import { withDefaults, type SettingField, type SettingsValues } from '@/components/settings/types';

export const dynamic = 'force-dynamic';

const DEFAULTS: SettingsValues = {
  smtp_host: '',
  smtp_port: '587',
  smtp_encryption: 'tls',
  smtp_username: '',
  smtp_password: '',
  smtp_from_name: '',
  smtp_from_email: '',
};

function buildFields(t: Translator): SettingField[] {
  return [
  {
    kind: 'text',
    key: 'smtp_host',
    label: t('cmssettings.email.hostLabel'),
    placeholder: 'smtp.mailprovider.com',
  },
  {
    kind: 'number',
    key: 'smtp_port',
    label: t('cmssettings.email.portLabel'),
    min: 1,
    max: 65535,
    hint: t('cmssettings.email.portHint'),
  },
  {
    kind: 'select',
    key: 'smtp_encryption',
    label: t('cmssettings.email.encryptionLabel'),
    options: [
      { value: 'none', label: t('cmssettings.email.encryptionNone') },
      { value: 'tls', label: 'TLS' },
      { value: 'ssl', label: 'SSL' },
    ],
  },
  {
    kind: 'text',
    key: 'smtp_username',
    label: t('cmssettings.email.usernameLabel'),
    placeholder: t('cmssettings.email.usernamePlaceholder'),
  },
  {
    kind: 'password',
    key: 'smtp_password',
    label: t('cmssettings.email.passwordLabel'),
    placeholder: t('cmssettings.email.passwordPlaceholder'),
    hint: t('cmssettings.email.passwordHint'),
  },
  {
    kind: 'text',
    key: 'smtp_from_name',
    label: t('cmssettings.email.fromNameLabel'),
    placeholder: 'Maryam Store',
  },
  {
    kind: 'text',
    key: 'smtp_from_email',
    label: t('cmssettings.email.fromEmailLabel'),
    inputType: 'email',
    placeholder: 'shop@example.com',
  },
  ];
}

export default async function EmailSettingsPage() {
  await requireCmsSession();
  const t = await getT();
  const loaded = await loadSettingsByPrefix('smtp_');
  const values = withDefaults(DEFAULTS, loaded);
  const configured = Boolean(String(values.smtp_host || '').trim());
  const resendReady = isResendConfigured();
  const fromAddress = resendFromAddress();

  return (
    <div>
      <PageHeader
        title={t('cmssettings.email.title')}
        description={t('cmssettings.email.description')}
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          title={t('cmssettings.email.resendCardTitle')}
          description={
            resendReady
              ? t('cmssettings.email.resendActiveDescription', { from: fromAddress })
              : t('cmssettings.email.resendInactiveDescription')
          }
        >
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-full ${resendReady ? 'bg-emerald-500' : 'bg-zinc-300'}`}
              aria-hidden="true"
            />
            <span className={resendReady ? 'font-medium text-emerald-700' : 'text-zinc-500'}>
              {resendReady
                ? t('cmssettings.email.statusConfigured', { from: fromAddress })
                : t('cmssettings.email.statusNotConfigured', { from: RESEND_DEFAULT_FROM })}
            </span>
          </div>
        </SettingsCard>

        <SettingsCard
          title={t('cmssettings.email.smtpCardTitle')}
          description={
            resendReady
              ? t('cmssettings.email.smtpDescriptionResend')
              : configured
                ? t('cmssettings.email.smtpDescriptionConfigured')
                : t('cmssettings.email.smtpDescriptionEmpty')
          }
        >
          <SettingsForm
            fields={buildFields(t)}
            initialValues={values}
            onSubmit={saveSmtpSettings}
            saveLabel={t('cmssettings.common.saveChanges')}
          >
            <SettingsSection title={t('cmssettings.email.sectionTitle')}>
              <TestEmailPanel />
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

import { requireCmsSession } from '@/lib/cms/session';
import { PageHeader } from '@/components/admin/ui';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsCard';
import SettingsForm from '@/components/settings/SettingsForm';
import TestEmailPanel from '@/components/settings/TestEmailPanel';
import { loadSettingsByPrefix, saveSmtpSettings } from '@/app/cms/actions/settings';
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

const FIELDS: SettingField[] = [
  {
    kind: 'text',
    key: 'smtp_host',
    label: 'SMTP host',
    placeholder: 'smtp.mailprovider.com',
  },
  {
    kind: 'number',
    key: 'smtp_port',
    label: 'Port',
    min: 1,
    max: 65535,
    hint: '587 for TLS, 465 for SSL, 25 for unencrypted.',
  },
  {
    kind: 'select',
    key: 'smtp_encryption',
    label: 'Encryption',
    options: [
      { value: 'none', label: 'None' },
      { value: 'tls', label: 'TLS' },
      { value: 'ssl', label: 'SSL' },
    ],
  },
  { kind: 'text', key: 'smtp_username', label: 'Username', placeholder: 'SMTP user' },
  {
    kind: 'password',
    key: 'smtp_password',
    label: 'Password',
    placeholder: 'SMTP password',
    hint: 'Stored in the settings table — use an app password when available.',
  },
  {
    kind: 'text',
    key: 'smtp_from_name',
    label: 'From name',
    placeholder: 'Maryam Store',
  },
  {
    kind: 'text',
    key: 'smtp_from_email',
    label: 'From email address',
    inputType: 'email',
    placeholder: 'shop@example.com',
  },
];

export default async function EmailSettingsPage() {
  await requireCmsSession();
  const loaded = await loadSettingsByPrefix('smtp_');
  const values = withDefaults(DEFAULTS, loaded);
  const configured = Boolean(String(values.smtp_host || '').trim());

  return (
    <div>
      <PageHeader
        title="Email (SMTP)"
        description="Outgoing mail server used for order confirmations, notifications and password resets."
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          title="SMTP configuration"
          description={
            configured
              ? 'SMTP is configured — use the button below to verify it end to end.'
              : 'SMTP is not configured yet. Fill in the host, port and credentials, save, then send a test email.'
          }
        >
          <SettingsForm fields={FIELDS} initialValues={values} onSubmit={saveSmtpSettings}>
            <SettingsSection title="Test delivery">
              <TestEmailPanel />
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

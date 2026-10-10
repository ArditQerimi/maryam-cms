import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import { SettingsCard } from '@/components/settings/SettingsCard';
import WhatsAppCloudSetup from './WhatsAppCloudSetup';
import WhatsAppLink from './WhatsAppLink';

export const dynamic = 'force-dynamic';

export default async function WhatsAppSettingsPage() {
  await requireCmsSession();
  const t = await getT();
  return (
    <div>
      <PageHeader title={t('cmssettings.whatsapp.title')} description={t('cmssettings.whatsapp.description')} />
      <div className="max-w-3xl space-y-6">
        <SettingsCard title={t('cmssettings.waCloud.title')} description={t('cmssettings.waCloud.description')}>
          <WhatsAppCloudSetup />
        </SettingsCard>
        <SettingsCard title={t('cmssettings.waCloud.qrTitle')} description={t('cmssettings.waCloud.qrDescription')}>
          <WhatsAppLink />
        </SettingsCard>
      </div>
    </div>
  );
}

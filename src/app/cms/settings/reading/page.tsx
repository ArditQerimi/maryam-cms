import { asc, eq } from 'drizzle-orm';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextDb } from '@/lib/tenant';
import { cmsPages } from '@/db/schema-tenant';
import { getT } from '@/lib/i18n/server';
import { PageHeader } from '@/components/admin/ui';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsCard';
import SettingsForm from '@/components/settings/SettingsForm';
import { loadSettingsByPrefix, saveReadingSettings } from '@/app/cms/actions/settings';
import { withDefaults, type SettingField, type SettingsValues } from '@/components/settings/types';

export const dynamic = 'force-dynamic';

const DEFAULTS: SettingsValues = {
  reading_homepage_type: 'latest',
  reading_homepage_page_id: '',
  reading_posts_per_page: '10',
  reading_discussion_page_id: '',
};

export default async function ReadingSettingsPage() {
  await requireCmsSession();
  const t = await getT();

  const db = await getContextDb();
  const [pages, loaded] = await Promise.all([
    db
      .select({ id: cmsPages.id, title: cmsPages.title })
      .from(cmsPages)
      .where(eq(cmsPages.status, 'Active'))
      .orderBy(asc(cmsPages.title)),
    loadSettingsByPrefix('reading_'),
  ]);
  const values = withDefaults(DEFAULTS, loaded);

  const pageOptions = [
    { value: '', label: t('cmssettings.reading.selectPage') },
    ...pages.map((page) => ({ value: String(page.id), label: page.title })),
  ];

  const fields: SettingField[] = [
    {
      kind: 'radio',
      key: 'reading_homepage_type',
      label: t('cmssettings.reading.homepageTypeLabel'),
      options: [
        { value: 'latest', label: t('cmssettings.reading.homepageLatest') },
        { value: 'static', label: t('cmssettings.reading.homepageStatic') },
      ],
    },
    {
      kind: 'select',
      key: 'reading_homepage_page_id',
      label: t('cmssettings.reading.homepageLabel'),
      hint: t('cmssettings.reading.homepageHint'),
      options: pageOptions,
    },
    {
      kind: 'number',
      key: 'reading_posts_per_page',
      label: t('cmssettings.reading.postsPerPageLabel'),
      min: 1,
      max: 100,
      suffix: t('cmssettings.reading.postsPerPageSuffix'),
      hint: t('cmssettings.reading.postsPerPageHint'),
    },
    {
      kind: 'select',
      key: 'reading_discussion_page_id',
      label: t('cmssettings.reading.discussionPageLabel'),
      hint: t('cmssettings.reading.discussionPageHint'),
      options: pageOptions,
    },
  ];

  const selectedPageLabel =
    pageOptions.find((o) => o.value === String(values.reading_homepage_page_id))?.label || '';

  return (
    <div>
      <PageHeader
        title={t('cmssettings.reading.title')}
        description={t('cmssettings.reading.description')}
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          title={t('cmssettings.reading.cardTitle')}
          description={t('cmssettings.reading.cardDescription')}
        >
          <SettingsForm
            fields={fields}
            initialValues={values}
            onSubmit={saveReadingSettings}
            columns={1}
            saveLabel={t('cmssettings.common.saveChanges')}
          >
            <SettingsSection title={t('cmssettings.reading.sectionTitle')}>
              <p className="text-xs text-zinc-500">
                {values.reading_homepage_type === 'static'
                  ? t('cmssettings.reading.summaryStatic', {
                      page: selectedPageLabel || t('cmssettings.reading.summaryNotSelected'),
                    })
                  : t('cmssettings.reading.summaryLatest')}
              </p>
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

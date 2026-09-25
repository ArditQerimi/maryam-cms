import { asc, eq } from 'drizzle-orm';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextDb } from '@/lib/tenant';
import { cmsPages } from '@/db/schema-tenant';
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
    { value: '', label: '— Select a page —' },
    ...pages.map((page) => ({ value: String(page.id), label: page.title })),
  ];

  const fields: SettingField[] = [
    {
      kind: 'radio',
      key: 'reading_homepage_type',
      label: 'Homepage displays',
      options: [
        { value: 'latest', label: 'Your latest posts' },
        { value: 'static', label: 'A static page (selected below)' },
      ],
    },
    {
      kind: 'select',
      key: 'reading_homepage_page_id',
      label: 'Homepage',
      hint: 'Used only when “A static page” is selected above.',
      options: pageOptions,
    },
    {
      kind: 'number',
      key: 'reading_posts_per_page',
      label: 'Blog pages show at most',
      min: 1,
      max: 100,
      suffix: 'posts per page',
      hint: 'Between 1 and 100.',
    },
    {
      kind: 'select',
      key: 'reading_discussion_page_id',
      label: 'Discussion page',
      hint: 'Optional page that hosts the comment threads.',
      options: pageOptions,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reading settings"
        description="Control what the homepage shows and how much content each page loads."
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          title="Your homepage"
          description="Choose between a live feed of your newest posts or a hand-picked page."
        >
          <SettingsForm
            fields={fields}
            initialValues={values}
            onSubmit={saveReadingSettings}
            columns={1}
          >
            <SettingsSection title="Front page summary">
              <p className="text-xs text-zinc-500">
                {values.reading_homepage_type === 'static'
                  ? `The storefront homepage is a static page (${pageOptions.find((o) => o.value === String(values.reading_homepage_page_id))?.label || 'not selected yet'}).`
                  : 'The storefront homepage lists your latest published posts.'}
              </p>
            </SettingsSection>
          </SettingsForm>
        </SettingsCard>
      </div>
    </div>
  );
}

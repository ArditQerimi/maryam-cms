import { PageHeader } from '@/components/admin/ui';
import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { getBuilderPreviewTheme } from '@/lib/theme/builder-preview-theme';
import PageForm from '@/components/content/PageForm';

export const dynamic = 'force-dynamic';

export default async function NewPagePage() {
  await requireCmsSession();
  const t = await getT();
  const previewTheme = await getBuilderPreviewTheme();

  return (
    <div>
      <PageHeader
        title={t('cmscontent.pages.new')}
        description={t('cmscontent.pages.newDescription')}
      />
      <PageForm
        previewTheme={previewTheme}
        initial={{
          id: null,
          title: '',
          slug: '',
          content: '',
          blocks: [],
          pageType: 'page',
          excerpt: '',
          featuredImage: '',
          metaTitle: '',
          metaDescription: '',
          status: 'Pending',
          editorMode: 'classic',
        }}
      />
    </div>
  );
}

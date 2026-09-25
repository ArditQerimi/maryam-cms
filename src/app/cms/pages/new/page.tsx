import { PageHeader } from '@/components/admin/ui';
import { requireCmsSession } from '@/lib/cms/session';
import PageForm from '@/components/content/PageForm';

export const dynamic = 'force-dynamic';

export default async function NewPagePage() {
  await requireCmsSession();

  return (
    <div>
      <PageHeader
        title="New page"
        description="Write it with the classic editor or compose it with the page builder."
      />
      <PageForm
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

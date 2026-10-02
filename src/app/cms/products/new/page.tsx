import { requireCmsSession } from '@/lib/cms/session';
import { PageHeader } from '@/components/admin/ui';
import { getT } from '@/lib/i18n/server';
import ProductEditor from '@/components/store/ProductEditor';
import { getProductLookups, toTaxonomy } from '../editor-data';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  await requireCmsSession();
  const t = await getT();
  const lookups = await getProductLookups();

  return (
    <div>
      <PageHeader title={t('cmscatalog.new')} description={t('cmscatalog.new_description')} />
      <ProductEditor mode="create" taxonomy={toTaxonomy(lookups)} initialVariants={[]} />
    </div>
  );
}

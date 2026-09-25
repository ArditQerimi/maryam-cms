import { requireCmsSession } from '@/lib/cms/session';
import { PageHeader } from '@/components/admin/ui';
import ProductEditor from '@/components/store/ProductEditor';
import { getProductLookups, toTaxonomy } from '../editor-data';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  await requireCmsSession();
  const lookups = await getProductLookups();

  return (
    <div>
      <PageHeader title="New product" description="Add a product to your storefront catalogue." />
      <ProductEditor mode="create" taxonomy={toTaxonomy(lookups)} initialVariants={[]} />
    </div>
  );
}

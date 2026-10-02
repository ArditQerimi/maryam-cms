import { requireCmsSession } from '@/lib/cms/session';
import { PageHeader } from '@/components/admin/ui';
import { getT } from '@/lib/i18n/server';
import ProductEditor from '@/components/store/ProductEditor';
import { getProductEditorData, getProductLookups, toTaxonomy } from '../../editor-data';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCmsSession();
  const t = await getT();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    (await import('next/navigation')).notFound();
  }

  const [{ product, variants }, lookups] = await Promise.all([
    getProductEditorData(id),
    getProductLookups(),
  ]);

  return (
    <div>
      <PageHeader
        title={t('cmscatalog.edit_title', { name: product.name })}
        description={t('cmscatalog.edit_description')}
      />
      <ProductEditor
        mode="edit"
        product={product}
        taxonomy={toTaxonomy(lookups)}
        initialVariants={variants}
      />
    </div>
  );
}

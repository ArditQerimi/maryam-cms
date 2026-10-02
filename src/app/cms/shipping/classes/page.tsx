import { eq } from 'drizzle-orm';
import { Boxes } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { settingsStore } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/admin/ui';
import ShippingClassesEditor from '@/components/shipping/ShippingClassesEditor';
import { SHIPPING_CLASSES_KEY, parseShippingClasses } from '../settings-key';

export const dynamic = 'force-dynamic';

export default async function ShippingClassesPage() {
  await requireCmsSession();
  const t = await getT();

  const db = await getContextDb();
  const [row] = await db
    .select({ value: settingsStore.value })
    .from(settingsStore)
    .where(eq(settingsStore.key, SHIPPING_CLASSES_KEY))
    .limit(1);

  const classes = parseShippingClasses(row?.value);

  return (
    <div>
      <PageHeader
        title={t('cmsorders.shipping.classes_title')}
        description={t('cmsorders.shipping.classes_description')}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('cmsorders.shipping.classes_what')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-600">
          <p className="flex items-start gap-2">
            <Boxes className="mt-0.5 shrink-0 text-[#5b59d6]" size={16} />
            <span>
              {t('cmsorders.shipping.classes_intro')}{' '}
              <strong>{t('cmsorders.shipping.classes_strong')}</strong>{' '}
              {t('cmsorders.shipping.classes_rest')}
            </span>
          </p>
          <p className="pl-6 text-xs text-zinc-500">
            {t('cmsorders.shipping.classes_note')}
          </p>
        </CardContent>
      </Card>

      <ShippingClassesEditor initial={classes} />
    </div>
  );
}

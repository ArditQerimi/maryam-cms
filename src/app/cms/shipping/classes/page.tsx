import { eq } from 'drizzle-orm';
import { Boxes } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { settingsStore } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/admin/ui';
import ShippingClassesEditor from '@/components/shipping/ShippingClassesEditor';
import { SHIPPING_CLASSES_KEY, parseShippingClasses } from '../settings-key';

export const dynamic = 'force-dynamic';

export default async function ShippingClassesPage() {
  await requireCmsSession();

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
        title="Shipping classes"
        description="Reusable groups used to calculate shipping rates."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>What are shipping classes?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-600">
          <p className="flex items-start gap-2">
            <Boxes className="mt-0.5 shrink-0 text-[#5b59d6]" size={16} />
            <span>
              Shipping classes <strong>group products that share the same shipping rate</strong> —
              for example bulky furniture, fragile glassware, or perishable goods. Instead of
              pricing every product individually, you define a class once and your shipping rates
              can target everything in that group.
            </span>
          </p>
          <p className="pl-6 text-xs text-zinc-500">
            Classes are stored in this store&apos;s settings and are available to every shipping
            zone and rate calculation.
          </p>
        </CardContent>
      </Card>

      <ShippingClassesEditor initial={classes} />
    </div>
  );
}

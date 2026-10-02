import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { Coins, Package, ShoppingCart } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { productVariants, products, saleItems, sales } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { formatMoney } from '@/lib/cms/format';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import StatCard from '@/components/reports/StatCard';
import ProductBarChart from '@/components/reports/ProductBarChart';
import { resolveReportRange } from '../report-range';

export const dynamic = 'force-dynamic';

async function getTopProductsByQuantity() {
  const range = resolveReportRange({ preset: '30d' });
  const db = await getContextDb();

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      units: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
      revenue: sql<string>`coalesce(sum(${saleItems.subtotal}), 0)`,
      stock: products.stockQuantity,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(productVariants, eq(saleItems.variantId, productVariants.id))
    .leftJoin(products, eq(productVariants.productId, products.id))
    .where(and(
      eq(sales.isOnline, true),
      gte(sales.createdAt, range.from),
      lt(sales.createdAt, range.to),
    ))
    .groupBy(products.id, products.name, products.sku, products.stockQuantity)
    .orderBy(desc(sql`coalesce(sum(${saleItems.quantity}), 0)`))
    .limit(10);

  return { range, rows };
}

export default async function ProductsReportPage() {
  await requireCmsSession();
  const t = await getT();

  const { range, rows } = await getTopProductsByQuantity();
  const rangeLabel = range.labelKey ? t(range.labelKey) : range.label;

  const totalUnits = rows.reduce((sum, row) => sum + (row.units || 0), 0);
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);

  return (
    <div>
      <PageHeader
        title={t('cmsdash.products.title')}
        description={t('cmsdash.products.description', { period: rangeLabel.toLowerCase() })}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          hint={t('cmsdash.products.top10Hint')}
          icon={ShoppingCart}
          label={t('cmsdash.products.units')}
          value={totalUnits.toLocaleString()}
        />
        <StatCard
          hint={t('cmsdash.products.top10Hint')}
          icon={Coins}
          label={t('cmsdash.products.revenue')}
          value={formatMoney(totalRevenue)}
        />
        <StatCard
          hint={t('cmsdash.products.soldHint')}
          icon={Package}
          label={t('cmsdash.products.sold')}
          value={rows.length.toLocaleString()}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('cmsdash.products.topTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductBarChart
            data={rows.map((row) => ({
              name: row.name || t('cmsdash.deletedProduct'),
              quantity: row.units || 0,
            }))}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('cmsdash.products.tableTitle')}</CardTitle>
        </CardHeader>
        {rows.length === 0 ? (
          <CardContent>
            <EmptyState
              description={t('cmsdash.products.emptyDescription')}
              icon={<Package size={28} />}
              title={t('cmsdash.products.emptyTitle')}
            />
          </CardContent>
        ) : (
          <div>
            <Table bare>
              <thead>
                <tr>
                  <Th>{t('cmsdash.th.product')}</Th>
                  <Th>{t('cmsdash.th.sku')}</Th>
                  <Th className="text-right">{t('cmsdash.th.unitsSold')}</Th>
                  <Th className="text-right">{t('cmsdash.th.revenue')}</Th>
                  <Th className="text-right">{t('cmsdash.products.remainingStock')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="transition hover:bg-zinc-50" key={`${row.id ?? 'x'}-${row.sku ?? row.name}`}>
                    <Td className="max-w-[300px] truncate font-medium text-zinc-900">
                      {row.name || t('cmsdash.deletedProduct')}
                    </Td>
                    <Td className="whitespace-nowrap text-zinc-500">{row.sku || '—'}</Td>
                    <Td className="text-right">{(row.units || 0).toLocaleString()}</Td>
                    <Td className="text-right font-medium text-zinc-900">
                      {formatMoney(row.revenue)}
                    </Td>
                    <Td className="text-right">
                      <span
                        className={
                          (row.stock ?? 0) <= 0
                            ? 'font-medium text-red-600'
                            : 'text-zinc-700'
                        }
                      >
                        {(row.stock ?? 0).toLocaleString()}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

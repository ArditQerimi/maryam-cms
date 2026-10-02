import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { DollarSign, Receipt, ShoppingBag, Users } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { customers, productVariants, products, saleItems, sales, settingsStore } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { formatMoney } from '@/lib/cms/format';
import {
  Badge,
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
import SalesChart, { type SalesPoint } from '@/components/admin/charts/SalesChart';
import StatCard from '@/components/reports/StatCard';
import RangePicker from '@/components/reports/RangePicker';
import {
  REPORT_SALES_RANGE_KEY,
  dayKeys,
  resolveReportRange,
  type ReportRange,
  type ReportRangeSearch,
} from '../report-range';

export const dynamic = 'force-dynamic';

type SalesPageProps = {
  searchParams: Promise<ReportRangeSearch>;
};

function isPresetProvided(search: ReportRangeSearch): boolean {
  return typeof search.preset === 'string' || Array.isArray(search.preset);
}

/** Remembered range from `settings_store` (`report_sales_range`), if valid. */
async function loadSavedRange(): Promise<ReportRangeSearch> {
  try {
    const db = await getContextDb();
    const [row] = await db
      .select({ value: settingsStore.value })
      .from(settingsStore)
      .where(eq(settingsStore.key, REPORT_SALES_RANGE_KEY))
      .limit(1);
    if (!row) return { preset: '30d' };
    const parsed: unknown = JSON.parse(row.value);
    if (!parsed || typeof parsed !== 'object') return { preset: '30d' };
    const record = parsed as Record<string, unknown>;
    return {
      preset: typeof record.preset === 'string' ? record.preset : '30d',
      from: typeof record.from === 'string' ? record.from : undefined,
      to: typeof record.to === 'string' ? record.to : undefined,
    };
  } catch {
    return { preset: '30d' };
  }
}

async function getStats(range: ReportRange) {
  const db = await getContextDb();
  const period = and(
    eq(sales.isOnline, true),
    gte(sales.createdAt, range.from),
    lt(sales.createdAt, range.to),
  );

  const [revenue, orderCount, newCustomerCount] = await Promise.all([
    db
      .select({ value: sql<string>`coalesce(sum(${sales.grandTotal}), 0)` })
      .from(sales)
      .where(period),
    db.select({ value: sql<number>`count(*)::int` }).from(sales).where(period),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(customers)
      .where(and(
        gte(customers.createdAt, range.from),
        lt(customers.createdAt, range.to),
      )),
  ]);

  const totalRevenue = Number(revenue[0]?.value ?? 0);
  const orders = orderCount[0]?.value ?? 0;

  return {
    revenue: totalRevenue,
    orders,
    average: orders > 0 ? totalRevenue / orders : 0,
    newCustomers: newCustomerCount[0]?.value ?? 0,
  };
}

async function getSeries(range: ReportRange): Promise<SalesPoint[]> {
  const db = await getContextDb();
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${sales.createdAt}), 'YYYY-MM-DD')`,
      orders: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${sales.grandTotal}), 0)`,
    })
    .from(sales)
    .where(and(
      eq(sales.isOnline, true),
      gte(sales.createdAt, range.from),
      lt(sales.createdAt, range.to),
    ))
    .groupBy(sql`date_trunc('day', ${sales.createdAt})`)
    .orderBy(sql`date_trunc('day', ${sales.createdAt})`);

  const byDay = new Map(rows.map((row) => [row.day, row]));
  return dayKeys(range).map((key) => {
    const row = byDay.get(key);
    return {
      day: key.slice(5),
      orders: row?.orders ?? 0,
      revenue: Number(row?.revenue ?? 0),
    };
  });
}

async function getTopProducts(range: ReportRange) {
  const db = await getContextDb();
  return db
    .select({
      id: products.id,
      name: products.name,
      units: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
      revenue: sql<string>`coalesce(sum(${saleItems.subtotal}), 0)`,
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
    .groupBy(products.id, products.name)
    .orderBy(desc(sql`coalesce(sum(${saleItems.subtotal}), 0)`))
    .limit(10);
}

export default async function SalesReportPage({ searchParams }: SalesPageProps) {
  await requireCmsSession();
  const t = await getT();

  const params = await searchParams;
  const range = isPresetProvided(params)
    ? resolveReportRange(params)
    : resolveReportRange(await loadSavedRange());
  const rangeLabel = range.labelKey ? t(range.labelKey) : range.label;

  const [stats, series, topProducts] = await Promise.all([
    getStats(range),
    getSeries(range),
    getTopProducts(range),
  ]);

  return (
    <div>
      <PageHeader
        title={t('cmsdash.sales.title')}
        description={t('cmsdash.sales.description')}
      />

      <div className="mb-6">
        <RangePicker
          basePath="/cms/reports/sales"
          current={{ preset: range.preset, from: range.fromParam, to: range.toParam }}
          label={rangeLabel}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          hint={t('cmsdash.sales.revenueHint')}
          icon={DollarSign}
          label={t('cmsdash.sales.revenue')}
          value={formatMoney(stats.revenue)}
        />
        <StatCard
          hint={t('cmsdash.sales.ordersHint')}
          icon={Receipt}
          label={t('cmsdash.sales.orders')}
          value={stats.orders.toLocaleString()}
        />
        <StatCard
          hint={t('cmsdash.sales.averageHint')}
          icon={ShoppingBag}
          label={t('cmsdash.sales.average')}
          value={formatMoney(stats.average)}
        />
        <StatCard
          hint={rangeLabel}
          icon={Users}
          label={t('cmsdash.sales.newCustomers')}
          value={stats.newCustomers.toLocaleString()}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            {t('cmsdash.sales.chartTitle', { period: rangeLabel.toLowerCase() })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChart data={series} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('cmsdash.sales.topProducts')}</CardTitle>
        </CardHeader>
        {topProducts.length === 0 ? (
          <CardContent>
            <EmptyState
              description={t('cmsdash.sales.emptyDescription')}
              icon={<ShoppingBag size={28} />}
              title={t('cmsdash.sales.emptyTitle')}
            />
          </CardContent>
        ) : (
          <div>
            <Table bare>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>{t('cmsdash.th.product')}</Th>
                  <Th className="text-right">{t('cmsdash.th.unitsSold')}</Th>
                  <Th className="text-right">{t('cmsdash.th.revenue')}</Th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, index) => (
                  <tr className="transition hover:bg-zinc-50" key={`${product.id ?? 'x'}-${index}`}>
                    <Td>
                      <Badge tone="brand">{index + 1}</Badge>
                    </Td>
                    <Td className="max-w-[320px] truncate font-medium text-zinc-900">
                      {product.name || t('cmsdash.deletedProduct')}
                    </Td>
                    <Td className="text-right">{product.units.toLocaleString()}</Td>
                    <Td className="text-right font-medium text-zinc-900">
                      {formatMoney(product.revenue)}
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

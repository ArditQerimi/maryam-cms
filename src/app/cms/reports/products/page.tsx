import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { Coins, Package, ShoppingCart } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { productVariants, products, saleItems, sales } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
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

  const { range, rows } = await getTopProductsByQuantity();

  const totalUnits = rows.reduce((sum, row) => sum + (row.units || 0), 0);
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);

  return (
    <div>
      <PageHeader
        title="Products report"
        description={`Best sellers by quantity sold — ${range.label.toLowerCase()}.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          hint="Across the top 10 products"
          icon={ShoppingCart}
          label="Units sold"
          value={totalUnits.toLocaleString()}
        />
        <StatCard
          hint="Across the top 10 products"
          icon={Coins}
          label="Revenue"
          value={formatMoney(totalRevenue)}
        />
        <StatCard
          hint="With at least one sale in period"
          icon={Package}
          label="Products sold"
          value={rows.length.toLocaleString()}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Top 10 products by quantity sold</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductBarChart
            data={rows.map((row) => ({
              name: row.name || 'Deleted product',
              quantity: row.units || 0,
            }))}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Units, revenue, and remaining stock</CardTitle>
        </CardHeader>
        {rows.length === 0 ? (
          <CardContent>
            <EmptyState
              description="No online sales were recorded in the last 30 days."
              icon={<Package size={28} />}
              title="No product sales yet"
            />
          </CardContent>
        ) : (
          <div>
            <Table bare>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">Units sold</Th>
                  <Th className="text-right">Revenue</Th>
                  <Th className="text-right">Remaining stock</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="transition hover:bg-zinc-50" key={`${row.id ?? 'x'}-${row.sku ?? row.name}`}>
                    <Td className="max-w-[300px] truncate font-medium text-zinc-900">
                      {row.name || 'Deleted product'}
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

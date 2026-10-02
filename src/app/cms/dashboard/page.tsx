import Link from 'next/link';
import { sql, desc, eq, and, gte } from 'drizzle-orm';
import {
  ArrowRight,
  FilePlus2,
  Package,
  Palette,
  Plus,
  Receipt,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import {
  customers,
  products,
  productVariants,
  saleItems,
  sales,
  users,
} from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { formatDate, formatMoney } from '@/lib/cms/format';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatusBadge,
  Td,
  Th,
  Table,
} from '@/components/admin/ui';
import SalesChart, { type SalesPoint } from '@/components/admin/charts/SalesChart';

export const dynamic = 'force-dynamic';

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function getStats() {
  const db = await getContextDb();
  const since = monthStart();

  const [productCount, orderCount, customerCount, revenue, lowStock] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.status, 'Active')),
    db.select({ value: sql<number>`count(*)::int` })
      .from(sales)
      .where(eq(sales.isOnline, true)),
    db.select({ value: sql<number>`count(*)::int` }).from(customers),
    db.select({ value: sql<string>`coalesce(sum(${sales.grandTotal}), 0)` })
      .from(sales)
      .where(and(eq(sales.isOnline, true), gte(sales.createdAt, since))),
    db.select({ value: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.status, 'Active'), sql`${products.stockQuantity} <= ${products.minStockLevel}`)),
  ]);

  return {
    products: productCount[0]?.value ?? 0,
    orders: orderCount[0]?.value ?? 0,
    customers: customerCount[0]?.value ?? 0,
    revenue: Number(revenue[0]?.value ?? 0),
    lowStock: lowStock[0]?.value ?? 0,
  };
}

async function getRecentOrders() {
  const db = await getContextDb();
  return db
    .select({
      id: sales.id,
      reference: sales.reference,
      grandTotal: sales.grandTotal,
      status: sales.status,
      createdAt: sales.createdAt,
      customerName: customers.name,
      customerEmail: customers.email,
      userName: users.name,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(users, eq(sales.customerUserId, users.id))
    .where(eq(sales.isOnline, true))
    .orderBy(desc(sales.createdAt))
    .limit(10);
}

async function getSalesSeries(): Promise<SalesPoint[]> {
  const db = await getContextDb();
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${sales.createdAt}), 'YYYY-MM-DD')`,
      orders: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${sales.grandTotal}), 0)`,
    })
    .from(sales)
    .where(and(eq(sales.isOnline, true), gte(sales.createdAt, sql`now() - interval '30 days'`)))
    .groupBy(sql`date_trunc('day', ${sales.createdAt})`)
    .orderBy(sql`date_trunc('day', ${sales.createdAt})`);

  const byDay = new Map(rows.map((row) => [row.day, row]));
  const points: SalesPoint[] = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key);
    points.push({
      day: key.slice(5),
      orders: row?.orders ?? 0,
      revenue: Number(row?.revenue ?? 0),
    });
  }
  return points;
}

async function getTopProducts() {
  const db = await getContextDb();
  const rows = await db
    .select({
      name: products.name,
      sold: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
      revenue: sql<string>`coalesce(sum(${saleItems.subtotal}), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(productVariants, eq(saleItems.variantId, productVariants.id))
    .leftJoin(products, eq(productVariants.productId, products.id))
    .where(eq(sales.isOnline, true))
    .groupBy(products.name)
    .orderBy(desc(sql`coalesce(sum(${saleItems.subtotal}), 0)`))
    .limit(5);

  return rows;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number }>;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="transition group-hover:border-[#6d6be8]/40 group-hover:shadow-md">
        <CardContent className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
            {hint ? <p className="mt-1 text-xs text-zinc-400">{hint}</p> : null}
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6d6be8]/10 text-[#5b59d6]">
            <Icon size={18} />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  await requireCmsSession();
  const t = await getT();

  const [stats, recentOrders, series, topProducts] = await Promise.all([
    getStats(),
    getRecentOrders(),
    getSalesSeries(),
    getTopProducts(),
  ]);

  const quickLinks = [
    { label: t('cmsdash.quick.newPage'), href: '/cms/pages/new', icon: FilePlus2 },
    { label: t('cmsdash.quick.newPost'), href: '/cms/posts/new', icon: FilePlus2 },
    { label: t('cmsdash.quick.newProduct'), href: '/cms/products/new', icon: Plus },
    { label: t('cmsdash.quick.customizer'), href: '/cms/appearance/customize', icon: Palette },
  ];

  return (
    <div>
      <PageHeader
        title={t('cmsdash.title')}
        description={t('cmsdash.description')}
        actions={
          <a
            href="/home"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            {t('cmsdash.viewShop')} <ArrowRight size={14} />
          </a>
        }
      />

      {/* Row 1 — stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('cmsdash.stat.products')}
          value={stats.products.toLocaleString()}
          hint={t('cmsdash.stat.productsHint', { count: stats.lowStock })}
          icon={Package}
          href="/cms/products"
        />
        <StatCard
          label={t('cmsdash.stat.orders')}
          value={stats.orders.toLocaleString()}
          hint={t('cmsdash.stat.ordersHint')}
          icon={Receipt}
          href="/cms/orders"
        />
        <StatCard
          label={t('cmsdash.stat.customers')}
          value={stats.customers.toLocaleString()}
          hint={t('cmsdash.stat.customersHint')}
          icon={Users}
          href="/cms/customers"
        />
        <StatCard
          label={t('cmsdash.stat.revenue')}
          value={formatMoney(stats.revenue)}
          hint={t('cmsdash.stat.revenueHint')}
          icon={ShoppingBag}
          href="/cms/reports/sales"
        />
      </div>

      {/* Row 2 — recent orders + quick links */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>{t('cmsdash.recentOrders')}</CardTitle>
            <Link href="/cms/orders" className="text-xs font-medium text-[#5b59d6] hover:underline">
              {t('cmsdash.viewAll')}
            </Link>
          </CardHeader>
          {recentOrders.length === 0 ? (
            <CardContent>
              <EmptyState
                title={t('cmsdash.recentOrders.emptyTitle')}
                description={t('cmsdash.recentOrders.emptyDescription')}
                icon={<Receipt size={28} />}
              />
            </CardContent>
          ) : (
            <div>
              <Table bare>
                <thead>
                  <tr>
                    <Th>{t('cmsdash.th.order')}</Th>
                    <Th>{t('cmsdash.th.customer')}</Th>
                    <Th>{t('cmsdash.th.date')}</Th>
                    <Th className="text-right">{t('cmsdash.th.total')}</Th>
                    <Th>{t('cmsdash.th.status')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="transition hover:bg-zinc-50">
                      <Td>
                        <Link
                          href={`/cms/orders/${order.id}`}
                          className="font-medium text-zinc-900 hover:text-[#5b59d6]"
                        >
                          #{order.id}
                        </Link>
                        <span className="ml-2 text-xs text-zinc-400">{order.reference}</span>
                      </Td>
                      <Td className="max-w-[220px] truncate">
                        {order.customerName || order.userName || t('cmsdash.guest')}
                      </Td>
                      <Td className="whitespace-nowrap text-zinc-500">
                        {formatDate(order.createdAt)}
                      </Td>
                      <Td className="text-right font-medium text-zinc-900">
                        {formatMoney(order.grandTotal)}
                      </Td>
                      <Td>
                        <StatusBadge status={order.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('cmsdash.quickActions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-[#6d6be8]/40 hover:bg-[#6d6be8]/5"
                >
                  <span className="flex items-center gap-2.5">
                    <link.icon size={15} className="text-[#5b59d6]" />
                    {link.label}
                  </span>
                  <ArrowRight size={14} className="text-zinc-400" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('cmsdash.topProducts')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topProducts.length === 0 ? (
                <p className="text-sm text-zinc-500">{t('cmsdash.topProducts.empty')}</p>
              ) : (
                topProducts.map((product, index) => (
                  <div key={product.name || index} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Badge tone="brand">{index + 1}</Badge>
                      <span className="truncate text-sm text-zinc-700">{product.name || t('cmsdash.deletedProduct')}</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-zinc-900">
                      {formatMoney(product.revenue)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 3 — chart */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('cmsdash.chart.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChart data={series} />
        </CardContent>
      </Card>
    </div>
  );
}

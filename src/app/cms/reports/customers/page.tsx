import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { RefreshCw, UserPlus, Users } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { customers, sales } from '@/db/schema-tenant';
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
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import StatCard from '@/components/reports/StatCard';
import { utcMonthStart } from '../report-range';

export const dynamic = 'force-dynamic';

async function getCustomerStats() {
  const db = await getContextDb();
  const monthStart = utcMonthStart();

  const [total, newThisMonth, returning] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(customers),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(customers)
      .where(gte(customers.createdAt, monthStart)),
    db
      .select({ value: sql<number>`count(distinct ${sales.customerId})::int` })
      .from(sales)
      .where(and(
        eq(sales.isOnline, true),
        sql`${sales.customerId} is not null`,
        lt(sales.createdAt, monthStart),
      )),
  ]);

  return {
    total: total[0]?.value ?? 0,
    newThisMonth: newThisMonth[0]?.value ?? 0,
    returning: returning[0]?.value ?? 0,
  };
}

async function getTopCustomers() {
  const db = await getContextDb();
  return db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      createdAt: customers.createdAt,
      orders: sql<number>`count(*)::int`,
      spent: sql<string>`coalesce(sum(${sales.grandTotal}), 0)`,
    })
    .from(sales)
    .innerJoin(customers, eq(sales.customerId, customers.id))
    .where(eq(sales.isOnline, true))
    .groupBy(customers.id, customers.name, customers.email, customers.createdAt)
    .orderBy(desc(sql`coalesce(sum(${sales.grandTotal}), 0)`))
    .limit(10);
}

export default async function CustomersReportPage() {
  await requireCmsSession();
  const t = await getT();

  const [stats, topCustomers] = await Promise.all([
    getCustomerStats(),
    getTopCustomers(),
  ]);

  return (
    <div>
      <PageHeader
        title={t('cmsdash.customers.title')}
        description={t('cmsdash.customers.description')}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          hint={t('cmsdash.customers.totalHint')}
          icon={Users}
          label={t('cmsdash.customers.total')}
          value={stats.total.toLocaleString()}
        />
        <StatCard
          hint={t('cmsdash.customers.newHint')}
          icon={UserPlus}
          label={t('cmsdash.customers.new')}
          value={stats.newThisMonth.toLocaleString()}
        />
        <StatCard
          hint={t('cmsdash.customers.returningHint')}
          icon={RefreshCw}
          label={t('cmsdash.customers.returning')}
          value={stats.returning.toLocaleString()}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('cmsdash.customers.topTitle')}</CardTitle>
        </CardHeader>
        {topCustomers.length === 0 ? (
          <CardContent>
            <EmptyState
              description={t('cmsdash.customers.emptyDescription')}
              icon={<Users size={28} />}
              title={t('cmsdash.customers.emptyTitle')}
            />
          </CardContent>
        ) : (
          <div>
            <Table bare>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>{t('cmsdash.th.customer')}</Th>
                  <Th>{t('cmsdash.customers.joined')}</Th>
                  <Th className="text-right">{t('cmsdash.th.orders')}</Th>
                  <Th className="text-right">{t('cmsdash.customers.totalSpent')}</Th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer, index) => (
                  <tr className="transition hover:bg-zinc-50" key={customer.id}>
                    <Td>
                      <Badge tone="brand">{index + 1}</Badge>
                    </Td>
                    <Td className="max-w-[320px]">
                      <span className="block truncate font-medium text-zinc-900">
                        {customer.name}
                      </span>
                      <span className="block truncate text-xs text-zinc-400">
                        {customer.email || t('cmsdash.customers.noEmail')}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-zinc-500">
                      {formatDate(customer.createdAt)}
                    </Td>
                    <Td className="text-right">{customer.orders.toLocaleString()}</Td>
                    <Td className="text-right font-medium text-zinc-900">
                      {formatMoney(customer.spent)}
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

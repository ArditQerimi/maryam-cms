import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { RefreshCw, UserPlus, Users } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { customers, sales } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
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

  const [stats, topCustomers] = await Promise.all([
    getCustomerStats(),
    getTopCustomers(),
  ]);

  return (
    <div>
      <PageHeader
        title="Customers report"
        description="Customer growth and the shoppers who spend the most."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          hint="Registered customer records"
          icon={Users}
          label="Total customers"
          value={stats.total.toLocaleString()}
        />
        <StatCard
          hint="Joined this month"
          icon={UserPlus}
          label="New this month"
          value={stats.newThisMonth.toLocaleString()}
        />
        <StatCard
          hint="Placed an order before this month"
          icon={RefreshCw}
          label="Returning customers"
          value={stats.returning.toLocaleString()}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Top 10 customers by total spent</CardTitle>
        </CardHeader>
        {topCustomers.length === 0 ? (
          <CardContent>
            <EmptyState
              description="No customers have completed an online order yet."
              icon={<Users size={28} />}
              title="No customer orders yet"
            />
          </CardContent>
        ) : (
          <div>
            <Table bare>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Customer</Th>
                  <Th>Joined</Th>
                  <Th className="text-right">Orders</Th>
                  <Th className="text-right">Total spent</Th>
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
                        {customer.email || 'No email'}
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

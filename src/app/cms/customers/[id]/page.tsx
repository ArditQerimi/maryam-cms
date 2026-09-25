import Link from 'next/link';
import { and, desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ArrowLeft, Receipt, StickyNote } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import {
  customerNotes,
  customers,
  sales,
  storefrontOrderDetails,
  users,
} from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { formatDate, formatMoney } from '@/lib/cms/format';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import CustomerHeaderActions from '@/components/store/CustomerHeaderActions';
import CustomerProfileForm from '@/components/store/CustomerProfileForm';
import CustomerAddressForm from '@/components/store/CustomerAddressForm';
import CustomerNoteComposer from '@/components/store/CustomerNoteComposer';

export const dynamic = 'force-dynamic';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

function addressLine(address: Record<string, string>) {
  return [address.address1, address.address2].filter(Boolean).join(', ');
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCmsSession();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const db = await getContextDb();

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (!customer) notFound();

  // Storefront account linked through `sales.customer_user_id`.
  const [linked] = await db
    .select({ userId: sales.customerUserId })
    .from(sales)
    .where(and(eq(sales.customerId, id), isNotNull(sales.customerUserId)))
    .orderBy(desc(sales.createdAt))
    .limit(1);
  const linkedUserId = linked?.userId ?? null;

  const ordersCondition = or(
    eq(sales.customerId, id),
    linkedUserId ? eq(sales.customerUserId, linkedUserId) : undefined,
  );

  const [statsRows, orderHistory, notes, latestOrder] = await Promise.all([
    db
      .select({
        total: sql<number>`count(${sales.id})::int`,
        spent: sql<string>`coalesce(sum(${sales.grandTotal}) filter (where ${sales.status} <> 'Cancelled'), '0')`,
        average: sql<string>`coalesce(avg(${sales.grandTotal}) filter (where ${sales.status} <> 'Cancelled'), '0')`,
        lastOrderAt: sql<Date | null>`max(${sales.createdAt})`,
      })
      .from(sales)
      .where(ordersCondition),
    db
      .select({
        id: sales.id,
        reference: sales.reference,
        status: sales.status,
        grandTotal: sales.grandTotal,
        paymentMethod: sales.paymentMethod,
        isOnline: sales.isOnline,
        createdAt: sales.createdAt,
        itemsCount: sql<number>`(select count(*)::int from sale_items si where si.sale_id = ${sales.id})`,
      })
      .from(sales)
      .where(ordersCondition)
      .orderBy(desc(sales.createdAt))
      .limit(50),
    db
      .select({
        id: customerNotes.id,
        body: customerNotes.body,
        createdAt: customerNotes.createdAt,
        authorName: users.name,
      })
      .from(customerNotes)
      .leftJoin(users, eq(customerNotes.createdByUserId, users.id))
      .where(eq(customerNotes.customerId, id))
      .orderBy(desc(customerNotes.createdAt))
      .limit(50),
    db
      .select({
        saleId: storefrontOrderDetails.saleId,
        shippingAddress: storefrontOrderDetails.shippingAddress,
        createdAt: sales.createdAt,
        reference: sales.reference,
      })
      .from(storefrontOrderDetails)
      .innerJoin(sales, eq(storefrontOrderDetails.saleId, sales.id))
      .where(ordersCondition)
      .orderBy(desc(sales.createdAt))
      .limit(1),
  ]);

  const stat = statsRows[0] ?? {
    total: 0,
    spent: '0',
    average: '0',
    lastOrderAt: null,
  };

  const statCards = [
    { label: 'Total orders', value: String(stat.total) },
    { label: 'Total spent', value: formatMoney(stat.spent) },
    { label: 'Average order', value: formatMoney(stat.average) },
    { label: 'Last order', value: stat.lastOrderAt ? formatDate(stat.lastOrderAt) : '—' },
  ];

  const shipping = latestOrder[0]?.shippingAddress ?? null;

  return (
    <div>
      {/* Header card */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/cms/customers"
              className="hidden rounded-lg border border-zinc-200 p-2 text-zinc-400 transition hover:border-[#6d6be8]/40 hover:text-[#5b59d6] sm:block"
              aria-label="Back to customers"
            >
              <ArrowLeft size={16} />
            </Link>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#6d6be8]/10 text-lg font-semibold text-[#5b59d6]">
              {initials(customer.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900">
                  {customer.name}
                </h1>
                <StatusBadge status={customer.status} />
              </div>
              <p className="truncate text-sm text-zinc-500">{customer.email || 'No email'}</p>
              <p className="text-xs text-zinc-400">
                Registered {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>
          <CustomerHeaderActions customerId={customer.id} status={customer.status} />
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {card.label}
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Profile + addresses */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerProfileForm
              customerId={customer.id}
              initial={{
                name: customer.name,
                email: customer.email ?? '',
                phone: customer.phone ?? '',
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Default billing address</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerAddressForm
                customerId={customer.id}
                initial={{
                  address: customer.address ?? '',
                  city: customer.city ?? '',
                  state: customer.state ?? '',
                  country: customer.country ?? '',
                  postalCode: customer.postalCode ?? '',
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default shipping address</CardTitle>
            </CardHeader>
            <CardContent>
              {shipping ? (
                <div className="space-y-1 text-sm text-zinc-700">
                  <p className="font-medium text-zinc-900">{customer.name}</p>
                  <p>{addressLine(shipping) || '—'}</p>
                  <p>
                    {[shipping.city, shipping.region, shipping.postalCode]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </p>
                  <p>{shipping.country || customer.country || '—'}</p>
                  <p className="pt-2 text-xs text-zinc-400">
                    Taken from{' '}
                    <Link
                      href={`/cms/orders/${latestOrder[0]?.saleId ?? ''}`}
                      className="text-[#5b59d6] hover:underline"
                    >
                      {latestOrder[0]?.reference ?? 'their latest order'}
                    </Link>{' '}
                    ({formatDate(latestOrder[0]?.createdAt)}).
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  No storefront order has a shipping address for this customer yet — the billing
                  address above is used instead.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order history */}
      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Order history</CardTitle>
          <Link href="/cms/orders" className="text-xs font-medium text-[#5b59d6] hover:underline">
            View all orders
          </Link>
        </CardHeader>
        {orderHistory.length === 0 ? (
          <CardContent>
            <EmptyState
              title="No orders yet"
              description="Orders this customer places will show up here."
              icon={<Receipt size={28} />}
            />
          </CardContent>
        ) : (
          <div>
            <Table bare>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Date</Th>
                  <Th>Channel</Th>
                  <Th>Payment</Th>
                  <Th className="text-right">Items</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {orderHistory.map((order) => (
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
                    <Td className="whitespace-nowrap text-zinc-500">
                      {formatDate(order.createdAt, true)}
                    </Td>
                    <Td className="text-zinc-500">
                      {order.isOnline ? 'Storefront' : 'Point of sale'}
                    </Td>
                    <Td className="whitespace-nowrap text-zinc-500">
                      {order.paymentMethod || '—'}
                    </Td>
                    <Td className="text-right">{order.itemsCount}</Td>
                    <Td className="whitespace-nowrap text-right font-medium text-zinc-900">
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

      {/* Account notes */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Account notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {notes.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <StickyNote size={15} className="text-zinc-400" /> No notes yet — add the first one
              below.
            </p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="whitespace-pre-wrap text-sm text-zinc-700">{note.body}</p>
                  <p className="mt-1.5 text-xs text-zinc-400">
                    {note.authorName || 'Unknown user'} · {formatDate(note.createdAt, true)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <CustomerNoteComposer customerId={customer.id} />
        </CardContent>
      </Card>
    </div>
  );
}

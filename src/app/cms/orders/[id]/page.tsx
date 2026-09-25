import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, desc, eq } from 'drizzle-orm';
import { ArrowLeft, CreditCard, MessageSquare, Package, Truck, User } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import {
  customers,
  orderNotes,
  orderTracking,
  productVariants,
  products,
  saleItems,
  sales,
  storefrontOrderDetails,
  users,
} from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { formatDate, formatMoney } from '@/lib/cms/format';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import OrderStatusCard, { StatusPill } from '@/components/store/OrderStatusCard';
import TrackingCard, { type TrackingValues } from '@/components/store/TrackingCard';
import NoteComposer from '@/components/store/NoteComposer';
import AddressCard from '@/components/store/AddressCard';
import RefundDialog, { type RefundLine } from '@/components/store/RefundDialog';
import PrintButton from '@/components/store/PrintButton';

export const dynamic = 'force-dynamic';

function line(label: string, value: string, strong = false) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={strong ? 'text-sm font-semibold text-zinc-900' : 'text-sm text-zinc-500'}>
        {label}
      </span>
      <span className={strong ? 'text-base font-semibold text-zinc-900' : 'text-sm text-zinc-800'}>
        {value}
      </span>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCmsSession();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const db = await getContextDb();

  const saleRows = await db
    .select({
      id: sales.id,
      reference: sales.reference,
      customerId: sales.customerId,
      customerUserId: sales.customerUserId,
      totalAmount: sales.totalAmount,
      discount: sales.discount,
      tax: sales.tax,
      grandTotal: sales.grandTotal,
      status: sales.status,
      paymentMethod: sales.paymentMethod,
      isOnline: sales.isOnline,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .where(eq(sales.id, id))
    .limit(1);
  const sale = saleRows[0];
  if (!sale) notFound();

  const [items, detailRows, trackingRows, noteRows, customerRows, userRows] = await Promise.all([
    db
      .select({
        saleItemId: saleItems.id,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        subtotal: saleItems.subtotal,
        productName: products.name,
        productId: productVariants.productId,
        variantName: productVariants.name,
        sku: productVariants.sku,
      })
      .from(saleItems)
      .innerJoin(productVariants, eq(saleItems.variantId, productVariants.id))
      .leftJoin(products, eq(productVariants.productId, products.id))
      .where(eq(saleItems.saleId, id))
      .orderBy(asc(saleItems.id)),
    db
      .select()
      .from(storefrontOrderDetails)
      .where(eq(storefrontOrderDetails.saleId, id))
      .limit(1),
    db.select().from(orderTracking).where(eq(orderTracking.orderId, id)).limit(1),
    db
      .select({
        id: orderNotes.id,
        body: orderNotes.body,
        isCustomerNote: orderNotes.isCustomerNote,
        createdAt: orderNotes.createdAt,
        authorName: users.name,
      })
      .from(orderNotes)
      .leftJoin(users, eq(orderNotes.createdByUserId, users.id))
      .where(eq(orderNotes.orderId, id))
      .orderBy(desc(orderNotes.createdAt)),
    sale.customerId
      ? db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1)
      : Promise.resolve([]),
    sale.customerUserId
      ? db.select().from(users).where(eq(users.id, sale.customerUserId)).limit(1)
      : Promise.resolve([]),
  ]);

  const details = detailRows[0] ?? null;
  const tracking = trackingRows[0] ?? null;
  const customer = customerRows[0] ?? null;
  const linkedUser = userRows[0] ?? null;
  const currency = details?.currency ?? 'EUR';

  const trackingValues: TrackingValues | null = tracking
    ? {
        trackingNumber: tracking.trackingNumber ?? '',
        carrier: tracking.carrier ?? '',
        trackingUrl: tracking.trackingUrl ?? '',
        sentAt: tracking.sentAt ? tracking.sentAt.toISOString() : null,
      }
    : null;

  const refundLines: RefundLine[] = items.map((item) => ({
    saleItemId: item.saleItemId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    productName: item.productName,
    variantName: item.variantName,
  }));

  const customerName =
    customer?.name || linkedUser?.name || details?.contactEmail || 'Walk-in customer';
  const customerEmail = customer?.email || linkedUser?.email || details?.contactEmail || '';

  const storefrontShipping = (details?.shippingAddress ?? null) as Record<string, string> | null;
  const storefrontBilling = (details?.billingAddress ?? null) as Record<string, string> | null;
  const crmAddress = customer
    ? {
        address: customer.address ?? '',
        city: customer.city ?? '',
        state: customer.state ?? '',
        country: customer.country ?? '',
        postalCode: customer.postalCode ?? '',
      }
    : null;

  const billingInitial = details ? (storefrontBilling ?? {}) : (crmAddress ?? {});
  const shippingInitial = details ? (storefrontShipping ?? {}) : (crmAddress ?? {});

  return (
    <div>
      <PageHeader
        title={`Order ${sale.reference}`}
        description={`${sale.isOnline ? 'Storefront' : 'Point of sale'} order · placed ${formatDate(sale.createdAt, true)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/cms/orders"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <ArrowLeft size={15} /> All orders
            </Link>
            <PrintButton />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: items, totals, notes */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package size={15} className="text-zinc-400" /> Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table bare>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th className="text-right">Price</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Subtotal</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.saleItemId}>
                      <Td>
                        <Link
                          href={`/cms/products/${item.productId}/edit`}
                          className="font-medium text-zinc-900 hover:text-[#5b59d6]"
                        >
                          {item.productName || 'Product'}
                        </Link>
                        <span className="block text-xs text-zinc-400">
                          {item.variantName ? `${item.variantName} · ` : ''}
                          {item.sku}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        {formatMoney(item.unitPrice, currency)}
                      </Td>
                      <Td className="text-right">{item.quantity}</Td>
                      <Td className="whitespace-nowrap text-right font-medium text-zinc-900">
                        {formatMoney(item.subtotal, currency)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <Td colSpan={3} className="border-b-0 text-right text-zinc-500">
                      Subtotal
                    </Td>
                    <Td className="border-b-0 text-right font-medium text-zinc-900">
                      {formatMoney(sale.totalAmount, currency)}
                    </Td>
                  </tr>
                  <tr>
                    <Td colSpan={3} className="border-b-0 text-right text-zinc-500">
                      Discount
                    </Td>
                    <Td className="border-b-0 text-right font-medium text-zinc-900">
                      −{formatMoney(sale.discount, currency)}
                    </Td>
                  </tr>
                  <tr>
                    <Td colSpan={3} className="border-b-0 text-right text-zinc-500">
                      Tax
                    </Td>
                    <Td className="border-b-0 text-right font-medium text-zinc-900">
                      {formatMoney(sale.tax, currency)}
                    </Td>
                  </tr>
                  <tr>
                    <Td colSpan={3} className="border-b-0 bg-zinc-50 text-right text-sm font-semibold text-zinc-900">
                      Grand total
                    </Td>
                    <Td className="border-b-0 bg-zinc-50 text-right text-base font-semibold text-zinc-900">
                      {formatMoney(sale.grandTotal, currency)}
                    </Td>
                  </tr>
                </tfoot>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare size={15} className="text-zinc-400" /> Order notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {noteRows.length ? (
                <ul className="space-y-3">
                  {noteRows.map((note) => (
                    <li
                      key={note.id}
                      className={
                        note.isCustomerNote
                          ? 'rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3'
                          : 'rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-3'
                      }
                    >
                      <p className="whitespace-pre-wrap text-sm text-zinc-700">{note.body}</p>
                      <p className="mt-1.5 text-xs text-zinc-400">
                        {note.authorName ? `${note.authorName} · ` : ''}
                        {formatDate(note.createdAt, true)}
                        {note.isCustomerNote ? ' · visible to the customer' : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-400">No notes on this order yet.</p>
              )}
              <NoteComposer orderId={sale.id} />
            </CardContent>
          </Card>
        </div>

        {/* Right: status, fulfilment, customer, addresses, actions */}
        <div className="space-y-6">
          <Card id="fulfilment">
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Order state</span>
                <StatusBadge status={sale.status} />
              </div>
              <OrderStatusCard orderId={sale.id} status={sale.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck size={15} className="text-zinc-400" /> Fulfilment & tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrackingCard orderId={sale.id} initial={trackingValues} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={15} className="text-zinc-400" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {sale.customerId ? (
                <Link
                  href={`/cms/customers/${sale.customerId}`}
                  className="font-medium text-zinc-900 hover:text-[#5b59d6]"
                >
                  {customerName}
                </Link>
              ) : (
                <p className="font-medium text-zinc-900">{customerName}</p>
              )}
              {customerEmail ? <p className="text-zinc-500">{customerEmail}</p> : null}
              {customer?.phone || linkedUser?.phone ? (
                <p className="text-zinc-500">{customer?.phone || linkedUser?.phone}</p>
              ) : null}
              {linkedUser ? (
                <p className="pt-1 text-xs text-zinc-400">
                  Storefront account: {linkedUser.email || linkedUser.name}
                </p>
              ) : (
                <p className="pt-1 text-xs text-zinc-400">
                  No storefront account linked to this order.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={15} className="text-zinc-400" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Method</span>
                <span className="font-medium text-zinc-900">
                  {sale.paymentMethod || details?.paymentMethodId || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Delivery</span>
                <span className="font-medium text-zinc-900">
                  {details?.deliveryMethodId || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Currency</span>
                <span className="font-medium text-zinc-900">{currency}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Contact</span>
                <span className="truncate font-medium text-zinc-900">
                  {details?.contactPhone || details?.contactEmail || '—'}
                </span>
              </div>
              {details ? (
                <p className="pt-1 text-xs text-zinc-400">
                  Marketing opt-in: {details.marketingOptIn ? 'yes' : 'no'} · billing same as
                  shipping: {details.billingSameAsShipping ? 'yes' : 'no'}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing address</CardTitle>
            </CardHeader>
            <CardContent>
              <AddressCard
                orderId={sale.id}
                mode={details ? 'storefront' : 'customer'}
                kind="billing"
                initial={billingInitial}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping address</CardTitle>
            </CardHeader>
            <CardContent>
              <AddressCard
                orderId={sale.id}
                mode={details ? 'storefront' : 'customer'}
                kind="shipping"
                initial={shippingInitial}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {['Pending', 'Completed', 'Cancelled'].map((status) =>
                  status !== sale.status ? (
                    <StatusPill key={status} orderId={sale.id} status={status} />
                  ) : null,
                )}
              </div>
              <RefundDialog orderId={sale.id} reference={sale.reference} lines={refundLines} />
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                <span>Refunds & cancellations are logged in the order notes.</span>
                <Badge tone="neutral">{refundLines.length} lines</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { getTenantDb } from '@/db/index';
import * as tenantSchema from '@/db/schema-tenant';
import { requireAccountPrincipal } from '@/lib/account/data';
import { getT } from '@/lib/i18n/server';
import { orderPhases } from '@/lib/storefront/order-status';
import styles from '../../account.module.css';

export const metadata: Metadata = {
  title: 'Order',
  robots: {
    index: false,
    follow: false,
  },
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

function formatMoney(amount: string | number, currency: string) {
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function capabilityLabel(value: string) {
  return value.replace(/_/g, ' ');
}

/** Checkout stores addresses as flat string maps; render the non-empty parts as lines. */
function addressLines(address: Record<string, string> | null | undefined): string[] {
  if (!address) return [];
  const part = (key: string) => (address[key] ?? '').trim();
  const name = [part('firstName'), part('lastName')].filter(Boolean).join(' ');
  const locality = [part('city'), [part('region'), part('postalCode')].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return [name, part('company'), part('address1'), part('address2'), locality, part('country')]
    .filter(Boolean);
}

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id: rawId } = await params;
  const saleId = Number(rawId);
  if (!Number.isSafeInteger(saleId) || saleId <= 0) notFound();

  const principal = await requireAccountPrincipal(`/home/account/orders/${saleId}`);
  const t = await getT();
  const db = getTenantDb(principal.company.dbConnectionString, principal.company.dbSchema);

  // Only the purchaser's own online order resolves; anything else is a 404.
  const [order] = await db
    .select({
      id: tenantSchema.sales.id,
      reference: tenantSchema.sales.reference,
      status: tenantSchema.sales.status,
      totalAmount: tenantSchema.sales.totalAmount,
      grandTotal: tenantSchema.sales.grandTotal,
      createdAt: tenantSchema.sales.createdAt,
      currency: tenantSchema.storefrontOrderDetails.currency,
      contactEmail: tenantSchema.storefrontOrderDetails.contactEmail,
      contactPhone: tenantSchema.storefrontOrderDetails.contactPhone,
      shippingAddress: tenantSchema.storefrontOrderDetails.shippingAddress,
      billingAddress: tenantSchema.storefrontOrderDetails.billingAddress,
      deliveryMethodId: tenantSchema.storefrontOrderDetails.deliveryMethodId,
      paymentMethodId: tenantSchema.storefrontOrderDetails.paymentMethodId,
    })
    .from(tenantSchema.sales)
    .innerJoin(
      tenantSchema.storefrontOrderDetails,
      eq(tenantSchema.storefrontOrderDetails.saleId, tenantSchema.sales.id),
    )
    .where(and(
      eq(tenantSchema.sales.id, saleId),
      eq(tenantSchema.sales.customerUserId, principal.userId),
      eq(tenantSchema.sales.isOnline, true),
    ))
    .limit(1);
  if (!order) notFound();

  const items = await db
    .select({
      productId: tenantSchema.products.id,
      productName: tenantSchema.products.name,
      variantName: tenantSchema.productVariants.name,
      quantity: tenantSchema.saleItems.quantity,
      subtotal: tenantSchema.saleItems.subtotal,
    })
    .from(tenantSchema.saleItems)
    .innerJoin(
      tenantSchema.productVariants,
      eq(tenantSchema.productVariants.id, tenantSchema.saleItems.variantId),
    )
    .innerJoin(
      tenantSchema.products,
      eq(tenantSchema.products.id, tenantSchema.productVariants.productId),
    )
    .where(eq(tenantSchema.saleItems.saleId, order.id))
    .orderBy(asc(tenantSchema.saleItems.id));

  const orderPhase = (await orderPhases(db, [order])).get(order.id) ?? 'other';
  const billing = addressLines(order.billingAddress);
  const shipping = addressLines(order.shippingAddress);
  const payment = capabilityLabel(order.paymentMethodId);

  return (
    <div className={styles.pageStack}>
      <p className={styles.orderLead}>
        {t('account.order.prefix')} <strong>#{order.reference}</strong>{' '}
        {t('account.order.placedOn')} <strong>{formatDate(order.createdAt)}</strong>{' '}
        {t('account.order.andIs')} <strong>{orderPhase === 'other' ? order.status : t(`account.orderPhase.${orderPhase}`)}</strong>.
      </p>

      <section aria-labelledby="order-details-title">
        <h2 id="order-details-title" className={styles.sectionTitle}>
          {t('account.order.details')}
        </h2>
        <table className={styles.detailTable}>
          <thead>
            <tr>
              <th scope="col">{t('account.order.product')}</th>
              <th scope="col">{t('account.order.total')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.productId}-${index}`}>
                <td>
                  <Link href={`/home/products/${item.productId}`}>
                    {item.productName}
                    {item.variantName !== item.productName ? ` — ${item.variantName}` : ''}
                  </Link>{' '}
                  × {item.quantity}
                </td>
                <td>{formatMoney(item.subtotal, order.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t('account.order.subtotal')}</th>
              <td>{formatMoney(order.totalAmount, order.currency)}</td>
            </tr>
            <tr>
              <th scope="row">{t('account.order.shipping')}</th>
              <td>{capabilityLabel(order.deliveryMethodId)}</td>
            </tr>
            <tr>
              <th scope="row">{t('account.order.payment')}</th>
              <td>{payment}</td>
            </tr>
            <tr>
              <th scope="row">{t('account.order.grandTotal')}</th>
              <td>{formatMoney(order.grandTotal, order.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <div className={styles.addressColumns}>
        <section>
          <h2 className={styles.sectionTitle}>{t('account.order.billing')}</h2>
          <address className={styles.addressBox}>
            {billing.map((line, index) => (
              <span key={`${index}-${line}`}>{line}</span>
            ))}
            {order.contactPhone ? <span>{order.contactPhone}</span> : null}
            <span>{order.contactEmail}</span>
          </address>
        </section>
        <section>
          <h2 className={styles.sectionTitle}>{t('account.order.shippingAddress')}</h2>
          <address className={styles.addressBox}>
            {shipping.map((line, index) => (
              <span key={`${index}-${line}`}>{line}</span>
            ))}
          </address>
        </section>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { ArrowRight, PackageSearch, ShieldCheck } from 'lucide-react';
import { getTenantDb } from '@/db/index';
import * as tenantSchema from '@/db/schema-tenant';
import { requireAccountPrincipal } from '@/lib/account/data';
import { getT } from '@/lib/i18n/server';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Orders',
  robots: {
    index: false,
    follow: false,
  },
};

const MAX_ORDERS = 50;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

function formatMoney(amount: string | number, currency: string) {
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function statusTone(status: string) {
  if (status === 'Completed') return 'success';
  if (status === 'Cancelled' || status === 'Returned') return 'danger';
  return 'neutral';
}

function capabilityLabel(value: string) {
  return value.replace(/_/g, ' ');
}

type OrderListItem = {
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

export default async function AccountOrdersPage() {
  await connection();
  const principal = await requireAccountPrincipal('/home/account/orders');
  const t = await getT();
  const db = getTenantDb(principal.company.dbConnectionString, principal.company.dbSchema);

  // Ownership is exactly what checkout persisted: the dedicated storefront
  // purchaser user on an online sale. Legacy/POS sales stay hidden.
  const orders = await db
    .select({
      id: tenantSchema.sales.id,
      reference: tenantSchema.sales.reference,
      status: tenantSchema.sales.status,
      totalAmount: tenantSchema.sales.totalAmount,
      grandTotal: tenantSchema.sales.grandTotal,
      tax: tenantSchema.sales.tax,
      createdAt: tenantSchema.sales.createdAt,
      currency: tenantSchema.storefrontOrderDetails.currency,
      contactEmail: tenantSchema.storefrontOrderDetails.contactEmail,
      deliveryMethodId: tenantSchema.storefrontOrderDetails.deliveryMethodId,
      paymentMethodId: tenantSchema.storefrontOrderDetails.paymentMethodId,
    })
    .from(tenantSchema.sales)
    .innerJoin(
      tenantSchema.storefrontOrderDetails,
      eq(tenantSchema.storefrontOrderDetails.saleId, tenantSchema.sales.id),
    )
    .where(and(
      eq(tenantSchema.sales.customerUserId, principal.userId),
      eq(tenantSchema.sales.isOnline, true),
    ))
    .orderBy(desc(tenantSchema.sales.createdAt))
    .limit(MAX_ORDERS);

  const orderIds = orders.map((order) => order.id);
  const itemRows = orderIds.length > 0
    ? await db
        .select({
          saleId: tenantSchema.saleItems.saleId,
          quantity: tenantSchema.saleItems.quantity,
          unitPrice: tenantSchema.saleItems.unitPrice,
          subtotal: tenantSchema.saleItems.subtotal,
          productName: tenantSchema.products.name,
          variantName: tenantSchema.productVariants.name,
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
        .where(inArray(tenantSchema.saleItems.saleId, orderIds))
    : [];

  const itemsBySale = new Map<number, OrderListItem[]>();
  for (const row of itemRows) {
    const list = itemsBySale.get(row.saleId) ?? [];
    list.push({
      productName: row.productName,
      variantName: row.variantName,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      subtotal: row.subtotal,
    });
    itemsBySale.set(row.saleId, list);
  }

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <span className={styles.pageIcon} aria-hidden="true"><PackageSearch size={23} /></span>
        <div>
          <p className={styles.eyebrow}>{t('account.orders.eyebrow')}</p>
          <h2>{t('account.orders.title')}</h2>
          <p>{t('account.orders.lead')}</p>
        </div>
      </header>

      {orders.length === 0 ? (
        <section className={styles.emptyState} aria-labelledby="orders-empty-title">
          <span className={styles.emptyIcon} aria-hidden="true"><PackageSearch size={34} /></span>
          <div>
            <h3 id="orders-empty-title">{t('account.orders.emptyTitle')}</h3>
            <p>
              {t('account.orders.emptyBody')}
            </p>
          </div>
          <Link className={styles.primaryButton} href="/home/products">
            {t('account.orders.emptyAction')} <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <div className={styles.orderList}>
          {orders.map((order) => (
            <article key={order.id} className={styles.card} aria-labelledby={`order-${order.id}-title`}>
              <div className={styles.orderCardHeader}>
                <div>
                  <p className={styles.cardKicker}>{t('account.orders.reference')}</p>
                  <h3 id={`order-${order.id}-title`}>{order.reference}</h3>
                </div>
                <span className={styles.orderStatus} data-tone={statusTone(order.status)}>
                  {order.status}
                </span>
              </div>

              <dl className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <dt>{t('account.orders.placed')}</dt>
                  <dd>{formatDate(order.createdAt)}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt>{t('account.orders.total')}</dt>
                  <dd>{formatMoney(order.grandTotal, order.currency)}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt>{t('account.orders.delivery')}</dt>
                  <dd>{capabilityLabel(order.deliveryMethodId)}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt>{t('account.orders.payment')}</dt>
                  <dd>{capabilityLabel(order.paymentMethodId)}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt>{t('account.orders.confirmationEmail')}</dt>
                  <dd>{order.contactEmail}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt>{t('account.orders.itemsSubtotal')}</dt>
                  <dd>{formatMoney(order.totalAmount, order.currency)}</dd>
                </div>
              </dl>

              {(itemsBySale.get(order.id) ?? []).length > 0 ? (
                <ul className={styles.orderItems}>
                  {(itemsBySale.get(order.id) ?? []).map((item, index) => (
                    <li key={`${order.id}-${index}`} className={styles.orderItem}>
                      <span className={styles.orderItemName}>
                        {item.productName}
                        {item.variantName !== item.productName ? ` — ${item.variantName}` : ''}
                      </span>
                      <span className={styles.orderItemMeta}>
                        {item.quantity} × {formatMoney(item.unitPrice, order.currency)}
                      </span>
                      <span className={styles.orderItemTotal}>
                        {formatMoney(item.subtotal, order.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <div className={styles.infoNote} role="note">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          {t('account.orders.note')}
        </p>
      </div>
    </div>
  );
}

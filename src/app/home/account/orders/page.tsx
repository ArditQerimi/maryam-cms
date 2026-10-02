import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
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
      grandTotal: tenantSchema.sales.grandTotal,
      createdAt: tenantSchema.sales.createdAt,
      currency: tenantSchema.storefrontOrderDetails.currency,
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
        })
        .from(tenantSchema.saleItems)
        .where(inArray(tenantSchema.saleItems.saleId, orderIds))
    : [];

  const itemCountBySale = new Map<number, number>();
  for (const row of itemRows) {
    itemCountBySale.set(row.saleId, (itemCountBySale.get(row.saleId) ?? 0) + row.quantity);
  }

  if (orders.length === 0) {
    return (
      <div className={styles.pageStack}>
        <div className={styles.accountNotice}>
          <p>{t('account.orders.emptyNotice')}</p>
          <Link className={styles.noticeButton} href="/home/products">
            {t('account.orders.browse')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageStack}>
      <div className={styles.tableWrap}>
        <table className={styles.ordersTable}>
          <thead>
            <tr>
              <th scope="col">{t('account.orders.colOrder')}</th>
              <th scope="col">{t('account.orders.colDate')}</th>
              <th scope="col">{t('account.orders.colStatus')}</th>
              <th scope="col">{t('account.orders.colTotal')}</th>
              <th scope="col">{t('account.orders.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const count = itemCountBySale.get(order.id) ?? 0;
              const total = formatMoney(order.grandTotal, order.currency);
              return (
                <tr key={order.id}>
                  <td data-label={t('account.orders.colOrder')}>
                    <Link href={`/home/account/orders/${order.id}`}>#{order.reference}</Link>
                  </td>
                  <td data-label={t('account.orders.colDate')}>{formatDate(order.createdAt)}</td>
                  <td data-label={t('account.orders.colStatus')}>{order.status}</td>
                  <td data-label={t('account.orders.colTotal')}>
                    {t(
                      count === 1 ? 'account.orders.totalForItem' : 'account.orders.totalForItems',
                      { total, count },
                    )}
                  </td>
                  <td data-label={t('account.orders.colActions')}>
                    <Link className={styles.noticeButton} href={`/home/account/orders/${order.id}`}>
                      {t('account.orders.view')}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

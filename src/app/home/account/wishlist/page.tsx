import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getTenantDb } from '@/db/index';
import * as tenantSchema from '@/db/schema-tenant';
import { requireAccountPrincipal } from '@/lib/account/data';
import { getT } from '@/lib/i18n/server';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Wishlist',
  robots: {
    index: false,
    follow: false,
  },
};

const MAX_PREVIEW_ITEMS = 12;

function formatPrice(value: string | null) {
  if (value === null) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(amount);
}

export default async function AccountWishlistPage() {
  await connection();
  const principal = await requireAccountPrincipal('/home/account/wishlist');
  const t = await getT();
  const db = getTenantDb(principal.company.dbConnectionString, principal.company.dbSchema);

  // Signed-in shoppers' wishlist rows are persisted server-side
  // (wishlist_items keyed by this exact user id).
  const items = await db
    .select({
      productId: tenantSchema.products.id,
      name: tenantSchema.products.name,
      price: tenantSchema.products.price,
      addedAt: tenantSchema.wishlistItems.createdAt,
    })
    .from(tenantSchema.wishlistItems)
    .innerJoin(
      tenantSchema.products,
      eq(tenantSchema.products.id, tenantSchema.wishlistItems.productId),
    )
    .where(eq(tenantSchema.wishlistItems.userId, principal.userId))
    .orderBy(desc(tenantSchema.wishlistItems.createdAt))
    .limit(MAX_PREVIEW_ITEMS);

  if (items.length === 0) {
    return (
      <div className={styles.pageStack}>
        <p className={styles.plainNote}>{t('account.wishlist.empty')}</p>
      </div>
    );
  }

  return (
    <div className={styles.pageStack}>
      <div className={styles.tableWrap}>
        <table className={styles.ordersTable}>
          <thead>
            <tr>
              <th scope="col">{t('account.compare.product')}</th>
              <th scope="col">{t('account.compare.price')}</th>
              <th scope="col">{t('account.orders.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const price = formatPrice(item.price);
              return (
                <tr key={item.productId}>
                  <td data-label={t('account.compare.product')}>
                    <Link href={`/home/products/${item.productId}`}>{item.name}</Link>
                  </td>
                  <td data-label={t('account.compare.price')}>{price ?? '—'}</td>
                  <td data-label={t('account.orders.colActions')}>
                    <Link className={styles.noticeButton} href={`/home/products/${item.productId}`}>
                      {t('account.orders.view')}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        <Link className={styles.inlineTextLink} href="/home/wishlist">
          {t('account.wishlist.openFull')}
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { ArrowRight, Heart, Info } from 'lucide-react';
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

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <span className={styles.pageIcon} aria-hidden="true"><Heart size={23} /></span>
        <div>
          <p className={styles.eyebrow}>{t('account.wishlist.eyebrow')}</p>
          <h2>{t('account.wishlist.title')}</h2>
          <p>
            {items.length > 0
              ? items.length === 1
                ? t('account.wishlist.leadOne', { count: items.length })
                : t('account.wishlist.leadOther', { count: items.length })
              : t('account.wishlist.leadEmpty')}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <section className={styles.emptyState} aria-labelledby="wishlist-empty-title">
          <span className={styles.emptyIcon} aria-hidden="true"><Heart size={34} /></span>
          <div>
            <h3 id="wishlist-empty-title">{t('account.wishlist.emptyTitle')}</h3>
            <p>
              {t('account.wishlist.emptyBody')}
            </p>
          </div>
          <Link className={styles.primaryButton} href="/home/products">
            {t('account.wishlist.browse')} <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <section className={styles.wishlistSummary} aria-label={t('account.wishlist.summaryAria')}>
          <div className={styles.wishlistMiniGrid}>
            {items.map((item) => {
              const price = formatPrice(item.price);
              return (
                <Link
                  key={item.productId}
                  className={styles.wishlistMiniCard}
                  href={`/home/products/${item.productId}`}
                >
                  <span className={styles.wishlistMiniName}>{item.name}</span>
                  {price ? <span className={styles.wishlistMiniPrice}>{price}</span> : null}
                </Link>
              );
            })}
          </div>
          <div>
            <Link href="/home/wishlist" className={styles.primaryButton}>
              {t('account.wishlist.openFull')} <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      <div className={styles.infoNote} role="note">
        <Info size={18} aria-hidden="true" />
        <p>
          {t('account.wishlist.note')}
        </p>
      </div>
    </div>
  );
}

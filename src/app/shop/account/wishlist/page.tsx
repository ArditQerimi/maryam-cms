import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Heart, Info } from 'lucide-react';
import { requireAccountCustomer } from '@/lib/account/data';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Wishlist',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountWishlistPage() {
  await requireAccountCustomer('/shop/account/wishlist');

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <span className={styles.pageIcon} aria-hidden="true"><Heart size={23} /></span>
        <div>
          <p className={styles.eyebrow}>Saved for later</p>
          <h2>Wishlist</h2>
          <p>Continue to the wishlist already provided by this storefront.</p>
        </div>
      </header>

      <section className={styles.featureCard} aria-labelledby="wishlist-link-title">
        <div className={styles.featureCardCopy}>
          <p className={styles.cardKicker}>Current wishlist</p>
          <h3 id="wishlist-link-title">Open saved products</h3>
          <p>
            The existing wishlist is private to this browser. Account synchronization is not
            connected in this increment, so no server-side saved-item count is shown here.
          </p>
        </div>
        <Link href="/shop/wishlist" className={styles.primaryButton}>
          View wishlist <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <div className={styles.infoNote} role="note">
        <Info size={18} aria-hidden="true" />
        <p>
          For an honest account view, this page does not present browser-local items as though they
          were persisted to your customer profile.
        </p>
      </div>
    </div>
  );
}

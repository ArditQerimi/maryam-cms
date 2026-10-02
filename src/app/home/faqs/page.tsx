import Link from 'next/link';
import styles from '../shop.module.css';

export default function ShopFaqsPage() {
  return (
    <div className={styles.shopPageWrap}>
      <div className={styles.container}>
        <nav className={styles.shopPageBreadcrumb} aria-label="breadcrumbs">
          <Link href="/shop">Home</Link>
          <span>/</span>
          <span>FAQs</span>
        </nav>

        <section className={styles.wishlistEmptyState}>
          <h2>FAQs</h2>
          <p>Frequently asked questions route is now connected from the menu.</p>
        </section>
      </div>
    </div>
  );
}

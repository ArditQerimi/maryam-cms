import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import styles from '../bookstore.module.css';

export default async function BookstoreAbout({
  productImage,
  productName,
}: {
  productImage?: string;
  productName?: string;
}) {
  const t = await getT();
  return (
    <section className={styles.unlock}>
      <div className={styles.container}>
        <div className={styles.unlockInner}>
          <div className={styles.unlockCopy}>
            <p className={styles.unlockDate}>{t('home.about.eyebrow')}</p>
            <h2 className={styles.unlockTitle}>{t('home.about.title')}</h2>
            <p className={styles.unlockLead}>{t('home.about.lead')}</p>
            <p className={styles.unlockCta}>{t('home.about.cta')}</p>
            <div className={styles.unlockBadges}>
              <Link href="/home/products" className={styles.storeBadge}>
                <span className={styles.storeBadgeSmall}>{t('home.about.badgeBrowse')}</span>
                <span className={styles.storeBadgeLarge}>{t('home.about.badgeCatalog')}</span>
              </Link>
              <Link href="/home/blogs" className={styles.storeBadgeAlt}>
                <span>{t('home.about.badgeRead')}</span>
                <strong>{t('home.about.badgeBlog')}</strong>
              </Link>
            </div>
          </div>

          <div className={styles.unlockFeature}>
            <div className={styles.unlockLeaves} aria-hidden="true" />
            <div className={styles.unlockBook}>
              {productImage ? (
                <img src={productImage} alt={productName || t('home.about.imageAlt')} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

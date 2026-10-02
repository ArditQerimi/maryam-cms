import { getT } from '@/lib/i18n/server';
import styles from './home-products.module.css';

export default async function ShopProductsLoading() {
  const t = await getT();

  return (
    <div className={styles.loadingPage} aria-busy="true" aria-label={t('catalog.loading_aria')}>
      <span className={styles.visuallyHidden}>{t('catalog.loading_text')}</span>
      <div className={styles.loadingHero}>
        <span className={`${styles.skeletonBlock} ${styles.loadingTitle}`} />
      </div>
      <div className={styles.loadingBody}>
        <div className={styles.loadingToolbar}>
          <span className={`${styles.skeletonBlock} ${styles.loadingCount}`} />
          <span className={`${styles.skeletonBlock} ${styles.loadingSort}`} />
        </div>
        <div className={styles.loadingGrid} aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <div className={styles.loadingCard} key={index}>
              <span className={`${styles.skeletonBlock} ${styles.loadingImage}`} />
              <span className={`${styles.skeletonBlock} ${styles.loadingCategory}`} />
              <span className={`${styles.skeletonBlock} ${styles.loadingTitleLine}`} />
              <span className={`${styles.skeletonBlock} ${styles.loadingPrice}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

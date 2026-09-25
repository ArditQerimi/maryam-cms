import styles from './shop-products.module.css';

export default function ShopProductsLoading() {
  return (
    <div className={styles.loadingPage} aria-busy="true" aria-label="Loading products">
      <span className={styles.visuallyHidden}>Loading products…</span>
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

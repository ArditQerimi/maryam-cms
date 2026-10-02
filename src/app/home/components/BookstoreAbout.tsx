import Link from 'next/link';
import styles from '../bookstore.module.css';

export default function BookstoreAbout({
  productImage,
  productName,
}: {
  productImage?: string;
  productName?: string;
}) {
  return (
    <section className={styles.unlock}>
      <div className={styles.container}>
        <div className={styles.unlockInner}>
          <div className={styles.unlockCopy}>
            <p className={styles.unlockDate}>Katalogu aktual</p>
            <h2 className={styles.unlockTitle}>ZBULO BOTËT E REJA</h2>
            <p className={styles.unlockLead}>
              Në një përzgjedhje të kujdesshme titujsh, gjeni libra që zgjojnë
              mendjen dhe prekin zemrën — nga tefsiri klasik te veprat
              bashkëkohore për familjen dhe rrugëtimin shpirtëror.
            </p>
            <p className={styles.unlockCta}>Zgjidhni titujin tuaj të radhës</p>
            <div className={styles.unlockBadges}>
              <Link href="/shop/products" className={styles.storeBadge}>
                <span className={styles.storeBadgeSmall}>Shfleto</span>
                <span className={styles.storeBadgeLarge}>Katalogun</span>
              </Link>
              <Link href="/shop/blogs" className={styles.storeBadgeAlt}>
                <span>Lexo</span>
                <strong>blogun</strong>
              </Link>
            </div>
          </div>

          <div className={styles.unlockFeature}>
            <div className={styles.unlockLeaves} aria-hidden="true" />
            <div className={styles.unlockBook}>
              {productImage ? (
                <img src={productImage} alt={productName || 'Libër i përzgjedhur'} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

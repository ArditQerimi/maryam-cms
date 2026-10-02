import Link from 'next/link';
import styles from '../bookstore.module.css';
import type { getProducts } from '@/lib/actions';
import { getT } from '@/lib/i18n/server';
import { getSingleActiveCatalogVariant, getStorefrontCatalogStock } from '../catalog-variants';

type ProductRecord = Awaited<ReturnType<typeof getProducts>>[number];

/** Editorial product feature using only current catalog data. */
export default async function BookstoreStory({ products }: { products: ProductRecord[] }) {
  const t = await getT();
  const withImage = products.filter((product) => product.status === 'Active' && product.imageUrl);
  const feature = withImage[6] ?? withImage[0];
  if (!feature) return null;

  const selectedVariant = getSingleActiveCatalogVariant(feature.variants);
  const price = Number(selectedVariant?.price ?? feature.price);
  const formattedPrice = Number.isFinite(price)
    ? `€${price.toFixed(2)}`
    : t('home.story.priceUnavailable');
  const stockQuantity = getStorefrontCatalogStock(feature.stockQuantity, feature.variants);

  return (
    <section className={styles.story}>
      <div className={styles.container}>
        <div className={styles.storyInner}>
          <div className={styles.storyCopy}>
            <p className={styles.sectionEyebrowLeft}>{t('home.eyebrow')}</p>
            <h2 className={styles.storyTitle}>
              {t('home.story.title.line1')}<br />{t('home.story.title.line2')}
            </h2>
            <p className={styles.storyLead}>
              {t('home.story.lead')}
            </p>
            <Link href={`/home/products/${feature.id}`} className={styles.storyCta}>
              {t('home.readMore')}
            </Link>
          </div>

          <div className={styles.storyCard}>
            <div className={styles.storyBadge}>{t('home.story.badge')}</div>
            <div className={styles.storyImage}>
              <img src={feature.imageUrl ?? ''} alt={feature.name} />
            </div>
            <div className={styles.storyMeta}>
              <h4>{feature.name}</h4>
              <div className={styles.storyPriceRow}>
                <span className={styles.productPrice}>{formattedPrice}</span>
              </div>
              <p className={styles.storyLead}>
                {stockQuantity > 0
                  ? t('home.story.stock', { count: stockQuantity })
                  : t('home.story.outOfStock')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

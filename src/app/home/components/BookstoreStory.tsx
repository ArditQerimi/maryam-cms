import Link from 'next/link';
import styles from '../bookstore.module.css';
import type { getProducts } from '@/lib/actions';
import { getSingleActiveCatalogVariant, getStorefrontCatalogStock } from '../catalog-variants';

type ProductRecord = Awaited<ReturnType<typeof getProducts>>[number];

/** Editorial product feature using only current catalog data. */
export default function BookstoreStory({ products }: { products: ProductRecord[] }) {
  const withImage = products.filter((product) => product.status === 'Active' && product.imageUrl);
  const feature = withImage[6] ?? withImage[0];
  if (!feature) return null;

  const selectedVariant = getSingleActiveCatalogVariant(feature.variants);
  const price = Number(selectedVariant?.price ?? feature.price);
  const formattedPrice = Number.isFinite(price) ? `€${price.toFixed(2)}` : 'Price unavailable';
  const stockQuantity = getStorefrontCatalogStock(feature.stockQuantity, feature.variants);

  return (
    <section className={styles.story}>
      <div className={styles.container}>
        <div className={styles.storyInner}>
          <div className={styles.storyCopy}>
            <p className={styles.sectionEyebrowLeft}>Your Shopping Expo</p>
            <h2 className={styles.storyTitle}>
              ÇDO FAQE<br />TREGON NJË HISTORI
            </h2>
            <p className={styles.storyLead}>
              Çdo kapitull ka ritmin e vet. Zgjidhni një titull të ruajtur nga
              katalogu dhe gjeni një histori që ia vlen kohën tuaj.
            </p>
            <Link href={`/shop/products/${feature.id}`} className={styles.storyCta}>
              Lexo më shumë
            </Link>
          </div>

          <div className={styles.storyCard}>
            <div className={styles.storyBadge}>LIBËR</div>
            <div className={styles.storyImage}>
              <img src={feature.imageUrl ?? ''} alt={feature.name} />
            </div>
            <div className={styles.storyMeta}>
              <h4>{feature.name}</h4>
              <div className={styles.storyPriceRow}>
                <span className={styles.productPrice}>{formattedPrice}</span>
              </div>
              <p className={styles.storyLead}>
                {stockQuantity > 0 ? `${stockQuantity} në stock` : 'Momentarily out of stock'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

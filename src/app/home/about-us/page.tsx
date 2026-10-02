import type { Metadata } from 'next';
import { connection } from 'next/server';
import styles from '../bookstore.module.css';
import ShopPageHeader from '../components/ShopPageHeader';
import { getCategories, getProducts } from '@/lib/actions';
import { getContextCompany } from '@/lib/tenant';
import { parseImageUrl } from '@/lib/image-url';
import { getT } from '@/lib/i18n/server';
import { getStorefrontCatalogStock } from '../catalog-variants';

export const metadata: Metadata = {
  title: 'Rreth nesh',
  description: 'Informacionet e katalogut aktual, kategorive dhe titujve të disponueshëm në storefront.',
};

const BookIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="36" height="40" rx="2" />
    <line x1="14" y1="4" x2="14" y2="44" />
    <line x1="20" y1="16" x2="36" y2="16" />
    <line x1="20" y1="24" x2="36" y2="24" />
  </svg>
);

const CatalogIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
  </svg>
);

const StockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 4 4L19 6" />
  </svg>
);

export default async function ShopAboutUsPage() {
  await connection();
  const t = await getT();

  const [company, products, categories] = await Promise.all([
    getContextCompany().catch(() => null),
    getProducts({ limit: 500 }).catch(() => []),
    getCategories().catch(() => []),
  ]);
  const activeProducts = products.filter((product) => product.status === 'Active');
  const activeCategories = categories.filter((category) => category.status === 'Active');
  const productImages = activeProducts.flatMap((product) => {
    const image = parseImageUrl(product.imageUrl);
    return image ? [{ image, name: product.name }] : [];
  });
  const inStock = activeProducts.filter(
    (product) => getStorefrontCatalogStock(product.stockQuantity, product.variants) > 0,
  ).length;
  const brandCount = new Set(activeProducts.map((product) => product.brandId).filter(Boolean)).size;
  const numberFormatter = new Intl.NumberFormat('en-US');
  const storeName = company?.name?.trim() || 'Store';

  const stats = [
    { number: numberFormatter.format(activeProducts.length), label: t('pages.about.statProducts') },
    { number: numberFormatter.format(inStock), label: t('pages.about.statInStock') },
    { number: numberFormatter.format(activeCategories.length), label: t('pages.about.statCategories') },
    { number: numberFormatter.format(brandCount), label: t('pages.about.statBrands') },
  ];

  return (
    <div className={styles.aboutPage}>
      {/* Same banner component as /home/products and /home/blogs. */}
      <ShopPageHeader title={t('pages.about.title')} crumbs={[{ label: t('pages.about.title') }]} />

      <section className={styles.aboutIntro}>
        <div className={styles.container}>
          <div className={styles.aboutIntroInner}>
            <div>
              <p className={styles.aboutIntroLabel}>{storeName}</p>
              <h2 className={styles.aboutIntroTitle}>{t('pages.about.introTitle')}</h2>
              <p className={styles.aboutIntroText}>
                {t('pages.about.introText')}
              </p>
              <ul className={styles.aboutIntroChecks}>
                <li>{t('pages.about.checkCatalog', { count: numberFormatter.format(activeProducts.length) })}</li>
                <li>{t('pages.about.checkStock', { count: numberFormatter.format(inStock) })}</li>
                <li>{t('pages.about.checkCategories', { count: numberFormatter.format(activeCategories.length) })}</li>
                <li>{t('pages.about.checkVerified')}</li>
              </ul>
            </div>

            <div className={styles.aboutIntroImages}>
              {productImages.slice(0, 2).map((product) => (
                <img
                  key={product.image}
                  src={product.image}
                  alt={product.name}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.stats}>
        <div className={styles.container}>
          <div className={styles.statsGrid}>
            {stats.map((stat) => (
              <div key={stat.label} className={styles.statCard}>
                <div className={styles.statNumber}>{stat.number}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.aboutFeature}>
        <div className={styles.container}>
          <div className={styles.aboutFeatureInner}>
            <div className={styles.aboutFeatureImage}>
              {productImages[2] ? (
                <img src={productImages[2].image} alt={productImages[2].name} />
              ) : null}
            </div>

            <div>
              <p className={styles.aboutFeatureLabel}>{t('pages.about.featureLabel')}</p>
              <h2 className={styles.aboutFeatureTitle}>
                {t('pages.about.featureTitle', { count: numberFormatter.format(activeProducts.length) })}
              </h2>
              <p className={styles.aboutFeatureText}>
                {t('pages.about.featureText1', {
                  categories: numberFormatter.format(activeCategories.length),
                  brands: numberFormatter.format(brandCount),
                })}
              </p>
              <p className={styles.aboutFeatureText}>
                {t('pages.about.featureText2')}
              </p>

              <div className={styles.aboutFeatureIcons}>
                <div className={styles.aboutFeatureIcon}>
                  <CatalogIcon />
                  <span>{t('pages.about.iconCatalog')}</span>
                </div>
                <div className={styles.aboutFeatureIcon}>
                  <StockIcon />
                  <span>{t('pages.about.iconStock')}</span>
                </div>
                <div className={styles.aboutFeatureIcon}>
                  <BookIcon />
                  <span>{t('pages.about.iconDetails')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.aboutBrandStrip} aria-hidden="true">
        <div className={styles.container}>
          <div className={styles.aboutBrandList}>
            {[1, 2, 3, 4, 5].map((item) => <BookIcon key={item} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

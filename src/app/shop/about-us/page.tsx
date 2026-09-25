import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import styles from '../bookstore.module.css';
import { getCategories, getProducts } from '@/lib/actions';
import { getContextCompany } from '@/lib/tenant';
import { parseImageUrl } from '@/lib/image-url';
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
    { number: numberFormatter.format(activeProducts.length), label: 'Tituj aktualë' },
    { number: numberFormatter.format(inStock), label: 'Në stock' },
    { number: numberFormatter.format(activeCategories.length), label: 'Kategori' },
    { number: numberFormatter.format(brandCount), label: 'Brende' },
  ];

  return (
    <div className={styles.aboutPage}>
      <div className={styles.container}>
        <nav className={styles.aboutBreadcrumb} aria-label="breadcrumbs">
          <Link href="/shop">Home</Link>
          <span>/</span>
          <span>Rreth nesh</span>
        </nav>
        <h1 className={styles.aboutPageHeader}>Rreth nesh</h1>
      </div>

      <section className={styles.aboutIntro}>
        <div className={styles.container}>
          <div className={styles.aboutIntroInner}>
            <div>
              <p className={styles.aboutIntroLabel}>{storeName}</p>
              <h2 className={styles.aboutIntroTitle}>KATALOGU YNË I LIBRAVE</h2>
              <p className={styles.aboutIntroText}>
                Kjo faqe tregon informacionet që vijnë nga katalogu aktual i
                storefront-it. Titujt, çmimet, kategoritë dhe disponueshmëria
                shfaqen nga të dhënat reale të tenant-it.
              </p>
              <ul className={styles.aboutIntroChecks}>
                <li>{numberFormatter.format(activeProducts.length)} tituj në katalog</li>
                <li>{numberFormatter.format(inStock)} tituj me stock aktual</li>
                <li>{numberFormatter.format(activeCategories.length)} kategori aktive</li>
                <li>Informacione të produktit dhe variante të verifikuara nga serveri</li>
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
              <p className={styles.aboutFeatureLabel}>Katalogu aktual</p>
              <h2 className={styles.aboutFeatureTitle}>
                {numberFormatter.format(activeProducts.length)} TITUJ NË KATALOG
              </h2>
              <p className={styles.aboutFeatureText}>
                Katalogu përfshin {numberFormatter.format(activeCategories.length)} kategori
                dhe {numberFormatter.format(brandCount)} brende. Çdo titull hap faqen e vet
                të produktit për sku, variant, çmim dhe informacion real disponueshmërie.
              </p>
              <p className={styles.aboutFeatureText}>
                Shfletoni katalogun, krahasoni titujt dhe vazhdoni te detajet e
                produktit. Çmimet dhe disponueshmëria mund të ndryshojnë dhe validohen
                përsëri nga backend-i para porosisë.
              </p>

              <div className={styles.aboutFeatureIcons}>
                <div className={styles.aboutFeatureIcon}>
                  <CatalogIcon />
                  <span>Katalogu i tenant-it</span>
                </div>
                <div className={styles.aboutFeatureIcon}>
                  <StockIcon />
                  <span>Stock i verifikuar</span>
                </div>
                <div className={styles.aboutFeatureIcon}>
                  <BookIcon />
                  <span>Detaje reale produkti</span>
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

import styles from '../bookstore.module.css';
import type { getCategories, getProducts } from '@/lib/actions';
import { getT } from '@/lib/i18n/server';
import { getStorefrontCatalogStock } from '../catalog-variants';

const numberFormatter = new Intl.NumberFormat('en-US');

type ProductRecord = Awaited<ReturnType<typeof getProducts>>[number];
type CategoryRecord = Awaited<ReturnType<typeof getCategories>>[number];

export default async function BookstoreStats({
  products,
  categories,
}: {
  products: ProductRecord[];
  categories: CategoryRecord[];
}) {
  const t = await getT();
  const activeProducts = products.filter((product) => product.status === 'Active');
  const inStock = activeProducts.filter(
    (product) => getStorefrontCatalogStock(product.stockQuantity, product.variants) > 0,
  ).length;
  const activeCategories = categories.filter((category) => category.status === 'Active').length;

  const stats = [
    { number: numberFormatter.format(activeProducts.length), label: t('home.stats.titles') },
    { number: numberFormatter.format(inStock), label: t('home.stats.stock') },
    { number: numberFormatter.format(activeCategories), label: t('home.stats.categories') },
    { number: numberFormatter.format(new Set(activeProducts.map((product) => product.brandId).filter(Boolean)).size), label: t('home.stats.brands') },
  ];

  return (
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
  );
}

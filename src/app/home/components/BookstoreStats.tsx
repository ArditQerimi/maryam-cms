import styles from '../bookstore.module.css';
import type { getCategories, getProducts } from '@/lib/actions';
import { getStorefrontCatalogStock } from '../catalog-variants';

const numberFormatter = new Intl.NumberFormat('en-US');

type ProductRecord = Awaited<ReturnType<typeof getProducts>>[number];
type CategoryRecord = Awaited<ReturnType<typeof getCategories>>[number];

export default function BookstoreStats({
  products,
  categories,
}: {
  products: ProductRecord[];
  categories: CategoryRecord[];
}) {
  const activeProducts = products.filter((product) => product.status === 'Active');
  const inStock = activeProducts.filter(
    (product) => getStorefrontCatalogStock(product.stockQuantity, product.variants) > 0,
  ).length;
  const activeCategories = categories.filter((category) => category.status === 'Active').length;

  const stats = [
    { number: numberFormatter.format(activeProducts.length), label: 'Tituj aktualë' },
    { number: numberFormatter.format(inStock), label: 'Në stock' },
    { number: numberFormatter.format(activeCategories), label: 'Kategori' },
    { number: numberFormatter.format(new Set(activeProducts.map((product) => product.brandId).filter(Boolean)).size), label: 'Brende' },
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

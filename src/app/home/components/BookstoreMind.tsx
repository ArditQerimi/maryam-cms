import styles from '../bookstore.module.css';
import { parseImageUrl } from '@/lib/image-url';
import type { getCategories, getProducts } from '@/lib/actions';

type CategoryRecord = Awaited<ReturnType<typeof getCategories>>[number];
type ProductRecord = Awaited<ReturnType<typeof getProducts>>[number];

export default function BookstoreMind({
  categories,
  products,
}: {
  categories: CategoryRecord[];
  products: ProductRecord[];
}) {
  const visibleCategories = categories
    .filter((category) => category.status === 'Active' && category.name.trim())
    .slice(0, 5);
  const featuredProduct = products.find(
    (product) => product.status === 'Active' && parseImageUrl(product.imageUrl),
  );

  return (
    <section className={styles.mind}>
      <div className={styles.container}>
        <div className={styles.mindInner}>
          <div className={styles.mindImage}>
            {featuredProduct ? (
              <img
                src={parseImageUrl(featuredProduct.imageUrl)}
                alt={featuredProduct.name}
              />
            ) : null}
          </div>
          <div className={styles.mindCopy}>
            <p className={styles.sectionEyebrowLeft}>Rreth katalogut</p>
            <h2 className={styles.mindTitle}>
              ZGJERO<br />MENDJEN TËNDE<br />ÇDO DITË
            </h2>
            <p className={styles.mindLead}>
              Dituria fiton nga leximi i qëndrueshëm. Shfleto kategoritë aktuale
              dhe zgjidh titullin që i përshtatet pyetjes suaj.
            </p>
            {visibleCategories.length > 0 ? (
              <div className={styles.mindPartners} aria-label="Kategoritë aktuale">
                {visibleCategories.map((category) => (
                  <span key={category.id} className={styles.mindPartner}>{category.name}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

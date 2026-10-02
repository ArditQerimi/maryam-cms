import { getT } from '@/lib/i18n/server';
import styles from '../bookstore.module.css';
import { parseImageUrl } from '@/lib/image-url';
import type { getCategories, getProducts } from '@/lib/actions';

type CategoryRecord = Awaited<ReturnType<typeof getCategories>>[number];
type ProductRecord = Awaited<ReturnType<typeof getProducts>>[number];

export default async function BookstoreMind({
  categories,
  products,
}: {
  categories: CategoryRecord[];
  products: ProductRecord[];
}) {
  const t = await getT();
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
            <p className={styles.sectionEyebrowLeft}>{t('home.mind.eyebrow')}</p>
            <h2 className={styles.mindTitle}>
              {t('home.mind.title.line1')}<br />{t('home.mind.title.line2')}<br />{t('home.mind.title.line3')}
            </h2>
            <p className={styles.mindLead}>
              {t('home.mind.lead')}
            </p>
            {visibleCategories.length > 0 ? (
              <div className={styles.mindPartners} aria-label={t('home.mind.categoriesLabel')}>
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

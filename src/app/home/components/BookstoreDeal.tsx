import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import styles from '../bookstore.module.css';
import type { getProducts } from '@/lib/actions';
import { parseImageUrl } from '@/lib/image-url';

type ProductRecord = Awaited<ReturnType<typeof getProducts>>[number];

/** "Novel that inspire" — big book photo on the left, copy on the right */
export default async function BookstoreDeal({ products }: { products: ProductRecord[] }) {
  const t = await getT();
  const withImage = products.filter((product) => product.status === 'Active' && product.imageUrl);
  const featured = withImage[3] ?? withImage[0];
  if (!featured) return null;

  return (
    <section className={styles.novel}>
      <div className={styles.container}>
        <div className={styles.novelInner}>
          <div className={styles.novelImage}>
            <img src={parseImageUrl(featured.imageUrl)} alt={featured.name} />
          </div>
          <div className={styles.novelBody}>
            <p className={styles.sectionEyebrowLeft}>{t('home.eyebrow')}</p>
            <h2 className={styles.novelTitle}>
              {t('home.deal.title.line1')}<br />{t('home.deal.title.line2')}
            </h2>
            <p className={styles.novelLead}>
              {t('home.deal.lead')}
            </p>
            <Link href={`/home/products/${featured.id}`} className={styles.novelCta}>
              {t('home.readMore')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

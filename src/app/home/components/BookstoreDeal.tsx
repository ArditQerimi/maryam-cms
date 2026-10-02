import Link from 'next/link';
import styles from '../bookstore.module.css';
import type { getProducts } from '@/lib/actions';
import { parseImageUrl } from '@/lib/image-url';

type ProductRecord = Awaited<ReturnType<typeof getProducts>>[number];

/** "Novel that inspire" — big book photo on the left, copy on the right */
export default function BookstoreDeal({ products }: { products: ProductRecord[] }) {
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
            <p className={styles.sectionEyebrowLeft}>Your Shopping Expo</p>
            <h2 className={styles.novelTitle}>
              LIBRA QË FRYMËZOJNË<br />JETËN TUAJ
            </h2>
            <p className={styles.novelLead}>
              Një përzgjedhje titujsh nga katalogu aktual — libra që mbeten
              me tërësi në raftet tona dhe japin shenjë të qëndrueshme.
            </p>
            <Link href={`/shop/products/${featured.id}`} className={styles.novelCta}>
              Lexo më shumë
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

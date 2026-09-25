import styles from '../bookstore.module.css';
import type { getProducts } from '@/lib/actions';
import ProductCarousel, { type CarouselProduct } from './ProductCarousel';
import { parseImageUrl } from '@/lib/image-url';
import {
  getSingleActiveCatalogVariant,
  getStorefrontCatalogStock,
} from '../catalog-variants';

type ProductRecord = Awaited<ReturnType<typeof getProducts>>[number];

type Props = {
  products: ProductRecord[];
  eyebrow?: string;
  title: string;
  limit?: number;
  offset?: number;
};

export default function BookstoreProducts({
  products,
  eyebrow = 'Your Shopping Expo',
  title,
  limit = 12,
  offset = 0,
}: Props) {
  const actualLimit = Math.max(limit, 10);
  const withImage = products.filter((product) => product.status === 'Active' && product.imageUrl);
  const slice = withImage.slice(offset, offset + actualLimit);

  const carouselProducts: CarouselProduct[] = slice.map((p) => {
    const selectedVariant = getSingleActiveCatalogVariant(p.variants);
    const price = Number(selectedVariant?.price ?? p.price);
    return {
      id: p.id,
      name: p.name,
      price,
      imageUrl: parseImageUrl(p.imageUrl),
      stockQuantity: getStorefrontCatalogStock(p.stockQuantity, p.variants),
      variantId: selectedVariant?.id ?? null,
      description: p.description ?? '',
      categoryName: p.category?.name ?? 'Libra',
      categoryId: p.categoryId ?? null,
    };
  });

  return (
    <section className={styles.productsSection}>
      <div className={styles.container}>
        {eyebrow ? <p className={styles.sectionEyebrow}>{eyebrow}</p> : null}
        <h2 className={styles.sectionTitle}>{title}</h2>

        <ProductCarousel products={carouselProducts} />
      </div>
    </section>
  );
}

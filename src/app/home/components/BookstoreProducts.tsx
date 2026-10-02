import styles from '../bookstore.module.css';
import type { getProducts } from '@/lib/actions';
import ProductCarousel, { type CarouselProduct } from './ProductCarousel';
import { parseImageUrl } from '@/lib/image-url';
import { getT } from '@/lib/i18n/server';
import {
  getSingleActiveCatalogVariant,
  getStorefrontCatalogStock,
} from '../catalog-variants';

type ProductRecord = Awaited<ReturnType<typeof getProducts>>[number];

type Props = {
  products: ProductRecord[];
  /**
   * Effective discounted price per product id — the homepage sections pass
   * it so sale items show what shoppers actually pay (never higher than
   * the variant/list price).
   */
  salePriceById?: Map<number, number>;
  /** Admin store rating (1–5) per product id — the cards render stars. */
  ratingById?: Map<number, number>;
  /** Section eyebrow; omitted → the localized default ("Your Shopping Expo"). */
  eyebrow?: string;
  title: string;
  /** Carousel scrolls sideways; grid wraps into rows — same product card. */
  layout?: 'carousel' | 'grid';
  limit?: number;
  offset?: number;
};

export default async function BookstoreProducts({
  products,
  salePriceById,
  ratingById,
  eyebrow,
  title,
  layout = 'carousel',
  limit = 12,
  offset = 0,
}: Props) {
  const t = await getT();
  // The builder's default eyebrow falls back to the localized one.
  const eyebrowText = eyebrow ?? t('home.eyebrow');
  // Honour the admin's "Number of products" exactly — no minimum padding.
  const actualLimit = limit > 0 ? limit : 12;
  const withImage = products.filter((product) => product.status === 'Active' && product.imageUrl);
  const slice = withImage.slice(offset, offset + actualLimit);

  const carouselProducts: CarouselProduct[] = slice.map((p) => {
    const selectedVariant = getSingleActiveCatalogVariant(p.variants);
    const listPrice = Number(selectedVariant?.price ?? p.price);
    const sale = salePriceById?.get(p.id);
    const onSale = sale != null && sale > 0 && sale < listPrice;
    const price = onSale ? sale : listPrice;
    return {
      id: p.id,
      name: p.name,
      price,
      // Same price pair as the catalog listing: struck-through list price
      // when an active discount applies.
      originalPrice: onSale ? listPrice : null,
      imageUrl: parseImageUrl(p.imageUrl),
      stockQuantity: getStorefrontCatalogStock(p.stockQuantity, p.variants),
      variantId: selectedVariant?.id ?? null,
      description: p.description ?? '',
      categoryName: p.category?.name ?? t('home.category.fallback'),
      categoryId: p.categoryId ?? null,
      rating: ratingById?.get(p.id) ?? null,
    };
  });

  return (
    <section className={styles.productsSection}>
      <div className={styles.container}>
        {eyebrowText ? <p className={styles.sectionEyebrow}>{eyebrowText}</p> : null}
        {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}

        <ProductCarousel products={carouselProducts} layout={layout} />
      </div>
    </section>
  );
}

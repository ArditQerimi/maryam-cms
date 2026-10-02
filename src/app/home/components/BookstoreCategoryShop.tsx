'use client';

import { useState, useMemo } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from '../bookstore.module.css';
import ProductCarousel, { type CarouselProduct } from './ProductCarousel';

type MiniProduct = {
  id: number;
  name: string;
  price: string | number;
  imageUrl?: string | null;
  categoryId?: number | null;
  stockQuantity?: number | null;
  variantId?: number | null;
};

type Category = { id: number; name: string };

type Props = {
  categories: Category[];
  products: MiniProduct[];
};

export default function BookstoreCategoryShop({ categories, products }: Props) {
  const { t } = useLocale();
  const tabs = useMemo(() => categories.slice(0, 4), [categories]);
  const [activeId, setActiveId] = useState<number | 'all'>(tabs[0]?.id ?? 'all');

  const filtered = useMemo(() => {
    const withImage = products.filter((p) => p.imageUrl);
    if (activeId === 'all') return withImage.slice(0, 12);
    const byCat = withImage.filter((p) => p.categoryId === activeId);
    return (byCat.length ? byCat : withImage).slice(0, 12);
  }, [products, activeId]);

  const carouselProducts: CarouselProduct[] = useMemo(
    () =>
      filtered.map((p) => {
        const price = Number(p.price);
        const catName =
          categories.find((c) => c.id === p.categoryId)?.name ?? t('home.category.fallback');
        return {
          id: p.id,
          name: p.name,
          price,
          imageUrl: p.imageUrl ?? '',
          stockQuantity: p.stockQuantity ?? 0,
          variantId: p.variantId ?? null,
          description: '',
          categoryName: catName,
          categoryId: p.categoryId ?? null,
        };
      }),
    [filtered, categories, t],
  );

  return (
    <section className={styles.categoryShop}>
      <div className={styles.container}>
        <p className={styles.sectionEyebrow}>{t('home.eyebrow')}</p>
        <h2 className={styles.sectionTitle}>{t('home.category.title')}</h2>

        <div className={styles.categoryPills}>
          {tabs.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles.categoryPill}
              data-active={activeId === c.id}
              onClick={() => setActiveId(c.id)}
            >
              {c.name.toUpperCase()}
            </button>
          ))}
        </div>

        <ProductCarousel products={carouselProducts} />
      </div>
    </section>
  );
}

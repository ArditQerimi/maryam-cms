import type { Metadata } from 'next';
import React from 'react';

import styles from './bookstore.module.css';
import BookstoreAbout from './components/BookstoreAbout';
import BookstoreProducts from './components/BookstoreProducts';
import BookstoreStats from './components/BookstoreStats';
import BookstoreDeal from './components/BookstoreDeal';
import BookstoreCategoryShop from './components/BookstoreCategoryShop';
import BookstoreStory from './components/BookstoreStory';
import BookstoreMind from './components/BookstoreMind';
import BookstoreBlog from './components/BookstoreBlog';
import WidgetArea from './components/WidgetArea';
import FirstScreenFit from './components/FirstScreenFit';
import { getCategories, getProducts } from '@/lib/actions';
import { getContextCompany } from '@/lib/tenant';
import { getStorefrontHomepageBlocks } from '@/lib/theme/storefront-homepage';
import BlockRenderer, { type RendererProduct } from '@/app/cms/builder/BlockRenderer';
import { selectSourceProducts } from '@/app/cms/builder/product-sources';
import type { Block } from '@/app/cms/builder/blocks';
import { parseImageUrl } from '@/lib/image-url';
import { getT } from '@/lib/i18n/server';
import {
  EMPTY_SECTION_DATA,
  loadSectionProductData,
  sectionSalePrice,
} from '@/lib/storefront/section-data';
import {
  getSingleActiveCatalogVariant,
  getStorefrontCatalogStock,
} from './catalog-variants';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const storeName = (await getContextCompany().catch(() => null))?.name?.trim() || 'Store';
  const t = await getT();
  return {
    title: t('home.meta.title', { store: storeName }),
    description: t('home.meta.description'),
  };
}

export default async function ShopHomePage() {
  const [categories, products, homepageBlocks, sectionData] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ limit: 500 }).catch(() => []),
    getStorefrontHomepageBlocks(),
    // Sales totals + active discounts power the automatic product sources
    // (🔥 best sellers, 🏷️ discounted) — same data the builder preview gets.
    loadSectionProductData().catch(() => EMPTY_SECTION_DATA),
  ]);

  /**
   * The catalogue plus the automatic-source fields every section needs:
   * units sold (🔥 best sellers) and the effective sale price (🏷️ discounted).
   */
  const sectionProducts = products.map((product) => ({
    ...product,
    soldCount: sectionData.soldCounts.get(product.id) ?? 0,
    salePrice: sectionSalePrice(
      product.price,
      product.id,
      product.categoryId ?? null,
      sectionData,
    ),
    rating: sectionData.ratings.get(product.id) ?? 0,
  }));
  const sectionById = new Map(sectionProducts.map((product) => [product.id, product]));
  /** Only products that actually carry a sale price. */
  const salePriceById = new Map(
    sectionProducts
      .filter((product) => product.salePrice !== null)
      .map((product) => [product.id, product.salePrice as number]),
  );
  /** Admin store rating per product — the cards render these as stars. */
  const ratingById = new Map(sectionProducts.map((product) => [product.id, product.rating]));

  const activeProductsWithImage = products
    .filter((product) => product.status === 'Active' && parseImageUrl(product.imageUrl));

  // BookstoreCategoryShop is a Client Component — pass only serialisable fields.
  const miniProducts = products
    .filter((product) => product.status === 'Active')
    .map((product) => {
      const selectedVariant = getSingleActiveCatalogVariant(product.variants);
      return {
        id: product.id,
        name: product.name,
        price: String(selectedVariant?.price ?? product.price),
        imageUrl: parseImageUrl(product.imageUrl) || null,
        categoryId: product.categoryId ?? null,
        stockQuantity: getStorefrontCatalogStock(product.stockQuantity, product.variants),
        variantId: selectedVariant?.id ?? null,
      };
    });
  const miniCategories = categories
    .filter((category) =>
      category.status === 'Active'
      && category.name.trim()
      && miniProducts.some((product) => product.categoryId === category.id))
    .map((category) => ({ id: category.id, name: category.name.trim() }));

  const blockProducts: RendererProduct[] = miniProducts.map((product) => {
    const rich = sectionById.get(product.id);
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.imageUrl,
      href: `/home/products/${product.id}`,
      stock: product.stockQuantity,
      categoryId: product.categoryId ?? null,
      // Lets product blocks resolve the automatic sources like the sections.
      createdAt: rich?.createdAt ? new Date(rich.createdAt).getTime() : null,
      soldCount: rich?.soldCount ?? 0,
      salePrice: rich?.salePrice !== null && rich?.salePrice !== undefined
        ? String(rich.salePrice)
        : null,
      rating: rich?.rating ?? 0,
    };
  });

  const firstWithImage = activeProductsWithImage[0];

  /**
   * Narrow the catalogue to whatever a section block selected. The shared
   * resolver implements the storefront spec — ⭐ featured (hand-picked),
   * 🔥 best sellers (by sales), 🆕 new arrivals, 🏷️ discounted and a single
   * 📦 category — so the builder preview and `/home` always agree. The
   * section components apply their own limit/offset window, so none is
   * passed here.
   */
  function selectProducts(props: Record<string, unknown>) {
    return selectSourceProducts(sectionProducts, {
      source: props.source,
      // store_* blocks pick with `productIds`, Product Grid with `manualIds`.
      ids: props.productIds ?? props.manualIds,
      categoryId: props.categoryId,
    });
  }

  // Storefront sections are server components fed by the live catalogue, so
  // `/home` renders them and hands the result to the shared BlockRenderer,
  // which walks the row → column → module tree for us.
  function renderStoreBlock(block: Block): React.ReactNode {
    const props = block.props as Record<string, unknown>;

    switch (block.type) {
      case 'store_products':
        return (
          <BookstoreProducts
            products={selectProducts(props)}
            salePriceById={salePriceById}
            ratingById={ratingById}
            eyebrow={String(props.eyebrow ?? '') || undefined}
            title={String(props.title ?? '')}
            limit={Number(props.limit) || 12}
            offset={Number(props.offset) || 0}
          />
        );
      case 'product_grid':
        // Same live card as the storefront sections — action bar + add to
        // cart included (the canvas preview stays static: no cart there).
        return (
          <BookstoreProducts
            products={selectProducts(props)}
            salePriceById={salePriceById}
            ratingById={ratingById}
            eyebrow=""
            title={props.showTitle !== false && props.title ? String(props.title) : ''}
            layout={props.layout === 'grid' ? 'grid' : 'carousel'}
            limit={Number(props.limit) || 8}
          />
        );
      case 'store_categories':
        return <BookstoreCategoryShop categories={miniCategories} products={miniProducts} />;
      case 'store_stats':
        return <BookstoreStats products={products} categories={categories} />;
      case 'store_about':
        return (
          <BookstoreAbout
            productImage={firstWithImage ? parseImageUrl(firstWithImage.imageUrl) : undefined}
            productName={firstWithImage?.name}
          />
        );
      case 'store_deal':
        return <BookstoreDeal products={selectProducts(props)} />;
      case 'store_story':
        return <BookstoreStory products={selectProducts(props)} />;
      case 'store_mind':
        return <BookstoreMind categories={categories} products={products} />;
      case 'store_blog':
        return <BookstoreBlog />;
      case 'store_widgets':
        return (
          <div className="site-container">
            <WidgetArea area="homepage" />
          </div>
        );
      default:
        return null;
    }
  }

  // The front page is whatever the builder says it is — an unbuilt `home`
  // document renders nothing rather than falling back to a fixed layout.
  return (
    <div id="home-first-screen" className={`${styles.page} ${styles.firstScreen}`}>
      <FirstScreenFit targetId="home-first-screen" />
      {homepageBlocks.map((row) => (
        <BlockRenderer
          key={row.id}
          block={row}
          mode="live"
          products={blockProducts}
          categories={miniCategories}
          renderStoreBlock={renderStoreBlock}
        />
      ))}
    </div>
  );
}

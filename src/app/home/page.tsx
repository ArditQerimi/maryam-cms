import type { Metadata } from 'next';
import React from 'react';

import styles from './bookstore.module.css';
import BookstoreHero from './components/BookstoreHero';
import BookstoreAbout from './components/BookstoreAbout';
import BookstoreProducts from './components/BookstoreProducts';
import BookstoreStats from './components/BookstoreStats';
import BookstoreDeal from './components/BookstoreDeal';
import BookstoreCategoryShop from './components/BookstoreCategoryShop';
import BookstoreStory from './components/BookstoreStory';
import BookstoreMind from './components/BookstoreMind';
import BookstoreBlog from './components/BookstoreBlog';
import WidgetArea from './components/WidgetArea';
import { getCategories, getProducts } from '@/lib/actions';
import { getContextCompany } from '@/lib/tenant';
import { getCompanyCustomizations } from '@/lib/theme/apply-theme';
import { getStorefrontHomepageBlocks } from '@/lib/theme/storefront-homepage';
import BlockRenderer, { type RendererProduct } from '@/app/cms/builder/BlockRenderer';
import { parseImageUrl } from '@/lib/image-url';
import {
  getSingleActiveCatalogVariant,
  getStorefrontCatalogStock,
} from './catalog-variants';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const storeName = (await getContextCompany().catch(() => null))?.name?.trim() || 'Store';
  return {
    title: `${storeName} — Libra`,
    description: 'Shfleto katalogun aktual të librave dhe hap detajet reale të çdo produkt.',
  };
}

export default async function ShopHomePage() {
  const [categories, products, customizations, homepageBlocks] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ limit: 500 }).catch(() => []),
    getContextCompany()
      .then((company) => getCompanyCustomizations(company.id))
      .catch(() => null),
    getStorefrontHomepageBlocks(),
  ]);

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
  // The carousel is authored entirely in the CMS customizer
  // (Appearance → Customize → Homepage). No slides means no hero.
  const heroSlides = (customizations?.homepage.heroSlides ?? [])
    .filter((slide) => slide.image.trim() && slide.title.trim())
    .map((slide) => ({
      category: slide.category.trim(),
      title: slide.title.trim(),
      price: slide.price.trim(),
      img: slide.image.trim(),
      href: slide.url.trim() || '/shop/products',
      ctaLabel: slide.ctaLabel.trim(),
    }));

  // Settings → Reading → "A static page" hands the front page to the block
  // builder; without it the built-in section layout below stays in charge.
  if (homepageBlocks.length > 0) {
    const blockProducts: RendererProduct[] = miniProducts.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.imageUrl,
      href: `/shop/products/${product.id}`,
      stock: product.stockQuantity,
    }));

    const firstWithImage = activeProductsWithImage[0];

    // Storefront sections are server components fed by the live catalogue, so
    // they are rendered here rather than inside the shared BlockRenderer.
    const renderBlock = (block: (typeof homepageBlocks)[number]) => {
      switch (block.type) {
        case 'store_products':
          return (
            <BookstoreProducts
              products={products}
              eyebrow={String(block.props.eyebrow ?? '') || undefined}
              title={String(block.props.title ?? '')}
              limit={Number(block.props.limit) || 12}
              offset={Number(block.props.offset) || 0}
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
          return <BookstoreDeal products={products} />;
        case 'store_story':
          return <BookstoreStory products={products} />;
        case 'store_mind':
          return <BookstoreMind categories={categories} products={products} />;
        case 'store_blog':
          return <BookstoreBlog />;
        default:
          return (
            <BlockRenderer
              block={block}
              mode="live"
              products={blockProducts}
              categories={miniCategories}
            />
          );
      }
    };

    return (
      <div className={styles.page}>
        {homepageBlocks.map((block) => (
          <React.Fragment key={block.id}>{renderBlock(block)}</React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <BookstoreHero
        slides={heroSlides}
        secondaryLabel={customizations?.homepage.heroSecondaryLabel.trim() || undefined}
        secondaryUrl={customizations?.homepage.heroSecondaryUrl.trim() || undefined}
        design={
          customizations
            ? {
              layout: customizations.homepage.heroLayout,
              height: customizations.homepage.heroHeight,
              textAlign: customizations.homepage.heroTextAlign,
              background: customizations.homepage.heroBackground,
              textColor: customizations.homepage.heroTextColor,
              overlayColor: customizations.homepage.heroOverlayColor,
              overlayOpacity: customizations.homepage.heroOverlayOpacity,
              autoplay: customizations.homepage.heroAutoplay,
              intervalSeconds: customizations.homepage.heroIntervalSeconds,
            }
            : undefined
        }
      />
      <BookstoreAbout
        productImage={activeProductsWithImage[0] ? parseImageUrl(activeProductsWithImage[0].imageUrl) : undefined}
        productName={activeProductsWithImage[0]?.name}
      />
      <BookstoreProducts products={products} eyebrow="Your Shopping Expo" title="PRODUKTET E REJA" limit={12} offset={0} />
      <BookstoreStats products={products} categories={categories} />
      <BookstoreProducts products={products} eyebrow="Your Shopping Expo" title="PRODUKTET E ZGJEDHURA" limit={12} offset={12} />
      <BookstoreDeal products={products} />
      <BookstoreCategoryShop categories={miniCategories} products={miniProducts} />
      <BookstoreStory products={products} />
      <BookstoreMind categories={categories} products={products} />
      <BookstoreBlog />
      {/* CMS widgets configured for the `homepage` area (/cms/appearance/widgets). */}
      <div className="site-container">
        <WidgetArea area="homepage" />
      </div>
    </div>
  );
}

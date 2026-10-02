import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { categories, cmsPages, products } from '@/db/schema-tenant';
import { parseImageUrl } from '@/lib/image-url';
import BlockRenderer, { type RendererProduct } from '@/app/cms/builder/BlockRenderer';
import { normalizeBlocks } from '@/app/cms/builder/blocks';
import { getT } from '@/lib/i18n/server';
import styles from '../../legal/legal.module.css';

export const dynamic = 'force-dynamic';

type PageParams = { params: Promise<{ slug: string }> };

async function getCmsPage(slug: string) {
  const db = await getContextDb();
  const [page] = await db
    .select()
    .from(cmsPages)
    .where(and(eq(cmsPages.slug, slug), eq(cmsPages.status, 'Active')))
    .limit(1);
  return page ?? null;
}

async function getBlockProducts(): Promise<RendererProduct[]> {
  try {
    const db = await getContextDb();
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        price: products.price,
        imageUrl: products.imageUrl,
        stockQuantity: products.stockQuantity,
        categoryId: products.categoryId,
      })
      .from(products)
      .where(eq(products.status, 'Active'))
      .limit(500);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price ?? '0',
      image: parseImageUrl(row.imageUrl),
      href: `/home/products/${row.id}`,
      stock: row.stockQuantity ?? 0,
      categoryId: row.categoryId ?? null,
    }));
  } catch {
    return [];
  }
}

async function getBlockCategories(): Promise<Array<{ id: number; name: string }>> {
  try {
    const db = await getContextDb();
    const rows = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .limit(24);
    return rows;
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCmsPage(decodeURIComponent(slug));
  if (!page) return { title: 'Page not found' };

  const title = page.metaTitle?.trim() || page.title;
  const description = page.metaDescription?.trim() || page.excerpt?.trim() || undefined;

  return {
    title,
    description,
    alternates: { canonical: `/home/pages/${page.slug}` },
    openGraph: { title, description, url: `/home/pages/${page.slug}`, type: 'website' },
  };
}

export default async function CmsStorefrontPage({ params }: PageParams) {
  const { slug } = await params;
  // The `home` document is the front page itself — it only lives at `/home`.
  if (decodeURIComponent(slug) === 'home') redirect('/home');

  const page = await getCmsPage(decodeURIComponent(slug));
  if (!page) notFound();

  const t = await getT();
  const blocks = normalizeBlocks(page.blocks ?? []);
  const hasBuilderContent = blocks.length > 0;
  const [blockProducts, blockCategories] = hasBuilderContent
    ? await Promise.all([getBlockProducts(), getBlockCategories()])
    : [[], []];

  const featuredImage = parseImageUrl(page.featuredImage);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol className={styles.breadcrumbList}>
            <li>
              <Link className={styles.breadcrumbLink} href="/home">
                {t('pages.common.home')}
              </Link>
            </li>
            <li aria-current="page">{page.title}</li>
          </ol>
        </nav>

        <header className={styles.hero}>
          <p className={styles.eyebrow}>
            {page.pageType === 'legal' ? t('pages.cms.policyEyebrow') : t('pages.cms.pageEyebrow')}
          </p>
          <h1 className={styles.heroTitle}>{page.title}</h1>
          {page.excerpt ? <p className={styles.lede}>{page.excerpt}</p> : null}
          {featuredImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={featuredImage}
              alt=""
              style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 12, marginTop: 20 }}
            />
          ) : null}
        </header>

        <article className={styles.content}>
          {hasBuilderContent ? (
            <div>
              {blocks.map((block, index) => (
                <BlockRenderer
                  key={block.id || `block-${index}`}
                  block={block}
                  mode="live"
                  products={blockProducts as RendererProduct[]}
                  categories={blockCategories}
                />
              ))}
            </div>
          ) : page.content?.trim() ? (
            <div className={styles.prose} dangerouslySetInnerHTML={{ __html: page.content }} />
          ) : (
            <p>{t('pages.cms.empty')}</p>
          )}
        </article>
      </div>
    </div>
  );
}

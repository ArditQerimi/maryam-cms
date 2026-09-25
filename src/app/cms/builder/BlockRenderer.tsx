import Image from 'next/image';
import BookstoreHero from '@/app/shop/components/BookstoreHero';
import bookstore from '@/app/shop/bookstore.module.css';
import { BLOCK_DEFS, type Block, type BlockType } from './blocks';

export type RendererProduct = {
  id: number;
  name: string;
  price: string;
  image?: string | null;
  href: string;
  badge?: string | null;
  stock?: number | null;
};

export type BlockRendererProps = {
  block: Block;
  /** `edit` is the builder canvas, `live` is what shoppers see. */
  mode?: 'edit' | 'live';
  products?: RendererProduct[];
  categories?: Array<{ id: number; name: string }>;
};

const GAP: Record<string, string> = { small: '12px', medium: '24px', large: '40px' };
const SPACER: Record<string, number> = { small: 20, medium: 40, large: 80 };
const PADDING: Record<string, string> = { small: '32px 0', medium: '56px 0', large: '80px 0' };
const WIDTH: Record<string, string> = {
  full: '100%',
  twoThirds: '66.666%',
  half: '50%',
  third: '33.333%',
  quarter: '25%',
};

function widthStyle(width?: string, align?: string) {
  const basis = WIDTH[width || 'full'] || '100%';
  const style: React.CSSProperties = { width: basis, maxWidth: '100%' };
  if (basis !== '100%') {
    if (align === 'center') {
      style.marginLeft = 'auto';
      style.marginRight = 'auto';
    } else if (align === 'right') {
      style.marginLeft = 'auto';
    }
  }
  return style;
}

function textAsHtml(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Rich text from the editor is already HTML; plain text gets escaped.
  return value;
}

function plainOrHtml(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value;
}

function imagesOf(value: unknown): Array<{ url: string; alt?: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) =>
      typeof entry === 'string'
        ? { url: entry }
        : entry && typeof entry === 'object'
          ? { url: String((entry as any).url || ''), alt: (entry as any).alt }
          : null,
    )
    .filter((entry): entry is { url: string; alt?: string } => Boolean(entry && entry.url));
}

function Img({
  src,
  alt,
  fill = false,
  className,
  style,
  sizes,
}: {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
  sizes?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-100 text-xs text-zinc-400 ${className || ''}`}
        style={style}
      >
        No image selected
      </div>
    );
  }
  const isExternal = /^https?:\/\//i.test(src) && !src.startsWith(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003');
  if (isExternal) {
    // next/image only allows configured remote hosts; fall back to <img>.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} style={style} sizes={sizes} />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      style={style}
      sizes={sizes || '(max-width: 768px) 100vw, 50vw'}
    />
  );
}

function Section({
  block,
  children,
  style,
}: {
  block: Block;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const padding = block.props.padding;
  return (
    <section style={{ padding: padding ? PADDING[padding] || PADDING.large : 0, ...style }}>
      {children}
    </section>
  );
}

function Container({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1290, margin: '0 auto', padding: '0 24px' }}>{children}</div>;
}

function ButtonLink({
  text,
  url,
  variant,
  newTab,
}: {
  text: string;
  url: string;
  variant?: string;
  newTab?: boolean;
}) {
  if (!text) return null;
  const base =
    'inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition';
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--cms-primary, #6d6be8)', color: '#fff' },
    secondary: {
      background: 'var(--cms-secondary, #1a1a1a)',
      color: '#fff',
    },
    outline: {
      background: 'transparent',
      color: 'var(--cms-text, #18181b)',
      boxShadow: 'inset 0 0 0 1.5px currentColor',
    },
  };
  return (
    <a
      href={url || '#'}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noreferrer noopener' : undefined}
      className={base}
      style={styles[variant || 'primary'] || styles.primary}
    >
      {text}
    </a>
  );
}

function ProductGrid({ block, products }: { block: Block; products?: RendererProduct[] }) {
  const columns = String(block.props.columns || '4');
  const list = (products || []).slice(0, Number(block.props.limit) || 8);

  if (!list.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-500">
        No products matched this selection yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 24,
      }}
    >
      {list.map((product) => (
        <a key={product.id} href={product.href} className="group block">
          <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-zinc-100">
            {product.image ? (
              <Img src={product.image} alt={product.name} fill className="object-cover transition group-hover:scale-105" />
            ) : (
              <span className="flex h-full items-center justify-center text-xs text-zinc-400">
                No image
              </span>
            )}
            {product.badge ? (
              <span className="absolute left-2 top-2 rounded-full bg-[var(--cms-primary,#6d6be8)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {product.badge}
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm font-medium text-[var(--cms-text,#18181b)] group-hover:underline">
            {product.name}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--cms-primary,#6d6be8)]">
            {product.price}
          </p>
        </a>
      ))}
    </div>
  );
}

export default function BlockRenderer({
  block,
  mode = 'live',
  products,
  categories: _categories,
}: BlockRendererProps) {
  const p = block.props || {};
  const interactive = mode === 'live';

  const renderColumns = () => {
    const count = block.type === 'columns_2' ? 2 : block.type === 'columns_3' ? 3 : 4;
    const gap = GAP[p.gap] || GAP.medium;
    const children = block.children || [];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, minmax(0,1fr))`, gap }}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="min-w-0">
            {children[index] ? (
              <BlockRenderer block={children[index]} mode={mode} products={products} />
            ) : mode === 'edit' ? (
              <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-400">
                Empty column
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  switch (block.type as BlockType) {
    case 'columns_2':
    case 'columns_3':
    case 'columns_4':
      return <Section block={block} style={p.padding ? undefined : { padding: '8px 0' }}>{renderColumns()}</Section>;

    case 'spacer': {
      const size = p.size === 'custom' ? Number(p.height) || 40 : SPACER[p.size] || 40;
      return <div style={{ height: size }} aria-hidden />;
    }

    case 'heading': {
      const Tag = (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(p.level) ? p.level : 'h2') as any;
      const sizes: Record<string, string> = {
        h1: 'clamp(2rem, 4vw, 3rem)',
        h2: 'clamp(1.6rem, 3vw, 2.35rem)',
        h3: 'clamp(1.3rem, 2.4vw, 1.8rem)',
        h4: 'clamp(1.1rem, 2vw, 1.4rem)',
        h5: '1.15rem',
        h6: '1rem',
      };
      return (
        <div style={widthStyle(p.width, p.align)}>
          <Tag
            style={{
              textAlign: p.align || 'left',
              color: p.color || 'var(--cms-text, #18181b)',
              fontSize: sizes[p.level] || sizes.h2,
              lineHeight: 1.15,
              fontWeight: 700,
              margin: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {plainOrHtml(p.text)}
          </Tag>
        </div>
      );
    }

    case 'paragraph': {
      const sizes: Record<string, string> = { small: '0.875rem', medium: '1rem', large: '1.175rem' };
      return (
        <div style={widthStyle(p.width, p.align)}>
          <div
            className="rich-text"
            style={{
              textAlign: p.align || 'left',
              fontSize: sizes[p.size] || sizes.medium,
              lineHeight: 1.75,
              color: p.color || 'var(--cms-muted, #52525b)',
            }}
            dangerouslySetInnerHTML={{ __html: textAsHtml(p.text) }}
          />
        </div>
      );
    }

    case 'button':
      return (
        <div style={{ ...widthStyle(p.width, p.align), textAlign: p.align || 'left' }}>
          {interactive ? (
            <ButtonLink text={p.text} url={p.url} variant={p.variant} newTab={p.openNewTab} />
          ) : (
            <span
              className="inline-flex items-center rounded-lg px-6 py-3 text-sm font-semibold"
              style={{
                background: p.variant === 'outline' ? 'transparent' : 'var(--cms-primary, #6d6be8)',
                color: p.variant === 'outline' ? 'var(--cms-text, #18181b)' : '#fff',
                boxShadow: p.variant === 'outline' ? 'inset 0 0 0 1.5px currentColor' : undefined,
              }}
            >
              {p.text || 'Button'}
            </span>
          )}
        </div>
      );

    case 'html':
      return (
        <div
          className="cms-embed"
          dangerouslySetInnerHTML={{ __html: mode === 'edit' ? '' : String(p.code || '') }}
        >
          {mode === 'edit' ? (
            <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-emerald-300">
              {String(p.code || '').slice(0, 400)}
            </pre>
          ) : null}
        </div>
      );

    case 'image': {
      const radius = p.rounded === 'full' ? '50%' : p.rounded === 'medium' ? '12px' : '0';
      const image = (
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 10', borderRadius: radius }}>
          <Img src={String(p.src || '')} alt={String(p.alt || '')} fill className="object-cover" />
        </div>
      );
      const caption = p.caption ? (
        <figcaption className="mt-2 text-center text-xs text-zinc-500">{p.caption}</figcaption>
      ) : null;
      return (
        <figure style={widthStyle(p.width, p.align)}>
          {interactive && p.link ? <a href={p.link}>{image}</a> : image}
          {caption}
        </figure>
      );
    }

    case 'gallery': {
      const images = imagesOf(p.images);
      const radius = p.rounded === 'medium' ? '10px' : '0';
      if (!images.length) {
        return (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-500">
            No images in this gallery yet.
          </div>
        );
      }
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${String(p.columns || '3')}, minmax(0,1fr))`,
            gap: GAP[p.gap] || GAP.medium,
          }}
        >
          {images.map((image, index) => (
            <div
              key={`${image.url}-${index}`}
              className="relative overflow-hidden"
              style={{ aspectRatio: '4 / 3', borderRadius: radius }}
            >
              <Img src={image.url} alt={image.alt || ''} fill className="object-cover" />
            </div>
          ))}
        </div>
      );
    }

    case 'product_grid':
      return (
        <Section block={block}>
          <Container>
            {p.showTitle !== false && p.title ? (
              <h2
                className="mb-6"
                style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--cms-text, #18181b)', margin: '0 0 24px' }}
              >
                {p.title}
              </h2>
            ) : null}
            <ProductGrid block={block} products={products} />
          </Container>
        </Section>
      );

    /* Storefront sections need live catalogue data and server-only components,
       so `/shop` renders them itself; here we only show what will appear. */
    case 'store_products':
    case 'store_categories':
    case 'store_stats':
    case 'store_about':
    case 'store_deal':
    case 'store_story':
    case 'store_mind':
    case 'store_blog': {
      const def = BLOCK_DEFS[block.type];
      return (
        <Section block={block}>
          <Container>
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-emerald-800">{def.label}</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-emerald-700/70">
                {def.description} Rendered with live data on the storefront.
              </p>
            </div>
          </Container>
        </Section>
      );
    }

    case 'hero_carousel': {
      const slides = (Array.isArray(p.slides) ? p.slides : [])
        .map((entry: Record<string, unknown>) => ({
          category: String(entry?.category ?? '').trim(),
          title: String(entry?.title ?? '').trim(),
          price: String(entry?.price ?? '').trim(),
          img: String(entry?.image ?? '').trim(),
          href: String(entry?.url ?? '').trim() || '/shop/products',
          ctaLabel: String(entry?.ctaLabel ?? '').trim(),
        }))
        .filter((slide) => slide.title && slide.img);

      if (slides.length === 0) {
        return (
          <Section block={block}>
            <Container>
              <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-400">
                Add a slide with an image and a title to show this hero.
              </p>
            </Container>
          </Section>
        );
      }

      return (
        <div className={bookstore.page}>
          <BookstoreHero
            slides={slides}
            secondaryLabel={String(p.secondaryLabel ?? '').trim() || undefined}
            secondaryUrl={String(p.secondaryUrl ?? '').trim() || undefined}
            design={{
              layout: p.layout,
              height: p.height,
              textAlign: p.textAlign,
              background: String(p.background ?? ''),
              textColor: String(p.textColor ?? ''),
              overlayColor: String(p.overlayColor ?? '') || '#000000',
              overlayOpacity: Number(p.overlayOpacity) || 0,
              autoplay: p.autoplay !== false,
              intervalSeconds: Number(p.intervalSeconds) || 5,
            }}
          />
        </div>
      );
    }

    case 'hero': {
      const heights: Record<string, string> = { small: '320px', medium: '440px', large: '560px' };
      const light = p.textColor !== 'dark';
      return (
        <Section block={block} style={{ padding: 0 }}>
          <div
            className="relative flex items-center overflow-hidden"
            style={{ minHeight: heights[p.height] || heights.medium, background: '#18181b' }}
          >
            {p.image ? (
              <Img src={String(p.image)} alt="" fill className="object-cover" sizes="100vw" />
            ) : null}
            <div
              className="absolute inset-0"
              style={{
                background: `rgba(15,15,18,${(Number(p.overlay) || 0) / 100})`,
              }}
            />
            <Container>
              <div
                className="relative py-16"
                style={{ textAlign: p.align || 'center', color: light ? '#fff' : '#18181b' }}
              >
                <h1
                  style={{
                    fontSize: 'clamp(2rem, 4.5vw, 3.4rem)',
                    lineHeight: 1.1,
                    fontWeight: 800,
                    margin: 0,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {p.title}
                </h1>
                {p.subtitle ? (
                  <p
                    style={{
                      marginTop: 16,
                      fontSize: 'clamp(1rem, 1.6vw, 1.2rem)',
                      lineHeight: 1.6,
                      opacity: 0.85,
                      maxWidth: 720,
                      marginLeft: p.align === 'center' ? 'auto' : undefined,
                      marginRight: p.align === 'center' ? 'auto' : undefined,
                    }}
                  >
                    {p.subtitle}
                  </p>
                ) : null}
                {p.ctaText ? (
                  <div
                    style={{
                      marginTop: 28,
                      display: 'flex',
                      gap: 12,
                      justifyContent:
                        p.align === 'center' ? 'center' : p.align === 'right' ? 'flex-end' : 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    <ButtonLink text={p.ctaText} url={p.ctaUrl} variant="primary" />
                    {p.ctaText2 ? <ButtonLink text={p.ctaText2} url={p.ctaUrl2} variant="outline" /> : null}
                  </div>
                ) : null}
              </div>
            </Container>
          </div>
        </Section>
      );
    }

    case 'cta':
      return (
        <Section block={block}>
          <Container>
            <div
              style={{
                background: p.background || 'var(--cms-primary, #6d6be8)',
                color: p.textColor === 'dark' ? '#18181b' : '#fff',
                borderRadius: 16,
                padding: '48px 32px',
                textAlign: p.align || 'center',
              }}
            >
              <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2.1rem)', fontWeight: 700, margin: 0 }}>
                {p.title}
              </h2>
              {p.description ? (
                <p style={{ marginTop: 12, opacity: 0.85, lineHeight: 1.7, maxWidth: 680, marginLeft: p.align === 'center' ? 'auto' : undefined, marginRight: p.align === 'center' ? 'auto' : undefined }}>
                  {p.description}
                </p>
              ) : null}
              {p.button ? (
                <div style={{ marginTop: 24 }}>
                  <ButtonLink text={p.button} url={p.url} variant={p.textColor === 'dark' ? 'secondary' : 'outline'} />
                </div>
              ) : null}
            </div>
          </Container>
        </Section>
      );

    case 'faq': {
      const items = Array.isArray(p.items) ? p.items : [];
      return (
        <Section block={block}>
          <Container>
            <div style={{ maxWidth: 820, margin: '0 auto' }}>
              {p.title ? (
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, textAlign: 'center', margin: '0 0 28px', color: 'var(--cms-text, #18181b)' }}>
                  {p.title}
                </h2>
              ) : null}
              <div className="space-y-3">
                {items.map((item: any, index: number) => {
                  const key = `faq_${index}`;
                  const defaultOpen = p.openFirst !== false && index === 0;
                  return interactive ? (
                    <details
                      key={key}
                      open={defaultOpen}
                      className="group rounded-xl border border-zinc-200 bg-white px-5 py-4"
                    >
                      <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">
                        {item.q || 'Untitled question'}
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-600">{item.a}</p>
                    </details>
                  ) : (
                    <div key={key} className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
                      <p className="text-sm font-semibold text-zinc-900">{item.q || 'Untitled question'}</p>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-600">{item.a}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Container>
        </Section>
      );
    }

    case 'testimonial': {
      const items = Array.isArray(p.items) ? p.items : [];
      return (
        <Section block={block}>
          <Container>
            {p.title ? (
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, textAlign: 'center', margin: '0 0 28px', color: 'var(--cms-text, #18181b)' }}>
                {p.title}
              </h2>
            ) : null}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: p.layout === 'list' ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 24,
              }}
            >
              {items.map((item: any, index: number) => (
                <figure
                  key={`t_${index}`}
                  className="rounded-xl border border-zinc-200 bg-white p-6"
                  style={{ margin: 0 }}
                >
                  <blockquote className="text-sm leading-relaxed text-zinc-700">
                    “{item.text}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--cms-primary,#6d6be8)]/15 text-xs font-semibold text-[var(--cms-primary,#4f4dd6)]">
                      {item.avatar ? (
                        <Img src={String(item.avatar)} alt={item.name || ''} fill className="object-cover" />
                      ) : (
                        String(item.name || '?').slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900">{item.name}</span>
                      <span className="block text-xs text-zinc-500">{item.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Container>
        </Section>
      );
    }

    default:
      return (
        <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-400">
          Unknown block: {block.type}
        </div>
      );
  }
}

export function blockLabel(type: string) {
  return BLOCK_DEFS[type as BlockType]?.label || type;
}

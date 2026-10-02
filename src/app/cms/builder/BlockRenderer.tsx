import Image from 'next/image';
import BookstoreHero from '@/app/home/components/BookstoreHero';
import ProductStars from '@/app/home/components/ProductStars';
import bookstore from '@/app/home/bookstore.module.css';
import { Eye, Heart, Layers3 } from 'lucide-react';
import { BLOCK_DEFS, isLayoutType, type Block, type Breakpoint, type BlockType } from './blocks';
import { isDiscounted, selectSourceProducts } from './product-sources';
import { L, SourceCopy, T } from './Copy';

export type RendererProduct = {
  id: number;
  name: string;
  price: string;
  image?: string | null;
  href: string;
  badge?: string | null;
  stock?: number | null;
  /** Lets the "by category" source filter without extra lookups. */
  categoryId?: number | null;
  /** Powers 🆕 new-arrivals ordering (ISO string or epoch milliseconds). */
  createdAt?: string | number | null;
  /** Units sold — powers 🔥 best-sellers ordering. */
  soldCount?: number | null;
  /** Effective sale price when a discount applies, else null. */
  salePrice?: string | number | null;
  /** Admin store rating 1–5 (0/null = no stars shown). */
  rating?: number | null;
  /** Catalogue status — previews mirror the storefront's Active-only rule. */
  status?: string | null;
};

/** Same formatting the storefront cards use (en-IE / EUR). */
const storefrontPrice = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatEur(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? Number.NaN);
  return Number.isFinite(n) ? storefrontPrice.format(n) : '';
}

export type BlockRendererProps = {
  block: Block;
  /** `edit` is the builder canvas, `live` is what shoppers see. */
  mode?: 'edit' | 'live';
  products?: RendererProduct[];
  categories?: Array<{ id: number; name: string }>;
  /**
   * Storefront sections need live catalogue data, so `/home` renders them
   * server-side and hands them in here; without it they show a placeholder.
   */
  renderStoreBlock?: (block: Block) => React.ReactNode;
  /**
   * Builder canvas only: floating toolbar + selection ring rendered *inside*
   * every row/column/module so nesting stays legible and gutters line up.
   */
  editChrome?: (node: Block) => React.ReactNode;
  /** Builder canvas only: column resize gutters, rendered inside a row. */
  editGutter?: (row: Block) => React.ReactNode;
  /** Builder preview: which breakpoint's rules to apply instead of the viewport. */
  breakpoint?: Breakpoint;
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
        <L text="No image selected" />
      </div>
    );
  }
  const placeholder = (
    <div
      className={`flex items-center justify-center bg-zinc-100 text-xs text-zinc-400 ${className || ''}`}
      style={style}
    >
      <L text="No image selected" />
    </div>
  );
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
  const isHttp = /^https?:\/\//i.test(src);
  const sameOrigin = isHttp && src.startsWith(appOrigin);
  const isExternal = (isHttp && !sameOrigin) || src.startsWith('//');
  if (isExternal) {
    // next/image only allows configured remote hosts; fall back to <img>.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} style={style} sizes={sizes} />;
  }
  const nextImageSafe =
    sameOrigin ||
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    (src.startsWith('/') && !src.startsWith('//'));
  if (!nextImageSafe) {
    // Broken value (e.g. raw media-library JSON) — never let next/image throw
    // "Failed to construct 'URL': Invalid URL"; show the placeholder instead.
    return placeholder;
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

/**
 * Honour the block's "Products to show" source — hand-picked, category,
 * best sellers, new arrivals, discounted … The shared resolver in
 * `product-sources.ts` keeps this identical to what `/home` will render.
 */
function selectGridProducts(block: Block, products: RendererProduct[]): RendererProduct[] {
  const props = block.props;
  return selectSourceProducts(products, {
    source: props.source,
    ids: props.manualIds,
    categoryId: props.categoryId,
    limit: Number(props.limit) || 8,
  });
}

/**
 * Product Grid is a thin resolver: it honours the block's source/layout
 * settings and delegates the rendering to the shared `ProductsShowcase`
 * so its heading and cards match the storefront sections exactly.
 */
function ProductGrid({
  block,
  products,
  mode,
}: {
  block: Block;
  products?: RendererProduct[];
  mode?: 'edit' | 'live';
}) {
  const p = block.props;
  const list = selectGridProducts(block, products || []);
  // Canvas: the catalogue fetch may still be in flight — don't blame the
  // block's configuration before the data arrives.
  const loading = mode === 'edit' && !products?.length;

  return (
    <ProductsShowcase
      products={list}
      title={p.showTitle !== false && p.title ? String(p.title) : undefined}
      layout={p.layout === 'grid' ? 'grid' : 'carousel'}
      columns={Number(p.columns) || 4}
      emptyCopy={loading ? <T k="cmscontent.builder.loadingProducts" /> : <SourceCopy source={p.source} />}
    />
  );
}

/**
 * The ONE product-carousel component both commerce blocks share — Product
 * Showcase *and* Product Grid render here, so the serif section heading and
 * the cards (sale price with the struck-through original) are identical
 * everywhere: builder canvas and storefront alike. Presentational only —
 * callers resolve WHICH products to pass (see `product-sources.ts`);
 * deliberately static markup, because the builder has no cart/wishlist
 * contexts and the canvas swallows link navigation anyway.
 */
function ProductsShowcase({
  products,
  title,
  eyebrow,
  layout = 'carousel',
  columns = 4,
  emptyCopy,
}: {
  products: RendererProduct[];
  /** Section heading — the storefront's serif `sectionTitle`. */
  title?: string;
  /** Small line above the title (the showcase's "eyebrow"). */
  eyebrow?: string;
  layout?: 'carousel' | 'grid';
  columns?: number;
  /** Explains why the box is empty (source-aware copy or a loading note). */
  emptyCopy?: React.ReactNode;
}) {
  if (!products.length) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 px-6 py-10 text-center">
        <p className="mx-auto mt-1 max-w-sm text-xs text-emerald-700/70">{emptyCopy}</p>
      </div>
    );
  }

  const perView = Math.min(Math.max(columns, 1), 6);
  const cards = products.map((product) => (
    <article
      key={product.id}
      className={`${bookstore.productCard} ${layout === 'carousel' ? bookstore.carouselCard : ''}`}
      style={
        layout === 'carousel'
          ? { flex: `0 0 calc((100% - ${perView - 1} * 1.75rem) / ${perView})` }
          : undefined
      }
    >
      <a href={product.href} className={bookstore.productMedia} aria-label={`View ${product.name}`}>
        {product.image ? (
          <Img
            src={product.image}
            alt={product.name}
            fill
            sizes={`${Math.max(Math.round(100 / perView), 25)}vw`}
          />
        ) : null}
      </a>
      {/* Decorative quick actions: the canvas has no cart/wishlist/compare
          contexts, so they mirror design A without doing anything. */}
      <div className={bookstore.productQuick} aria-hidden="true" style={{ pointerEvents: 'none' }}>
        <button type="button" tabIndex={-1}>
          <Heart size={21} strokeWidth={1.7} aria-hidden="true" />
        </button>
        <button type="button" tabIndex={-1}>
          <Layers3 size={21} strokeWidth={1.7} aria-hidden="true" />
        </button>
        <button type="button" tabIndex={-1}>
          <Eye size={21} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
      <a href={product.href} className={bookstore.productTitleLink}>
        <h3 className={bookstore.productTitle}>{product.name}</h3>
      </a>
      <ProductStars rating={product.rating} />
      <div className={bookstore.productPriceRow}>
        <span className={bookstore.productPrice}>
          {formatEur(isDiscounted(product) ? product.salePrice : product.price)}
        </span>
        {isDiscounted(product) ? (
          <span className={bookstore.productPriceOld}>{formatEur(product.price)}</span>
        ) : null}
      </div>
      {/* Hover-revealed ADD TO CART (design C) — decorative stand-in. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className={bookstore.productAddBtn}
        style={{ pointerEvents: 'none', display: 'block' }}
      >
        Add to cart
      </button>
    </article>
  ));

  return (
    <div className={bookstore.page}>
      <section className={bookstore.productsSection}>
        <div className={bookstore.container}>
          {eyebrow ? <p className={bookstore.sectionEyebrow}>{eyebrow}</p> : null}
          {title ? <h2 className={bookstore.sectionTitle}>{title}</h2> : null}
          {layout === 'grid' ? (
            <div
              className={bookstore.productsGrid}
              style={{ gridTemplateColumns: `repeat(${perView}, minmax(0, 1fr))` }}
            >
              {cards}
            </div>
          ) : (
            <div className={bookstore.carouselContainer}>
              <div className={bookstore.carouselTrack}>{cards}</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Canvas preview of the "Product Showcase" storefront section: resolves the
 * block's product source exactly like `/home` does, then hands the list to
 * the shared `ProductsShowcase` component.
 */
function StoreProductsPreview({
  block,
  products,
}: {
  block: Block;
  products: RendererProduct[];
}) {
  const p = block.props;

  // Mirror the storefront filters: Active products with an image only.
  const active = products.filter(
    (product) => (!product.status || product.status === 'Active') && Boolean(product.image),
  );
  const list = selectSourceProducts(active, {
    source: p.source,
    ids: p.productIds,
    categoryId: p.categoryId,
    limit: Number(p.limit) || 12,
    offset: Number(p.offset) || 0,
  });

  return (
    <ProductsShowcase
      products={list}
      eyebrow={String(p.eyebrow ?? '').trim() || undefined}
      title={String(p.title ?? '').trim() || undefined}
      // The catalogue arrives from the API after hydration — a calm loading
      // note reads better than an empty-state that blames the config.
      emptyCopy={
        products.length ? <SourceCopy source={p.source} /> : <T k="cmscontent.builder.loadingProducts" />
      }
    />
  );
}

/* ------------------------------------------------------------ layout tree */

const SHADOWS: Record<string, string> = {
  none: 'none',
  sm: '0 1px 3px rgba(15,15,16,0.08)',
  md: '0 6px 16px rgba(15,15,16,0.10)',
  lg: '0 14px 34px rgba(15,15,16,0.12)',
  xl: '0 26px 60px rgba(15,15,16,0.16)',
};

type BoxValue = { top: number; right: number; bottom: number; left: number };

const EMPTY_BOX: BoxValue = { top: 0, right: 0, bottom: 0, left: 0 };

/** Accepts `{top,right,bottom,left}`, a px number, or a CSS shorthand string. */
function toBox(value: unknown): BoxValue {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { top: value, right: value, bottom: value, left: value };
  }
  if (typeof value === 'string' && value.trim()) {
    const parts = value
      .trim()
      .split(/\s+/)
      .map((part) => {
        const num = Number.parseFloat(part);
        return Number.isFinite(num) ? num : 0;
      });
    if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    if (parts.length >= 4) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const source = value as Record<string, unknown>;
    const out: BoxValue = { ...EMPTY_BOX };
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const num = Number(source[side]);
      if (Number.isFinite(num)) out[side] = num;
    }
    return out;
  }
  return { ...EMPTY_BOX };
}

function boxCss(value: unknown): React.CSSProperties {
  const box = toBox(value);
  return {
    paddingTop: box.top,
    paddingRight: box.right,
    paddingBottom: box.bottom,
    paddingLeft: box.left,
  };
}

function borderCss(width: unknown, style: unknown, color: unknown): React.CSSProperties {
  const px = Number(width) || 0;
  if (px <= 0) return {};
  const cssStyle = String(style || 'solid');
  if (cssStyle === 'none') return {};
  return { border: `${px}px ${cssStyle} ${String(color || 'transparent')}` };
}

const UNITLESS_CSS = new Set([
  'opacity',
  'zIndex',
  'fontWeight',
  'lineHeight',
  'order',
  'flex',
  'flexGrow',
  'flexShrink',
]);

function cssDeclarations(overrides: Record<string, unknown>): string {
  const out: string[] = [];
  for (const [key, raw] of Object.entries(overrides)) {
    if (raw === null || raw === undefined || raw === '') continue;
    if (key === 'padding' || key === 'margin') {
      const box = toBox(raw);
      out.push(`${key}:${box.top}px ${box.right}px ${box.bottom}px ${box.left}px`);
      continue;
    }
    if (key === 'visibility') continue;
    const property = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    const value =
      typeof raw === 'number' && !UNITLESS_CSS.has(key) ? `${raw}px` : String(raw).trim();
    if (value) out.push(`${property}:${value}`);
  }
  return out.join(';');
}

/**
 * Class name plus the `<style>` needed for breakpoint visibility and any
 * per-breakpoint prop overrides stored in `node.responsive`.
 *
 * On the storefront the rules are keyed to the viewport. Inside the builder a
 * `breakpoint` is passed instead, so the preview obeys the switcher in the top
 * bar rather than the size of the browser window.
 */
function responsiveAttrs(node: Block, breakpoint?: Breakpoint): { className: string; css: string } {
  const cls = `bb-${node.id}`;
  const visibility = node.props?.visibility;
  const classes = [cls];
  if (visibility && typeof visibility === 'object') {
    if (visibility.desktop === false) classes.push('bb-hide-desktop');
    if (visibility.tablet === false) classes.push('bb-hide-tablet');
    if (visibility.mobile === false) classes.push('bb-hide-mobile');
  }
  const rules: string[] = [];

  if (breakpoint) {
    // Builder preview: only the selected breakpoint is honoured.
    if (visibility && typeof visibility === 'object' && visibility[breakpoint] === false) {
      rules.push(`.bp-${breakpoint} .${cls}{display:none!important}`);
    }
    const overrides = node.responsive?.[breakpoint];
    if (overrides && typeof overrides === 'object' && Object.keys(overrides).length) {
      const declarations = cssDeclarations(overrides as Record<string, unknown>);
      if (declarations) rules.push(`.bp-${breakpoint} .${cls}{${declarations}}`);
    }
    return { className: classes.join(' '), css: rules.join('') };
  }

  if (classes.length > 1) {
    rules.push(
      `@media(min-width:1024px){.${cls}.bb-hide-desktop{display:none!important}}`,
      `@media(min-width:768px)and(max-width:1023px){.${cls}.bb-hide-tablet{display:none!important}}`,
      `@media(max-width:767px){.${cls}.bb-hide-mobile{display:none!important}}`,
    );
  }
  const media: Record<string, string> = {
    desktop: '@media(min-width:1024px)',
    tablet: '@media(min-width:768px)and(max-width:1023px)',
    mobile: '@media(max-width:767px)',
  };
  for (const breakpointKey of ['desktop', 'tablet', 'mobile'] as const) {
    const overrides = node.responsive?.[breakpointKey];
    if (overrides && typeof overrides === 'object' && Object.keys(overrides).length) {
      const declarations = cssDeclarations(overrides as Record<string, unknown>);
      if (declarations) rules.push(`${media[breakpointKey]}{.${cls}{${declarations}}}`);
    }
  }
  return { className: classes.join(' '), css: rules.join('') };
}

/** Percentage basis that leaves room for the row's gap so columns never wrap. */
function columnBasis(width: number, gap: number): string {
  const clamped = Math.min(100, Math.max(0, width));
  return `calc(${round2(clamped)}% - ${round2((gap * clamped) / 100)}px)`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export default function BlockRenderer({
  block,
  mode = 'live',
  products,
  categories,
  renderStoreBlock,
  editChrome,
  editGutter,
  breakpoint,
}: BlockRendererProps) {
  const p = block.props || {};
  const interactive = mode === 'live';
  const editing = mode === 'edit';

  const renderColumns = () => {
    const count = block.type === 'columns_2' ? 2 : block.type === 'columns_3' ? 3 : 4;
    const gap = GAP[p.gap] || GAP.medium;
    const children = block.children || [];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, minmax(0,1fr))`, gap }}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="min-w-0">
            {children[index] ? (
              <BlockRenderer
                block={children[index]}
                mode={mode}
                products={products}
                categories={categories}
                renderStoreBlock={renderStoreBlock}
                editChrome={editChrome}
                breakpoint={breakpoint}
              />
            ) : mode === 'edit' ? (
              <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-400">
                <L text="Empty column" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  switch (block.type) {
    /* ---------------------------------------------------------- layout tree */
    case 'row': {
      const children = block.children || [];
      const backgroundType = String(p.backgroundType || 'none');
      const gap = Number(p.gap) || 0;
      const valign = String(p.valign || 'stretch');
      const boxed = p.contentWidth === 'fixed';
      const { className, css } = responsiveAttrs(block, breakpoint);
      const minHeight =
        p.height === 'full'
          ? '100vh'
          : p.height === 'fixed'
            ? `${Number(p.heightPx) || 420}px`
            : undefined;
      const margin = toBox(p.margin);

      const style: React.CSSProperties = {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight,
        ...boxCss(p.padding),
        ...borderCss(p.borderWidth, p.borderStyle, p.borderColor),
        borderRadius: Number(p.radius) || 0,
        boxShadow: SHADOWS[String(p.shadow || 'none')] || 'none',
        marginTop: margin.top || undefined,
        marginRight: margin.right || undefined,
        marginBottom: margin.bottom || undefined,
        marginLeft: margin.left || undefined,
      };
      if (backgroundType === 'color') {
        style.backgroundColor = String(p.backgroundColor || 'transparent');
      } else if (backgroundType === 'image' && p.backgroundImage) {
        style.backgroundImage = `url(${JSON.stringify(String(p.backgroundImage))})`;
        style.backgroundSize = 'cover';
        style.backgroundPosition = 'center';
        style.backgroundRepeat = 'no-repeat';
      } else if (backgroundType === 'video') {
        style.backgroundColor = String(p.backgroundColor || '#000000');
      }

      /* Columns become full-width bands on phones (or on the previewed breakpoint). */
      const cls0 = String(className).split(' ')[0];
      const stackCss = breakpoint
        ? breakpoint === 'mobile'
          ? `.bp-mobile .${cls0} .bb-row-inner>.bb-col{flex-basis:100%!important}`
          : ''
        : `@media(max-width:767px){.${cls0} .bb-row-inner>.bb-col{flex-basis:100%!important}}`;

      return (
        <section
          id={p.cssId ? String(p.cssId) : undefined}
          data-node={editing ? block.id : undefined}
          className={[className, p.cssClass ? String(p.cssClass) : ''].filter(Boolean).join(' ') || undefined}
          style={style}
        >
          {editing && editChrome ? editChrome(block) : null}
          {css || stackCss ? <style>{css + stackCss}</style> : null}
          {backgroundType === 'video' && p.backgroundVideo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <video
              aria-hidden="true"
              autoPlay
              muted
              loop
              playsInline
              src={String(p.backgroundVideo)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : null}
          {backgroundType !== 'none' && Number(p.overlayOpacity) > 0 ? (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background: String(p.overlayColor || '#000000'),
                opacity: (Number(p.overlayOpacity) || 0) / 100,
                pointerEvents: 'none',
              }}
            />
          ) : null}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flex: 1,
              width: '100%',
              ...(boxed
                ? {
                    maxWidth: Number(p.maxWidth) || 1280,
                    margin: '0 auto',
                    padding: '0 24px',
                  }
                : {}),
            }}
          >
            <div
              className="bb-row-inner"
              style={{
                display: 'flex',
                flex: 1,
                flexWrap: 'wrap',
                minWidth: 0,
                alignItems: valign,
                gap,
                // Gutters are positioned against the flex container, not the section.
                ...(editing ? { position: 'relative' as const } : {}),
              }}
            >
              {editing && editGutter ? editGutter(block) : null}
              {children.length ? (
                children.map((child) => (
                  <BlockRenderer
                    key={child.id}
                    block={child}
                    mode={mode}
                    products={products}
                    categories={categories}
                    renderStoreBlock={renderStoreBlock}
                    editChrome={editChrome}
                    editGutter={editGutter}
                    breakpoint={breakpoint}
                  />
                ))
              ) : mode === 'edit' ? (
                <div className="flex w-full min-h-24 items-center justify-center rounded-lg border border-dashed border-sky-300 bg-sky-50/40 text-xs font-medium text-sky-600">
                  <L text="Empty row — pick a column layout from the Rows tab" />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      );
    }

    case 'column': {
      const children = block.children || [];
      const gap = Number(p.gap) || 0;
      const width = Number(p.width);
      const { className, css } = responsiveAttrs(block, breakpoint);
      const valign = String(p.valign || 'stretch');
      const reversed = p.reverseOnMobile === true || p.stackOrder === 'reverse';
      const cls = String(className).split(' ')[0];

      const style: React.CSSProperties = {
        flex: Number.isFinite(width) && width > 0 ? `0 0 ${columnBasis(width, gap)}` : '1 1 0',
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap,
        justifyContent: valign,
        ...boxCss(p.padding),
        ...borderCss(p.borderWidth, p.borderStyle, p.borderColor),
        borderRadius: Number(p.radius) || 0,
        ...(editing ? { position: 'relative' as const } : {}),
      };
      if (p.backgroundColor && p.backgroundColor !== 'transparent') {
        style.backgroundColor = String(p.backgroundColor);
      }

      const orderCss = reversed
        ? breakpoint
          ? `.bp-${breakpoint} .${cls}{order:-1}`
          : `@media(max-width:767px){.${cls}{order:-1}}`
        : '';

      return (
        <div
          data-node={editing ? block.id : undefined}
          className={['bb-col', className, p.cssClass ? String(p.cssClass) : '']
            .filter(Boolean)
            .join(' ')}
          style={style}
        >
          {editing && editChrome ? editChrome(block) : null}
          {css || orderCss ? <style>{css + orderCss}</style> : null}
          {children.length ? (
            children.map((child) => {
              const rendered = (
                <BlockRenderer
                  block={child}
                  mode={mode}
                  products={products}
                  categories={categories}
                  renderStoreBlock={renderStoreBlock}
                  editChrome={editChrome}
                  editGutter={editGutter}
                  breakpoint={breakpoint}
                />
              );
              // Storefront rendering stays exactly as it was — no extra wrappers.
              if (!editing || !editChrome) return <div key={child.id} style={{ display: 'contents' }}>{rendered}</div>;
              // Modules get a wrapper that hosts their toolbar and selection ring;
              // layout nodes render their own chrome inside themselves.
              if (isLayoutType(child.type)) return <div key={child.id} className="w-full">{rendered}</div>;
              return (
                <div key={child.id} data-node={child.id} className={`relative w-full bb-${child.id}`}>
                  {editChrome(child)}
                  {rendered}
                </div>
              );
            })
          ) : mode === 'edit' ? (
            <div className="flex min-h-24 flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-400">
              <L text="Empty column — drop a module here" />
            </div>
          ) : null}
        </div>
      );
    }

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

    case 'html': {
      const code = String(p.code || '');
      /* `dangerouslySetInnerHTML` and children are mutually exclusive in
         React — in edit mode the code preview replaces the embed instead of
         sitting inside it (this used to crash the whole canvas). */
      if (mode === 'edit') {
        return (
          <div className="cms-embed">
            <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-emerald-300">
              {code.slice(0, 400)}
            </pre>
          </div>
        );
      }
      return <div className="cms-embed" dangerouslySetInnerHTML={{ __html: code }} />;
    }

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
            <L text="No images in this gallery yet." />
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

    case 'product_grid': {
      /* `/home` hands us the live storefront card (with cart actions). */
      const live = renderStoreBlock?.(block);
      if (live) return <>{live}</>;
      // Otherwise preview the shared showcase so the heading + cards look
      // identical to the Product Showcase block.
      return <ProductGrid block={block} products={products} mode={mode} />;
    }

    /* Storefront sections need live catalogue data and server-only components,
       so `/home` renders them itself; here we only show what will appear. */
    case 'store_products': {
      /* `/home` hands us the live server-rendered section when it has one. */
      const live = renderStoreBlock?.(block);
      if (live) return <>{live}</>;
      // Otherwise preview the real section with the resolved product list,
      // so the admin always sees the products this block will show.
      return <StoreProductsPreview block={block} products={products ?? []} />;
    }

    case 'store_categories':
    case 'store_stats':
    case 'store_about':
    case 'store_deal':
    case 'store_story':
    case 'store_mind':
    case 'store_blog':
    case 'store_widgets': {
      /* `/home` hands us the live server-rendered section when it has one. */
      const live = renderStoreBlock?.(block);
      if (live) return <>{live}</>;
      const def = BLOCK_DEFS[block.type];
      return (
        <Section block={block}>
          <Container>
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-emerald-800">
                <L text={def.label} />
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-emerald-700/70">
                <L text={def.description || ''} /> <T k="cmscontent.builder.renderedLive" />
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
          href: String(entry?.url ?? '').trim() || '/home/products',
          ctaLabel: String(entry?.ctaLabel ?? '').trim(),
        }))
        .filter((slide) => slide.title && slide.img);

      if (slides.length === 0) {
        return (
          <Section block={block}>
            <Container>
              <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-400">
                <L text="Add a slide with an image and a title to show this hero." />
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
                        {item.q || <L text="Untitled question" />}
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-600">{item.a}</p>
                    </details>
                  ) : (
                    <div key={key} className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
                      <p className="text-sm font-semibold text-zinc-900">
                        {item.q || <L text="Untitled question" />}
                      </p>
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
          <T k="cmscontent.builder.unknownBlock" params={{ type: block.type }} />
        </div>
      );
  }
}

export function blockLabel(type: string) {
  return BLOCK_DEFS[type as BlockType]?.label || type;
}

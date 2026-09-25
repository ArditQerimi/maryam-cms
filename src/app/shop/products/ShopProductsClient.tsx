'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  ImageOff,
  List,
  LoaderCircle,
  PackageOpen,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import legacyStyles from '../bookstore.module.css';
import ProductActionBar, { ProductAddToCartButton } from '../components/ProductActionBar';
import styles from './shop-products.module.css';

export type CatalogProduct = {
  id: number;
  name: string;
  sku: string;
  /** Effective (possibly discounted) price the shopper pays. */
  price: number;
  /** Original list price when a discount applies, otherwise `null`. */
  originalPrice: number | null;
  imageUrl: string;
  categoryId: number | null;
  categoryName: string;
  stockQuantity: number;
  variantId: number | null;
  description: string;
  size: string | null;
  color: string | null;
  createdAt: number;
};

export type CatalogCategory = {
  id: number;
  name: string;
  count: number;
};

export type FacetValue = {
  value: string;
  count: number;
};

type Props = {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  sizeFacets: FacetValue[];
  colorFacets: FacetValue[];
};

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'newest';
type ViewMode = 'grid' | 'list';
type StockFilter = 'in' | 'out';
type PageItem = number | 'start-ellipsis' | 'end-ellipsis';

type FilterPanelProps = {
  idPrefix: string;
  categories: CatalogCategory[];
  sizeFacets: FacetValue[];
  colorFacets: FacetValue[];
  activeCategories: Set<number>;
  activeSizes: Set<string>;
  activeColors: Set<string>;
  stockFilter: StockFilter | null;
  inStockCount: number;
  outOfStockCount: number;
  priceBounds: PriceBounds;
  activePrice: [number, number];
  hasActiveFilters: boolean;
  onToggleCategory: (categoryId: number) => void;
  onToggleSize: (size: string) => void;
  onToggleColor: (color: string) => void;
  onStockChange: (value: StockFilter) => void;
  onApplyPrice: (minPrice: string, maxPrice: string) => void;
  onClearAll: () => void;
};

type PriceBounds = {
  min: number;
  max: number;
};

const PAGE_SIZE = 12;
const FILTER_PARAM_KEYS = ['q', 'category', 'size', 'color', 'stock', 'min', 'max', 'page'] as const;
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'default', label: 'Default sorting' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name-asc', label: 'Name: A–Z' },
  { value: 'name-desc', label: 'Name: Z–A' },
];
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const priceFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

/** Sale price with the struck-through original next to it when discounted. */
function PricePair({ product }: { product: CatalogProduct }) {
  return (
    <span className={styles.pricePair}>
      <span className={styles.productPrice}>{formatPrice(product.price)}</span>
      {product.originalPrice !== null ? (
        <s className={styles.oldPrice} aria-label="Original price">
          {formatPrice(product.originalPrice)}
        </s>
      ) : null}
    </span>
  );
}

function formatPriceInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function parseFiniteNumber(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isSortKey(value: string | null): value is SortKey {
  return SORT_OPTIONS.some((option) => option.value === value);
}

function isViewMode(value: string | null): value is ViewMode {
  return value === 'grid' || value === 'list';
}

function isStockFilter(value: string | null): value is StockFilter {
  return value === 'in' || value === 'out';
}

function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value.trim());
}

function toQuickViewProduct(product: CatalogProduct) {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    stockQuantity: product.stockQuantity,
    variantId: product.variantId,
    description: product.description,
    categoryName: product.categoryName,
    categoryId: product.categoryId,
  };
}

function createPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) return [1, 2, 3, 4, 'end-ellipsis', totalPages];
  if (currentPage >= totalPages - 3) {
    return [1, 'start-ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'start-ellipsis', currentPage - 1, currentPage, currentPage + 1, 'end-ellipsis', totalPages];
}

function ProductImage({
  src,
  alt,
  sizes,
  preload = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  preload?: boolean;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');

  return (
    <div className={styles.productImage} data-loaded={state === 'loaded'}>
      {state === 'loading' ? <span className={styles.imageSkeleton} aria-hidden="true" /> : null}
      {state === 'error' ? (
        <span className={styles.imageFallback} role="img" aria-label={`No image available for ${alt}`}>
          <ImageOff size={34} strokeWidth={1.35} aria-hidden="true" />
          <span>Image unavailable</span>
        </span>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes={sizes}
          preload={preload}
          loading={preload ? 'eager' : 'lazy'}
          fetchPriority={preload ? 'high' : 'auto'}
          className={styles.productImageImg}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      )}
    </div>
  );
}

function ProductCard({
  product,
  quickViewIndex,
  quickViewProducts,
  preloadImage = false,
}: {
  product: CatalogProduct;
  quickViewIndex: number;
  quickViewProducts: ReturnType<typeof toQuickViewProduct>[];
  preloadImage?: boolean;
}) {
  const quickViewProduct = quickViewProducts[quickViewIndex] ?? toQuickViewProduct(product);
  const inStock = product.stockQuantity > 0;

  return (
    <article className={`${styles.productCard} ${legacyStyles.productCard}`}>
      <div className={styles.mediaWrap}>
        <Link
          href={`/shop/products/${product.id}`}
          className={styles.mediaLink}
          aria-label={`View ${product.name}`}
        >
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            sizes="(max-width: 380px) 92vw, (max-width: 720px) 46vw, (max-width: 1280px) 30vw, 360px"
            preload={preloadImage}
          />
        </Link>
        {inStock ? null : <span className={styles.stockBadge}>Out of stock</span>}
        <ProductActionBar
          product={quickViewProduct}
          products={quickViewProducts}
          initialIndex={quickViewIndex}
        />
      </div>

      <div className={styles.cardBody}>
        <span className={styles.productCategory}>{product.categoryName}</span>
        <Link href={`/shop/products/${product.id}`} className={styles.productTitleLink}>
          <h2 className={styles.productTitle}>{product.name}</h2>
        </Link>
        {product.sku ? <span className={styles.productSku}>SKU {product.sku}</span> : null}

        <div className={styles.priceRow}>
          <PricePair product={product} />
        </div>

        {product.size || product.color ? (
          <div className={styles.attributeList} aria-label="Product attributes">
            {product.size ? <span className={styles.productAttribute}>Size: {product.size}</span> : null}
            {product.color ? <span className={styles.productAttribute}>Color: {product.color}</span> : null}
          </div>
        ) : null}

        {inStock ? (
          <div className={styles.addToCartSlot}>
            <ProductAddToCartButton product={quickViewProduct} />
          </div>
        ) : (
          <span className={styles.outOfStock}>Currently unavailable</span>
        )}
      </div>
    </article>
  );
}

function ProductListItem({
  product,
  quickViewIndex,
  quickViewProducts,
}: {
  product: CatalogProduct;
  quickViewIndex: number;
  quickViewProducts: ReturnType<typeof toQuickViewProduct>[];
}) {
  const quickViewProduct = quickViewProducts[quickViewIndex] ?? toQuickViewProduct(product);
  const inStock = product.stockQuantity > 0;

  return (
    <article className={`${styles.listItem} ${legacyStyles.productCard}`}>
      <div className={styles.listMedia}>
        <Link
          href={`/shop/products/${product.id}`}
          className={styles.mediaLink}
          aria-label={`View ${product.name}`}
        >
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            sizes="(max-width: 700px) 92vw, 270px"
            preload={quickViewIndex < 3}
          />
        </Link>
        {inStock ? null : <span className={styles.stockBadge}>Out of stock</span>}
        <ProductActionBar
          product={quickViewProduct}
          products={quickViewProducts}
          initialIndex={quickViewIndex}
        />
      </div>

      <div className={styles.listBody}>
        <span className={styles.listCategory}>{product.categoryName}</span>
        <Link href={`/shop/products/${product.id}`} className={styles.productTitleLink}>
          <h2 className={styles.listTitle}>{product.name}</h2>
        </Link>
        {product.description ? <p className={styles.listDescription}>{product.description}</p> : null}
        <div className={styles.listMeta}>
          <PricePair product={product} />
          {product.sku ? <span>SKU {product.sku}</span> : null}
          <span className={inStock ? styles.inStock : styles.outOfStockInline}>
            {inStock ? `${product.stockQuantity} in stock` : 'Out of stock'}
          </span>
        </div>
        {product.size || product.color ? (
          <div className={styles.attributeList} aria-label="Product attributes">
            {product.size ? <span className={styles.productAttribute}>Size: {product.size}</span> : null}
            {product.color ? <span className={styles.productAttribute}>Color: {product.color}</span> : null}
          </div>
        ) : null}
        {inStock ? (
          <div className={styles.addToCartSlot}>
            <ProductAddToCartButton product={quickViewProduct} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FilterOption({
  id,
  type = 'checkbox',
  name,
  checked,
  disabled = false,
  count,
  label,
  color,
  onChange,
}: {
  id: string;
  type?: 'checkbox' | 'radio';
  name?: string;
  checked: boolean;
  disabled?: boolean;
  count: number;
  label: string;
  color?: string;
  onChange: () => void;
}) {
  return (
    <li>
      <label className={styles.filterOption} htmlFor={id} data-disabled={disabled}>
        <input
          id={id}
          type={type}
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
        />
        <span className={styles.customCheckbox} aria-hidden="true">
          <Check size={12} strokeWidth={2.5} />
        </span>
        {color ? (
          <span
            className={styles.colorDot}
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        ) : null}
        <span className={styles.filterOptionText}>{label}</span>
        <span className={styles.filterCount}>{count}</span>
      </label>
    </li>
  );
}

function FilterPanel({
  idPrefix,
  categories,
  sizeFacets,
  colorFacets,
  activeCategories,
  activeSizes,
  activeColors,
  stockFilter,
  inStockCount,
  outOfStockCount,
  priceBounds,
  activePrice,
  hasActiveFilters,
  onToggleCategory,
  onToggleSize,
  onToggleColor,
  onStockChange,
  onApplyPrice,
  onClearAll,
}: FilterPanelProps) {
  const hasPriceRange = priceBounds.max > priceBounds.min;
  const hasAvailabilityData = inStockCount + outOfStockCount > 0;
  const hasAnyFilter = categories.length > 0 || hasPriceRange || hasAvailabilityData;
  const applyPriceForm = (form: HTMLFormElement | null) => {
    if (!form) return;
    const formData = new FormData(form);
    onApplyPrice(String(formData.get('min') ?? ''), String(formData.get('max') ?? ''));
  };

  return (
    <div className={styles.filterPanel}>
      <div className={styles.filterHeader}>
        <div>
          <span className={styles.filterEyebrow}>Refine</span>
          <h2 className={styles.filterTitle}>Filters</h2>
        </div>
        <button
          type="button"
          className={styles.clearButton}
          onClick={onClearAll}
          disabled={!hasActiveFilters}
        >
          Clear all
        </button>
      </div>

      {!hasAnyFilter ? (
        <p className={styles.filterEmpty}>Filters will appear when matching product data is available.</p>
      ) : null}

      {categories.length > 0 ? (
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>Category</legend>
          <ul className={styles.filterList}>
            {categories.map((category) => (
              <FilterOption
                key={category.id}
                id={`${idPrefix}-category-${category.id}`}
                checked={activeCategories.has(category.id)}
                count={category.count}
                label={category.name}
                onChange={() => onToggleCategory(category.id)}
              />
            ))}
          </ul>
        </fieldset>
      ) : null}

      {hasAvailabilityData ? (
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>Availability</legend>
          <ul className={styles.filterList}>
            <FilterOption
              id={`${idPrefix}-availability-in`}
              type="radio"
              name={`${idPrefix}-availability`}
              checked={stockFilter === 'in'}
              disabled={inStockCount === 0}
              count={inStockCount}
              label="In stock"
              onChange={() => onStockChange('in')}
            />
            <FilterOption
              id={`${idPrefix}-availability-out`}
              type="radio"
              name={`${idPrefix}-availability`}
              checked={stockFilter === 'out'}
              disabled={outOfStockCount === 0}
              count={outOfStockCount}
              label="Out of stock"
              onChange={() => onStockChange('out')}
            />
          </ul>
        </fieldset>
      ) : null}

      {hasPriceRange ? (
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>Price</legend>
          <form
            className={styles.priceForm}
            onSubmit={(event) => {
              event.preventDefault();
              applyPriceForm(event.currentTarget);
            }}
          >
            <div className={styles.priceFields}>
              <label className={styles.priceField} htmlFor={`${idPrefix}-min-price`}>
                <span>Min</span>
                <span className={styles.priceInputWrap}>
                  <span aria-hidden="true">€</span>
                  <input
                    key={`${idPrefix}-min-${activePrice[0]}`}
                    id={`${idPrefix}-min-price`}
                    name="min"
                    type="number"
                    inputMode="decimal"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step="0.01"
                    defaultValue={formatPriceInput(activePrice[0])}
                  />
                </span>
              </label>
              <label className={styles.priceField} htmlFor={`${idPrefix}-max-price`}>
                <span>Max</span>
                <span className={styles.priceInputWrap}>
                  <span aria-hidden="true">€</span>
                  <input
                    key={`${idPrefix}-max-${activePrice[1]}`}
                    id={`${idPrefix}-max-price`}
                    name="max"
                    type="number"
                    inputMode="decimal"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step="0.01"
                    defaultValue={formatPriceInput(activePrice[1])}
                  />
                </span>
              </label>
            </div>
            <p className={styles.priceHint}>
              Price range: {formatPrice(activePrice[0])}–{formatPrice(activePrice[1])}
            </p>
            <button type="submit" className={styles.priceApply}>
              Apply price
            </button>
          </form>
        </fieldset>
      ) : null}

      {sizeFacets.length > 0 ? (
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>Size</legend>
          <ul className={styles.filterList}>
            {sizeFacets.map((size, index) => (
              <FilterOption
                key={size.value}
                id={`${idPrefix}-size-${index}`}
                checked={activeSizes.has(size.value)}
                count={size.count}
                label={size.value}
                onChange={() => onToggleSize(size.value)}
              />
            ))}
          </ul>
        </fieldset>
      ) : null}

      {colorFacets.length > 0 ? (
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>Color</legend>
          <ul className={styles.filterList}>
            {colorFacets.map((color, index) => (
              <FilterOption
                key={color.value}
                id={`${idPrefix}-color-${index}`}
                checked={activeColors.has(color.value)}
                count={color.count}
                label={color.value}
                color={isHexColor(color.value) ? color.value : undefined}
                onChange={() => onToggleColor(color.value)}
              />
            ))}
          </ul>
        </fieldset>
      ) : null}
    </div>
  );
}

export default function ShopProductsClient({
  categories,
  products,
  sizeFacets,
  colorFacets,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  const priceBounds = useMemo<PriceBounds>(() => {
    if (products.length === 0) return { min: 0, max: 0 };

    const prices = products.map((product) => product.price).filter(Number.isFinite);
    if (prices.length === 0) return { min: 0, max: 0 };

    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [products]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const activeCategories = useMemo(() => {
    const selected = new Set<number>();
    for (const value of searchParams.getAll('category')) {
      const categoryId = Number(value);
      if (Number.isInteger(categoryId) && categoryById.has(categoryId)) selected.add(categoryId);
    }
    return selected;
  }, [categoryById, searchParams]);

  const activeSizes = useMemo(() => {
    const selected = new Set(searchParams.getAll('size').map((value) => value.toLocaleLowerCase('en')));
    return new Set(
      sizeFacets
        .filter((facet) => selected.has(facet.value.toLocaleLowerCase('en')))
        .map((facet) => facet.value),
    );
  }, [searchParams, sizeFacets]);

  const activeColors = useMemo(() => {
    const selected = new Set(searchParams.getAll('color').map((value) => value.toLocaleLowerCase('en')));
    return new Set(
      colorFacets
        .filter((facet) => selected.has(facet.value.toLocaleLowerCase('en')))
        .map((facet) => facet.value),
    );
  }, [searchParams, colorFacets]);

  const searchQuery = searchParams.get('q')?.trim() ?? '';
  const normalizedSearchQuery = searchQuery.toLocaleLowerCase('en');
  const stockParam = searchParams.get('stock');
  const sortParam = searchParams.get('sort');
  const viewParam = searchParams.get('view');
  const stockFilter: StockFilter | null = isStockFilter(stockParam) ? stockParam : null;
  const sort: SortKey = isSortKey(sortParam) ? sortParam : 'default';
  const view: ViewMode = isViewMode(viewParam) ? viewParam : 'grid';

  const parsedMinPrice = parseFiniteNumber(searchParams.get('min'));
  const parsedMaxPrice = parseFiniteNumber(searchParams.get('max'));
  const firstPrice = clamp(parsedMinPrice ?? priceBounds.min, priceBounds.min, priceBounds.max);
  const secondPrice = clamp(parsedMaxPrice ?? priceBounds.max, priceBounds.min, priceBounds.max);
  const activePrice: [number, number] =
    firstPrice <= secondPrice ? [firstPrice, secondPrice] : [secondPrice, firstPrice];
  const [activeMinPrice, activeMaxPrice] = activePrice;
  const hasPriceFilter =
    priceBounds.max > priceBounds.min &&
    (Math.abs(activeMinPrice - priceBounds.min) > 0.001 ||
      Math.abs(activeMaxPrice - priceBounds.max) > 0.001);

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;

    if (drawerOpen && !dialog.open) dialog.showModal();
    if (!drawerOpen && dialog.open) dialog.close();
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const dialog = drawerRef.current;
    if (!dialog) return;

    const handleNativeClose = () => setDrawerOpen(false);
    dialog.addEventListener('close', handleNativeClose);
    return () => dialog.removeEventListener('close', handleNativeClose);
  }, [drawerOpen]);

  const commitQuery = (
    update: (params: URLSearchParams) => void,
    mode: 'push' | 'replace' = 'push',
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    update(params);

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl === currentUrl) return;

    startTransition(() => {
      if (mode === 'replace') router.replace(nextUrl, { scroll: false });
      else router.push(nextUrl, { scroll: false });
    });
  };

  const resetPage = (params: URLSearchParams) => params.delete('page');

  const toggleMultiFilter = (key: 'category' | 'size' | 'color', value: string) => {
    commitQuery((params) => {
      const currentValues = params.getAll(key);
      const normalizedValue = value.toLocaleLowerCase('en');
      const isSelected = currentValues.some((item) =>
        key === 'category'
          ? item === value
          : item.toLocaleLowerCase('en') === normalizedValue,
      );
      const nextValues = isSelected
        ? currentValues.filter((item) =>
            key === 'category'
              ? item !== value
              : item.toLocaleLowerCase('en') !== normalizedValue,
          )
        : [...currentValues, value];

      params.delete(key);
      nextValues.forEach((item) => params.append(key, item));
      resetPage(params);
    });
  };

  const changeStockFilter = (value: StockFilter) => {
    commitQuery((params) => {
      if (params.get('stock') === value) params.delete('stock');
      else params.set('stock', value);
      resetPage(params);
    });
  };

  const applySearchQuery = (value: string) => {
    const query = value.trim();
    commitQuery((params) => {
      if (query) params.set('q', query);
      else params.delete('q');
      resetPage(params);
    });
  };

  const removeSearchQuery = () => {
    commitQuery((params) => {
      params.delete('q');
      resetPage(params);
    });
  };

  const applyPrice = (minPrice: string, maxPrice: string) => {
    const requestedMin = parseFiniteNumber(minPrice) ?? priceBounds.min;
    const requestedMax = parseFiniteNumber(maxPrice) ?? priceBounds.max;
    const lower = clamp(Math.min(requestedMin, requestedMax), priceBounds.min, priceBounds.max);
    const upper = clamp(Math.max(requestedMin, requestedMax), priceBounds.min, priceBounds.max);

    commitQuery((params) => {
      if (Math.abs(lower - priceBounds.min) < 0.001) params.delete('min');
      else params.set('min', String(roundCurrency(lower)));
      if (Math.abs(upper - priceBounds.max) < 0.001) params.delete('max');
      else params.set('max', String(roundCurrency(upper)));
      resetPage(params);
    });
  };

  const clearAllFilters = () => {
    commitQuery((params) => {
      for (const key of FILTER_PARAM_KEYS) params.delete(key);
    });
  };

  const removePriceFilter = () => {
    commitQuery((params) => {
      params.delete('min');
      params.delete('max');
      resetPage(params);
    });
  };

  const changeSort = (value: SortKey) => {
    commitQuery((params) => {
      if (value === 'default') params.delete('sort');
      else params.set('sort', value);
      resetPage(params);
    });
  };

  const changeView = (value: ViewMode) => {
    commitQuery((params) => {
      if (value === 'grid') params.delete('view');
      else params.set('view', value);
    });
  };

  const availabilityCounts = useMemo(() => {
    let inStock = 0;
    for (const product of products) {
      if (product.stockQuantity > 0) inStock += 1;
    }
    return { inStock, out: products.length - inStock };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      if (
        normalizedSearchQuery &&
        !product.name.toLocaleLowerCase('en').includes(normalizedSearchQuery) &&
        !product.sku.toLocaleLowerCase('en').includes(normalizedSearchQuery) &&
        !product.description.toLocaleLowerCase('en').includes(normalizedSearchQuery) &&
        !product.categoryName.toLocaleLowerCase('en').includes(normalizedSearchQuery)
      ) {
        return false;
      }
      if (activeCategories.size > 0 && (product.categoryId == null || !activeCategories.has(product.categoryId))) {
        return false;
      }
      if (activeSizes.size > 0 && (!product.size || !activeSizes.has(product.size))) return false;
      if (activeColors.size > 0 && (!product.color || !activeColors.has(product.color))) return false;
      if (stockFilter === 'in' && product.stockQuantity <= 0) return false;
      if (stockFilter === 'out' && product.stockQuantity > 0) return false;
      if (product.price < activeMinPrice || product.price > activeMaxPrice) return false;
      return true;
    });

    if (sort === 'default') return filtered;

    return filtered.sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return a.price - b.price || a.name.localeCompare(b.name);
        case 'price-desc':
          return b.price - a.price || a.name.localeCompare(b.name);
        case 'name-asc':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
        case 'name-desc':
          return b.name.localeCompare(a.name, undefined, { sensitivity: 'base', numeric: true });
        case 'newest':
          return b.createdAt - a.createdAt || a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [products, normalizedSearchQuery, activeCategories, activeSizes, activeColors, stockFilter, activeMinPrice, activeMaxPrice, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const requestedPageValue = Number(searchParams.get('page'));
  const requestedPage = Number.isInteger(requestedPageValue) && requestedPageValue > 0
    ? requestedPageValue
    : 1;
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageProducts = filteredProducts.slice(pageStart, pageStart + PAGE_SIZE);
  const pageItems = createPageItems(currentPage, totalPages);
  const showingFrom = filteredProducts.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + PAGE_SIZE, filteredProducts.length);

  useEffect(() => {
    if (requestedPage === currentPage) return;

    const params = new URLSearchParams(searchParams.toString());
    if (currentPage <= 1) params.delete('page');
    else params.set('page', String(currentPage));
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;

    startTransition(() => router.replace(nextUrl, { scroll: false }));
  }, [currentPage, pathname, requestedPage, router, searchParams]);

  const quickViewProducts = useMemo(
    () => filteredProducts.map(toQuickViewProduct),
    [filteredProducts],
  );

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    activeCategories.size +
    activeSizes.size +
    activeColors.size +
    (stockFilter ? 1 : 0) +
    (hasPriceFilter ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const openDrawer = () => {
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => filterButtonRef.current?.focus());
  };

  const changePage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    commitQuery((params) => {
      if (page === 1) params.delete('page');
      else params.set('page', String(page));
    });

    window.setTimeout(() => {
      resultsHeadingRef.current?.focus({ preventScroll: true });
      resultsHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const filterPanelProps: Omit<FilterPanelProps, 'idPrefix'> = {
    categories,
    sizeFacets,
    colorFacets,
    activeCategories,
    activeSizes,
    activeColors,
    stockFilter,
    inStockCount: availabilityCounts.inStock,
    outOfStockCount: availabilityCounts.out,
    priceBounds,
    activePrice,
    hasActiveFilters,
    onToggleCategory: (categoryId) => toggleMultiFilter('category', String(categoryId)),
    onToggleSize: (size) => toggleMultiFilter('size', size),
    onToggleColor: (color) => toggleMultiFilter('color', color),
    onStockChange: changeStockFilter,
    onApplyPrice: applyPrice,
    onClearAll: clearAllFilters,
  };

  return (
    <div className={styles.catalogPage}>
      <section className={styles.hero} aria-labelledby="catalog-title">
        <div className={`${styles.container} ${styles.heroInner}`}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/shop" className={styles.breadcrumbLink}>
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <span className={styles.breadcrumbCurrent} aria-current="page">
              Shop
            </span>
          </nav>
          <div className={styles.heroCopy}>
            <span className={styles.heroEyebrow}>Curated collection</span>
            <h1 id="catalog-title" className={styles.heroTitle}>
              Find your next read
            </h1>
            <p className={styles.heroLead}>
              Explore the collection, compare titles, and choose the book that belongs in your library.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.catalogBody}>
        <div className={styles.container}>
          <div className={styles.catalogLayout}>
            <aside className={styles.filterSidebar} aria-label="Product filters">
              <FilterPanel idPrefix="desktop" {...filterPanelProps} />
            </aside>

            <div className={styles.catalogMain}>
              <div className={styles.toolbar}>
                <div className={styles.toolbarTop}>
                  <div className={styles.resultSummary} role="status" aria-live="polite">
                    <strong>{filteredProducts.length}</strong>{' '}
                    {filteredProducts.length === 1 ? 'product' : 'products'}
                    {filteredProducts.length > 0 ? (
                      <span className={styles.resultRange}>
                        {' '}
                        · Showing {showingFrom}–{showingTo}
                      </span>
                    ) : null}
                    {isPending ? (
                      <span className={styles.pendingIndicator}>
                        <LoaderCircle size={14} aria-hidden="true" /> Updating
                      </span>
                    ) : null}
                  </div>

                  <div className={styles.toolbarControls}>
                    <button
                      ref={filterButtonRef}
                      type="button"
                      className={styles.mobileFilterButton}
                      onClick={openDrawer}
                      disabled={products.length === 0}
                      aria-haspopup="dialog"
                      aria-expanded={drawerOpen}
                    >
                      <SlidersHorizontal size={17} aria-hidden="true" />
                      Filters
                      {activeFilterCount > 0 ? (
                        <span className={styles.filterButtonCount}>{activeFilterCount}</span>
                      ) : null}
                    </button>

                    <label className={styles.sortControl} htmlFor="catalog-sort">
                      <span>Sort by</span>
                      <select
                        id="catalog-sort"
                        value={sort}
                        onChange={(event) => changeSort(event.target.value as SortKey)}
                      >
                        {SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className={styles.viewToggle} aria-label="Catalog view" role="group">
                      <button
                        type="button"
                        className={styles.viewButton}
                        data-active={view === 'grid'}
                        aria-label="Grid view"
                        aria-pressed={view === 'grid'}
                        onClick={() => changeView('grid')}
                        disabled={products.length === 0}
                      >
                        <Grid2X2 size={17} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.viewButton}
                        data-active={view === 'list'}
                        aria-label="List view"
                        aria-pressed={view === 'list'}
                        onClick={() => changeView('list')}
                        disabled={products.length === 0}
                      >
                        <List size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                <form
                  className={styles.searchForm}
                  role="search"
                  aria-label="Search products"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = String(new FormData(event.currentTarget).get('q') ?? '');
                    applySearchQuery(value);
                  }}
                >
                  <label className={styles.searchLabel} htmlFor="catalog-search">
                    Search
                  </label>
                  <div className={styles.searchControl}>
                    <Search className={styles.searchLeadingIcon} size={17} aria-hidden="true" />
                    <input
                      key={`catalog-search-${searchQuery}`}
                      id="catalog-search"
                      name="q"
                      type="search"
                      maxLength={200}
                      defaultValue={searchQuery}
                      placeholder="Name, SKU, description, or category"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className={styles.searchSubmit}
                      aria-label="Apply product search"
                      title="Search"
                    >
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </form>

                {hasActiveFilters ? (
                  <div className={styles.activeFilters} aria-label="Active filters">
                    <div className={styles.filterChips}>
                      {searchQuery ? (
                        <button
                          type="button"
                          className={`${styles.filterChip} ${styles.searchFilterChip}`}
                          onClick={removeSearchQuery}
                          aria-label={`Remove search ${searchQuery}`}
                        >
                          <span className={styles.searchChipLabel}>Search: “{searchQuery}”</span>
                          <X size={13} aria-hidden="true" />
                        </button>
                      ) : null}
                      {Array.from(activeCategories).map((categoryId) => (
                        <button
                          key={`category-${categoryId}`}
                          type="button"
                          className={styles.filterChip}
                          onClick={() => toggleMultiFilter('category', String(categoryId))}
                          aria-label={`Remove ${categoryById.get(categoryId)?.name ?? 'category'} filter`}
                        >
                          {categoryById.get(categoryId)?.name}
                          <X size={13} aria-hidden="true" />
                        </button>
                      ))}
                      {Array.from(activeSizes).map((size) => (
                        <button
                          key={`size-${size}`}
                          type="button"
                          className={styles.filterChip}
                          onClick={() => toggleMultiFilter('size', size)}
                          aria-label={`Remove size ${size} filter`}
                        >
                          Size: {size}
                          <X size={13} aria-hidden="true" />
                        </button>
                      ))}
                      {Array.from(activeColors).map((color) => (
                        <button
                          key={`color-${color}`}
                          type="button"
                          className={styles.filterChip}
                          onClick={() => toggleMultiFilter('color', color)}
                          aria-label={`Remove color ${color} filter`}
                        >
                          Color: {color}
                          <X size={13} aria-hidden="true" />
                        </button>
                      ))}
                      {stockFilter ? (
                        <button
                          type="button"
                          className={styles.filterChip}
                          onClick={() => changeStockFilter(stockFilter)}
                          aria-label={`Remove ${stockFilter === 'in' ? 'in stock' : 'out of stock'} filter`}
                        >
                          {stockFilter === 'in' ? 'In stock' : 'Out of stock'}
                          <X size={13} aria-hidden="true" />
                        </button>
                      ) : null}
                      {hasPriceFilter ? (
                        <button
                          type="button"
                          className={styles.filterChip}
                          onClick={removePriceFilter}
                          aria-label="Remove price filter"
                        >
                          {formatPrice(activePrice[0])}–{formatPrice(activePrice[1])}
                          <X size={13} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    <button type="button" className={styles.clearAllButton} onClick={clearAllFilters}>
                      Clear all
                    </button>
                  </div>
                ) : null}
              </div>

              <h2 ref={resultsHeadingRef} className={styles.resultsHeading} tabIndex={-1}>
                {view === 'grid' ? 'Product grid' : 'Product list'}
              </h2>

              <div
                className={styles.resultsViewport}
                aria-busy={isPending}
                data-pending={isPending}
              >
                {filteredProducts.length > 0 ? (
                  view === 'grid' ? (
                    <div className={styles.resultsGrid}>
                      {pageProducts.map((product, index) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          quickViewIndex={pageStart + index}
                          quickViewProducts={quickViewProducts}
                          preloadImage={pageStart + index < 4}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.resultsList}>
                      {pageProducts.map((product, index) => (
                        <ProductListItem
                          key={product.id}
                          product={product}
                          quickViewIndex={pageStart + index}
                          quickViewProducts={quickViewProducts}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>
                      <PackageOpen size={32} strokeWidth={1.35} aria-hidden="true" />
                    </span>
                    <h3>{products.length === 0 ? 'No products available' : 'No matching products'}</h3>
                    <p>
                      {products.length === 0
                        ? 'The catalog is currently empty. Please check back soon.'
                        : 'Try removing or changing one of your active filters.'}
                    </p>
                    {hasActiveFilters ? (
                      <button type="button" className={styles.emptyAction} onClick={clearAllFilters}>
                        Clear all filters
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              {totalPages > 1 ? (
                <nav className={styles.pagination} aria-label="Catalog pagination">
                  <button
                    type="button"
                    className={styles.paginationButton}
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={17} aria-hidden="true" />
                    <span>Previous</span>
                  </button>

                  <div className={styles.pageNumbers}>
                    {pageItems.map((item) =>
                      item === 'start-ellipsis' || item === 'end-ellipsis' ? (
                        <span key={item} className={styles.paginationEllipsis} aria-hidden="true">
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          className={styles.paginationButton}
                          data-active={item === currentPage}
                          onClick={() => changePage(item)}
                          aria-label={`Page ${item}`}
                          aria-current={item === currentPage ? 'page' : undefined}
                        >
                          {item}
                        </button>
                      ),
                    )}
                  </div>

                  <button
                    type="button"
                    className={styles.paginationButton}
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    <span>Next</span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </nav>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <dialog
        ref={drawerRef}
        className={styles.filterDrawer}
        aria-labelledby="filter-drawer-title"
        onCancel={(event) => {
          event.preventDefault();
          setDrawerOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDrawerOpen(false);
        }}
      >
        <div className={styles.drawerHeader}>
          <div>
            <span className={styles.filterEyebrow}>Refine</span>
            <h2 id="filter-drawer-title">Filter products</h2>
          </div>
          <button type="button" className={styles.drawerClose} onClick={() => setDrawerOpen(false)} aria-label="Close filters">
            <X size={21} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.drawerBody}>
          <FilterPanel idPrefix="drawer" {...filterPanelProps} />
        </div>
        <div className={styles.drawerFooter}>
          <span>
            <strong>{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'product' : 'products'}
          </span>
          <button type="button" className={styles.drawerApply} onClick={closeDrawer}>
            Show results
          </button>
        </div>
      </dialog>
    </div>
  );
}

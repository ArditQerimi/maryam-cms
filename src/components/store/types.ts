/**
 * Shared, isomorphic types for the storefront admin modules
 * (products, orders, customers, coupons, discounts).
 * Safe to import from both server components and client components.
 */

export type ActionOk = { ok: true; id?: number };
export type ActionErr = { ok: false; error: string };
export type ActionResult = ActionOk | ActionErr;

export type ProductStatusOption = 'Active' | 'Inactive' | 'Archived' | 'Pending' | 'Suspended';

export type BackorderPolicy = 'deny' | 'notify' | 'allow';

/** Everything the product editor form collects (one product). */
export type ProductFormValues = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  status: ProductStatusOption;
  price: string;
  costPrice: string;
  salePrice: string;
  /** yyyy-mm-dd */
  saleFrom: string;
  /** yyyy-mm-dd */
  saleTo: string;
  sku: string;
  barcode: string;
  stockQuantity: string;
  minStockLevel: string;
  backorder: BackorderPolicy;
  /** images[0] = featured image, the rest = gallery. */
  images: string[];
  categoryId: string;
  subCategoryId: string;
  brandId: string;
  unitId: string;
};

/** A product as handed to the editor by the server component. */
export type ProductEditorData = ProductFormValues & { id: number };

export type VariantFormValues = {
  /** null = not persisted yet. */
  id: number | null;
  productId: number;
  name: string;
  sku: string;
  price: string;
  costPrice: string;
  /** Displayed/edited stock (sum of product_stocks rows, parent fallback). */
  stock: string;
};

export type VariantSaveResult =
  | { ok: true; variant: VariantFormValues }
  | { ok: false; error: string };

/** Per-product settings stored in settings_store under `products_config_{id}`. */
export type ProductConfig = {
  salePrice: string;
  saleFrom: string;
  saleTo: string;
  backorder: BackorderPolicy;
};

export const EMPTY_PRODUCT_CONFIG: ProductConfig = {
  salePrice: '',
  saleFrom: '',
  saleTo: '',
  backorder: 'deny',
};

export const PRODUCT_STATUSES: Array<{ value: ProductStatusOption; label: string }> = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Archived', label: 'Archived' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Suspended', label: 'Suspended' },
];

export const ORDER_STATUSES = ['Pending', 'Completed', 'Cancelled', 'Returned'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const BACKORDER_OPTIONS: Array<{ value: BackorderPolicy; label: string }> = [
  { value: 'deny', label: 'Do not allow' },
  { value: 'notify', label: 'Allow, but notify customer' },
  { value: 'allow', label: 'Allow' },
];

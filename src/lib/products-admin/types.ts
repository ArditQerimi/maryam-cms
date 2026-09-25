export type ProductCatalogStatus = 'Active' | 'Inactive';
export type ProductKind = 'simple' | 'options';
export type ProductDiscountType = 'Percentage' | 'Flat' | null;
export type ProductAttributeDataType = 'string' | 'number' | 'date' | 'boolean';

export type ProductField =
  | 'name'
  | 'slug'
  | 'sku'
  | 'barcode'
  | 'itemCode'
  | 'productType'
  | 'categoryId'
  | 'subCategoryId'
  | 'brandId'
  | 'unitId'
  | 'warrantyId'
  | 'warehouseId'
  | 'description'
  | 'manufacturer'
  | 'manufacturedDate'
  | 'expiryDate'
  | 'price'
  | 'costPrice'
  | 'taxRate'
  | 'discountType'
  | 'discountValue'
  | 'stockQuantity'
  | 'minStockLevel'
  | 'status'
  | 'imageUrl'
  | 'attributes'
  | 'variants'
  | 'concurrencyToken'
  | 'form';

export type ProductActionState = {
  status: 'idle' | 'error' | 'success';
  message: string;
  fieldErrors: Partial<Record<ProductField, string>>;
};

export const INITIAL_PRODUCT_ACTION_STATE: ProductActionState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
};

export type ProductImageDTO = {
  src: string;
  name: string;
  size: string;
  publicId?: string;
};

export type ProductCategoryAttributeDTO = {
  id: number;
  categoryId: number;
  name: string;
  dataType: ProductAttributeDataType;
  isRequired: boolean;
};

export type ProductSubCategoryDTO = {
  id: number;
  categoryId: number;
  name: string;
};

export type ProductCategoryDTO = {
  id: number;
  name: string;
  subCategories: ProductSubCategoryDTO[];
};

export type ProductNamedLookupDTO = {
  id: number;
  name: string;
};

export type ProductWarehouseLookupDTO = ProductNamedLookupDTO & {
  code: string | null;
};

export type ProductOptionValueDTO = {
  id: number;
  attributeId: number;
  value: string;
};

export type ProductOptionAttributeDTO = {
  id: number;
  name: string;
  values: ProductOptionValueDTO[];
};

export type ProductFormLookups = {
  storeName: string | null;
  categories: ProductCategoryDTO[];
  brands: ProductNamedLookupDTO[];
  units: ProductNamedLookupDTO[];
  warranties: ProductNamedLookupDTO[];
  warehouses: ProductWarehouseLookupDTO[];
  categoryAttributes: ProductCategoryAttributeDTO[];
  optionAttributes: ProductOptionAttributeDTO[];
};

export type ProductStockDTO = {
  warehouseId: number;
  quantity: number;
  minStockLevel: number;
};

export type ProductVariantDTO = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: string;
  costPrice: string;
  status: ProductCatalogStatus;
  optionValueIds: number[];
  stocks: ProductStockDTO[];
};

export type ProductEditorDTO = {
  id: number;
  categoryId: number | null;
  subCategoryId: number | null;
  brandId: number | null;
  unitId: number | null;
  storeId: number | null;
  storeName: string | null;
  warehouseId: number | null;
  warrantyId: number | null;
  name: string;
  slug: string;
  sku: string;
  barcode: string | null;
  itemCode: string | null;
  productType: ProductKind;
  price: string;
  costPrice: string;
  taxRate: string;
  discountType: ProductDiscountType;
  discountValue: string;
  stockQuantity: number;
  minStockLevel: number;
  manufacturedDate: string | null;
  expiryDate: string | null;
  description: string;
  manufacturer: string;
  images: ProductImageDTO[];
  status: ProductCatalogStatus;
  attributeValues: Array<{ attributeId: number; value: string }>;
  variants: ProductVariantDTO[];
  defaultVariantId: number | null;
  mode: ProductKind;
  concurrencyToken: string;
};

export type ProductEditorPageData = {
  lookups: ProductFormLookups;
  product: ProductEditorDTO;
};

export type ProductSaveResult = {
  productId: number;
  variantIds: number[];
  defaultVariantId: number | null;
};

export type VariantStockSummaryInput = {
  id: number;
  status: string;
  parentQuantity?: number | null;
  stockRows: Array<{ quantity: number | null }>;
};

export type ProductStockSummaryInput = {
  id: number;
  status: string;
  parentQuantity: number | null;
  variants: VariantStockSummaryInput[];
};

export type VariantStockSummary = {
  activeVariantCount: 0 | 1;
  stockQuantity: number | null;
  usesParentFallback: boolean;
  hasInvalidStock: boolean;
};

export type ProductStockSummary = {
  activeVariantCount: number;
  stockQuantity: number | null;
  outOfStock: boolean | null;
  usesParentFallback: boolean;
  hasInvalidStock: boolean;
};

export type CatalogStockSummary = {
  activeVariants: number;
  productsWithActiveVariants: number;
  outOfStockProducts: number | null;
  hasInvalidStock: boolean;
};

function nonNegativeInteger(value: number | null | undefined) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function summarizeVariantStock(input: VariantStockSummaryInput): VariantStockSummary {
  const isActive = input.status === 'Active';
  if (!isActive) {
    return {
      activeVariantCount: 0,
      stockQuantity: null,
      usesParentFallback: false,
      hasInvalidStock: false,
    };
  }

  if (input.stockRows.length === 0) {
    return {
      activeVariantCount: 1,
      stockQuantity: nonNegativeInteger(input.parentQuantity) ?? 0,
      usesParentFallback: true,
      hasInvalidStock: false,
    };
  }

  let total = 0;
  for (const row of input.stockRows) {
    const quantity = nonNegativeInteger(row.quantity);
    if (quantity === null) {
      return {
        activeVariantCount: 1,
        stockQuantity: null,
        usesParentFallback: false,
        hasInvalidStock: true,
      };
    }
    total += quantity;
    if (!Number.isSafeInteger(total)) {
      return {
        activeVariantCount: 1,
        stockQuantity: null,
        usesParentFallback: false,
        hasInvalidStock: true,
      };
    }
  }

  return {
    activeVariantCount: 1,
    stockQuantity: total,
    usesParentFallback: false,
    hasInvalidStock: false,
  };
}

/**
 * Variant-level stock is authoritative when rows exist. The legacy parent
 * quantity is a shared fallback pool and is therefore added at most once per
 * product, even if several concrete variants have no stock rows.
 */
export function summarizeProductStock(input: ProductStockSummaryInput): ProductStockSummary {
  if (input.status !== 'Active') {
    return {
      activeVariantCount: 0,
      stockQuantity: null,
      outOfStock: null,
      usesParentFallback: false,
      hasInvalidStock: false,
    };
  }

  let activeVariantCount = 0;
  let explicitQuantity = 0;
  let usesParentFallback = false;
  let hasInvalidStock = false;

  for (const variant of input.variants) {
    const summary = summarizeVariantStock({
      ...variant,
      parentQuantity: input.parentQuantity,
    });
    activeVariantCount += summary.activeVariantCount;
    usesParentFallback ||= summary.usesParentFallback;
    hasInvalidStock ||= summary.hasInvalidStock;

    if (summary.activeVariantCount > 0) {
      if (summary.stockQuantity === null) {
        hasInvalidStock = true;
      } else if (!summary.usesParentFallback) {
        explicitQuantity += summary.stockQuantity;
      }
    }

    if (!Number.isSafeInteger(explicitQuantity)) hasInvalidStock = true;
  }

  if (hasInvalidStock) {
    return {
      activeVariantCount,
      stockQuantity: null,
      outOfStock: null,
      usesParentFallback,
      hasInvalidStock: true,
    };
  }

  const parentFallback = usesParentFallback ? (nonNegativeInteger(input.parentQuantity) ?? 0) : 0;
  const stockQuantity = explicitQuantity + parentFallback;
  if (!Number.isSafeInteger(stockQuantity)) {
    return {
      activeVariantCount,
      stockQuantity: null,
      outOfStock: null,
      usesParentFallback,
      hasInvalidStock: true,
    };
  }

  return {
    activeVariantCount,
    stockQuantity,
    outOfStock: activeVariantCount > 0 && stockQuantity === 0,
    usesParentFallback,
    hasInvalidStock: false,
  };
}

export function summarizeCatalogStock(products: ProductStockSummaryInput[]): CatalogStockSummary {
  let activeVariants = 0;
  let productsWithActiveVariants = 0;
  let verifiedOutOfStockProducts = 0;
  let allStockVerified = true;

  for (const product of products) {
    const summary = summarizeProductStock(product);
    activeVariants += summary.activeVariantCount;
    if (summary.activeVariantCount > 0) productsWithActiveVariants += 1;
    if (summary.outOfStock === true) verifiedOutOfStockProducts += 1;
    if (summary.hasInvalidStock) allStockVerified = false;
  }

  return {
    activeVariants,
    productsWithActiveVariants,
    outOfStockProducts: allStockVerified ? verifiedOutOfStockProducts : null,
    hasInvalidStock: !allStockVerified,
  };
}

export type CheckoutCartLineIdentity = {
  productId: number;
  variantId: number;
  quantity: number;
};

export type LockedCatalogKey = {
  productId: number;
  variantId: number;
};

export type AuthoritativeStockRow = {
  id: number;
  warehouseId: number;
  quantity: number;
};

export type StockAllocation = {
  source: 'variant-rows' | 'parent-fallback';
  totalAvailable: number;
  decrements: Array<{ stockRowId: number; quantity: number }>;
};

export class CheckoutStockError extends Error {
  readonly code: 'invalid-cart' | 'invalid-stock' | 'insufficient-stock';

  constructor(code: CheckoutStockError['code']) {
    super(code === 'insufficient-stock'
      ? 'One or more items no longer have sufficient stock.'
      : 'Catalog inventory is invalid.');
    this.name = 'CheckoutStockError';
    this.code = code;
  }
}

function positiveSafeInteger(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function nonNegativeSafeInteger(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

/** Every checkout takes product locks before variant locks in this exact order. */
export function buildCatalogLockPlan(lines: readonly CheckoutCartLineIdentity[]): LockedCatalogKey[] {
  if (
    lines.length === 0
    || lines.some((line) => (
      !positiveSafeInteger(line.productId)
      || !positiveSafeInteger(line.variantId)
      || !Number.isSafeInteger(line.quantity)
      || line.quantity < 1
      || line.quantity > 99
    ))
  ) {
    throw new CheckoutStockError('invalid-cart');
  }

  const unique = new Map<string, LockedCatalogKey>();
  for (const line of lines) {
    const key = `${line.productId}:${line.variantId}`;
    if (unique.has(key)) throw new CheckoutStockError('invalid-cart');
    unique.set(key, { productId: line.productId, variantId: line.variantId });
  }
  return [...unique.values()].sort((left, right) => (
    left.productId - right.productId || left.variantId - right.variantId
  ));
}

/** Stock rows are always locked after all catalog locks, by variant then row. */
export function buildStockLockOrder(keys: readonly LockedCatalogKey[]) {
  return [...new Set(keys.map((key) => key.variantId))]
    .sort((left, right) => left - right);
}

export function assertSharedParentStock(
  demands: readonly {
    productId: number;
    parentQuantity: number | null;
    quantity: number;
  }[],
) {
  const byProduct = new Map<number, { available: number; demanded: number }>();
  for (const demand of demands) {
    if (
      !positiveSafeInteger(demand.productId)
      || !Number.isSafeInteger(demand.quantity)
      || demand.quantity < 1
      || (demand.parentQuantity !== null && !nonNegativeSafeInteger(demand.parentQuantity))
    ) {
      throw new CheckoutStockError('invalid-stock');
    }
    const current = byProduct.get(demand.productId) || {
      available: demand.parentQuantity ?? 0,
      demanded: 0,
    };
    current.demanded += demand.quantity;
    if (!Number.isSafeInteger(current.demanded)) throw new CheckoutStockError('invalid-stock');
    byProduct.set(demand.productId, current);
  }
  if ([...byProduct.values()].some((pool) => pool.demanded > pool.available)) {
    throw new CheckoutStockError('insufficient-stock');
  }
}

export function planStockAllocation(input: {
  variantId: number;
  requestedQuantity: number;
  stockRows: readonly AuthoritativeStockRow[];
  parentQuantity: number | null;
}): StockAllocation {
  if (
    !positiveSafeInteger(input.variantId)
    || !Number.isSafeInteger(input.requestedQuantity)
    || input.requestedQuantity < 1
    || input.requestedQuantity > 9_999
    || (input.parentQuantity !== null && !nonNegativeSafeInteger(input.parentQuantity))
    || input.stockRows.some((row) => (
      !positiveSafeInteger(row.id)
      || !positiveSafeInteger(row.warehouseId)
      || !nonNegativeSafeInteger(row.quantity)
    ))
  ) {
    throw new CheckoutStockError('invalid-stock');
  }

  // Any row for the variant makes variant rows authoritative. Parent stock is
  // never consulted in that case, even if the variant rows sum to zero.
  if (input.stockRows.length > 0) {
    const rows = [...input.stockRows].sort((left, right) => (
      left.warehouseId - right.warehouseId || left.id - right.id
    ));
    let remaining = input.requestedQuantity;
    let totalAvailable = 0;
    const decrements: StockAllocation['decrements'] = [];
    for (const row of rows) {
      totalAvailable += row.quantity;
      if (!Number.isSafeInteger(totalAvailable)) throw new CheckoutStockError('invalid-stock');
      const quantity = Math.min(row.quantity, remaining);
      if (quantity > 0) {
        decrements.push({ stockRowId: row.id, quantity });
        remaining -= quantity;
      }
    }
    if (remaining > 0) throw new CheckoutStockError('insufficient-stock');
    return { source: 'variant-rows', totalAvailable, decrements };
  }

  const available = input.parentQuantity ?? 0;
  if (available < input.requestedQuantity) throw new CheckoutStockError('insufficient-stock');
  return {
    source: 'parent-fallback',
    totalAvailable: available,
    decrements: [],
  };
}

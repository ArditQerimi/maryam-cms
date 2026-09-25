'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  CommerceHydrationStatus,
  CommerceStorageScope,
  ProductId,
  VariantId,
} from '@/context/CartContext';

export type { CommerceHydrationStatus, CommerceStorageScope, ProductId, VariantId } from '@/context/CartContext';

export const COMPARE_STORAGE_KEY = 'noor_compare';
export const DEFAULT_COMPARE_LIMIT = 4;
export const MAX_COMPARE_ITEMS = DEFAULT_COMPARE_LIMIT;

export type CompareItem = {
  productId: ProductId;
  variantId: VariantId;
  name: string;
  price: number;
  imageUrl: string;
  stockQuantity: number;
  description: string;
  sku?: string;
  oldPrice?: number;
  rating?: number;
  categoryName?: string;
  /** @deprecated Use productId. */
  id: ProductId;
};

export type CompareItemInput = {
  productId?: ProductId;
  variantId?: VariantId;
  /** @deprecated Use productId. */
  id?: ProductId;
  name: string;
  price: number;
  imageUrl: string;
  stockQuantity?: number;
  description?: string;
  sku?: string | null;
  oldPrice?: number | null;
  rating?: number | null;
  categoryName?: string | null;
};

export type CompareItemSelector =
  | ProductId
  | { productId: ProductId; variantId?: VariantId }
  | { id: ProductId; variantId?: VariantId };

export type CompareMutationResult = {
  ok: boolean;
  changed: boolean;
  reason?: 'invalid' | 'ambiguous' | 'not-found' | 'limit';
  message?: string;
};

type RecordValue = Record<string, unknown>;

type StoredListResult = {
  items: CompareItem[];
  hadInvalidEntries: boolean;
  wasOversized: boolean;
};

type StorageReadResult = StoredListResult & {
  raw: string | null;
  available: boolean;
  readError: boolean;
  scope: CommerceStorageScope;
};

const COMPARE_READ_ERROR =
  'Your saved comparison could not be read in this browser. It is safe to try again, but changes will stay in memory for this tab.';
const COMPARE_WRITE_ERROR =
  'Your comparison changed, but this browser session could not save it. It will remain available for this tab only.';
export const COMPARE_LIMIT_MESSAGE = 'Comparison is limited to 4 products. Remove one before adding another.';

function getCompareLimitMessage(maxItems: number): string {
  return `Comparison is limited to ${maxItems} products. Remove one before adding another.`;
}
const INVALID_COMPARE_ITEM_ERROR = 'That comparison item is not valid.';
const AMBIGUOUS_COMPARE_ERROR = 'Choose a specific product variant before changing it.';

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseId(value: unknown): ProductId | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Number.isInteger(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function parseVariantId(value: unknown): { valid: boolean; value: VariantId } {
  if (value === undefined || value === null || value === '') {
    return { valid: true, value: null };
  }
  const parsed = parseId(value);
  return parsed === null ? { valid: false, value: null } : { valid: true, value: parsed };
}

function parseProductId(record: RecordValue): ProductId | null {
  const hasCanonical = record.productId !== undefined && record.productId !== null;
  const hasLegacy = record.id !== undefined && record.id !== null;
  const canonical = hasCanonical ? parseId(record.productId) : null;
  const legacy = hasLegacy ? parseId(record.id) : null;

  if (hasCanonical && canonical === null) return null;
  if (hasLegacy && legacy === null) return null;
  if (hasCanonical && hasLegacy && canonical !== legacy) return null;
  return canonical ?? legacy;
}

function parsePrice(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseStock(value: unknown): { valid: boolean; value: number } {
  if (value === undefined || value === null) return { valid: true, value: 0 };
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0
    ? { valid: true, value: parsed }
    : { valid: false, value: 0 };
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function makeCompareItem(
  productId: ProductId,
  variantId: VariantId,
  name: string,
  price: number,
  imageUrl: string,
  stockQuantity: number,
  description: string,
  sku?: string,
  oldPrice?: number,
  rating?: number,
  categoryName?: string,
): CompareItem {
  const item: CompareItem = {
    productId,
    variantId,
    name,
    price,
    imageUrl,
    stockQuantity,
    description,
    id: productId,
  };
  if (sku) item.sku = sku;
  if (oldPrice !== undefined) item.oldPrice = oldPrice;
  if (rating !== undefined) item.rating = rating;
  if (categoryName) item.categoryName = categoryName;
  return item;
}

function normalizeInput(input: CompareItemInput): CompareItem | null {
  if (!isRecord(input)) return null;
  const productId = parseProductId(input);
  if (productId === null) return null;
  const variant = parseVariantId(input.variantId);
  if (!variant.valid) return null;

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const price = parsePrice(input.price);
  const stock = parseStock(input.stockQuantity);
  const imageUrl = input.imageUrl === undefined || input.imageUrl === null ? '' : input.imageUrl;
  const description = input.description === undefined || input.description === null ? '' : input.description;
  if (!name || price === null || !stock.valid || typeof imageUrl !== 'string' || typeof description !== 'string') {
    return null;
  }

  return makeCompareItem(
    productId,
    variant.value,
    name,
    price,
    imageUrl,
    stock.value,
    description.trim(),
    parseOptionalString(input.sku),
    parseOptionalNumber(input.oldPrice),
    parseOptionalNumber(input.rating),
    parseOptionalString(input.categoryName),
  );
}

function lineKey(productId: ProductId, variantId: VariantId): string {
  return JSON.stringify([
    typeof productId,
    productId,
    typeof variantId,
    variantId,
  ]);
}

function normalizeStoredList(value: unknown, maxItems: number): StoredListResult {
  if (!Array.isArray(value)) return { items: [], hadInvalidEntries: true, wasOversized: false };

  const items: CompareItem[] = [];
  const keys = new Set<string>();
  let hadInvalidEntries = false;

  for (const rawItem of value) {
    if (!isRecord(rawItem)) {
      hadInvalidEntries = true;
      continue;
    }
    const productId = parseProductId(rawItem);
    if (productId === null) {
      hadInvalidEntries = true;
      continue;
    }
    const variant = parseVariantId(rawItem.variantId);
    if (!variant.valid) {
      hadInvalidEntries = true;
      continue;
    }
    const name = typeof rawItem.name === 'string' ? rawItem.name.trim() : '';
    const price = parsePrice(rawItem.price);
    const stock = parseStock(rawItem.stockQuantity);
    const imageUrl = rawItem.imageUrl === undefined || rawItem.imageUrl === null ? '' : rawItem.imageUrl;
    const description = rawItem.description === undefined || rawItem.description === null ? '' : rawItem.description;
    if (!name || price === null || !stock.valid || typeof imageUrl !== 'string' || typeof description !== 'string') {
      hadInvalidEntries = true;
      continue;
    }

    const key = lineKey(productId, variant.value);
    if (keys.has(key)) continue;
    keys.add(key);
    items.push(
      makeCompareItem(
        productId,
        variant.value,
        name,
        price,
        imageUrl,
        stock.value,
        description.trim(),
        parseOptionalString(rawItem.sku),
        parseOptionalNumber(rawItem.oldPrice),
        parseOptionalNumber(rawItem.rating),
        parseOptionalString(rawItem.categoryName),
      ),
    );
  }

  return {
    items,
    hadInvalidEntries,
    wasOversized: items.length > maxItems,
  };
}

function serializeCompareItems(items: readonly CompareItem[]) {
  return items.map((item) => {
    const serialized: Omit<CompareItem, 'id'> = {
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      stockQuantity: item.stockQuantity,
      description: item.description,
    };
    if (item.sku !== undefined) serialized.sku = item.sku;
    if (item.oldPrice !== undefined) serialized.oldPrice = item.oldPrice;
    if (item.rating !== undefined) serialized.rating = item.rating;
    if (item.categoryName !== undefined) serialized.categoryName = item.categoryName;
    return serialized;
  });
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLegacyLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readCompareStorage(maxItems: number): StorageReadResult {
  const session = getSessionStorage();
  if (session) {
    try {
      const raw = session.getItem(COMPARE_STORAGE_KEY);
      if (raw !== null) {
        const normalized = normalizeStoredList(JSON.parse(raw) as unknown, maxItems);
        return { ...normalized, raw, available: true, readError: false, scope: 'session' };
      }
    } catch {
      return {
        items: [],
        raw: null,
        available: false,
        readError: true,
        scope: 'unavailable',
        hadInvalidEntries: true,
        wasOversized: false,
      };
    }
  }

  // Older builds wrote compare data to localStorage. Read it as a compatibility
  // fallback, but write all new changes to sessionStorage so compare is
  // explicitly session-scoped from this point forward.
  const legacy = getLegacyLocalStorage();
  if (!legacy) {
    return {
      items: [],
      raw: null,
      available: session !== null,
      readError: session === null,
      scope: session === null ? 'unavailable' : 'session',
      hadInvalidEntries: false,
      wasOversized: false,
    };
  }

  try {
    const raw = legacy.getItem(COMPARE_STORAGE_KEY);
    if (raw !== null) {
      const normalized = normalizeStoredList(JSON.parse(raw) as unknown, maxItems);
      return { ...normalized, raw, available: session !== null, readError: false, scope: 'legacy-local' };
    }
    return {
      items: [],
      raw: null,
      available: session !== null,
      readError: false,
      scope: session === null ? 'memory' : 'session',
      hadInvalidEntries: false,
      wasOversized: false,
    };
  } catch {
    return {
      items: [],
      raw: null,
      available: session !== null,
      readError: true,
      scope: session === null ? 'unavailable' : 'legacy-local',
      hadInvalidEntries: true,
      wasOversized: false,
    };
  }
}

type CompareContextType = {
  compareItems: CompareItem[];
  addToCompare: (item: CompareItemInput) => CompareMutationResult;
  removeFromCompare: (selector: CompareItemSelector, variantId?: VariantId) => CompareMutationResult;
  clearCompare: () => void;
  replaceCompare: (items: readonly CompareItemInput[]) => CompareMutationResult;
  isInCompare: (selector: CompareItemSelector) => boolean;
  compareCount: number;
  maxItems: number;
  maxCompareItems: number;
  compareLimit: number;
  isAtLimit: boolean;
  limitReached: boolean;
  isOverLimit: boolean;
  limitMessage: string;
  isSessionFeature: true;
  isHydrated: boolean;
  hydrated: boolean;
  hydrationStatus: CommerceHydrationStatus;
  isHydrating: boolean;
  isLoading: boolean;
  loading: boolean;
  isPending: boolean;
  pending: boolean;
  error: string | null;
  storageError: string | null;
  /** Integration hooks for a future server adapter. */
  setSyncPending: (pending: boolean) => void;
  setSyncError: (message: string | null) => void;
  storageScope: CommerceStorageScope;
  retryHydration: () => void;
  clearError: () => void;
};

const defaultCompareContext: CompareContextType = {
  compareItems: [],
  addToCompare: () => ({ ok: true, changed: false }),
  removeFromCompare: () => ({ ok: true, changed: false }),
  clearCompare: () => {},
  replaceCompare: () => ({ ok: true, changed: false }),
  isInCompare: () => false,
  compareCount: 0,
  maxItems: DEFAULT_COMPARE_LIMIT,
  maxCompareItems: DEFAULT_COMPARE_LIMIT,
  compareLimit: DEFAULT_COMPARE_LIMIT,
  isAtLimit: false,
  limitReached: false,
  isOverLimit: false,
  limitMessage: getCompareLimitMessage(DEFAULT_COMPARE_LIMIT),
  isSessionFeature: true,
  isHydrated: true,
  hydrated: true,
  hydrationStatus: 'ready',
  isHydrating: false,
  isLoading: false,
  loading: false,
  isPending: false,
  pending: false,
  error: null,
  storageError: null,
  setSyncPending: () => {},
  setSyncError: () => {},
  storageScope: 'memory',
  retryHydration: () => {},
  clearError: () => {},
};

const CompareContext = createContext<CompareContextType>(defaultCompareContext);

function normalizeSelector(
  selector: CompareItemSelector,
  explicitVariantId?: VariantId,
): { productId: ProductId; variantId: VariantId; exactVariant: boolean } | null {
  if (typeof selector === 'string' || typeof selector === 'number') {
    return {
      productId: selector,
      variantId: explicitVariantId ?? null,
      exactVariant: explicitVariantId !== undefined,
    };
  }
  if (!isRecord(selector)) return null;
  const productId = parseProductId(selector);
  if (productId === null) return null;
  const hasVariant = Object.prototype.hasOwnProperty.call(selector, 'variantId');
  const variant = parseVariantId(selector.variantId);
  if (!variant.valid) return null;
  return {
    productId,
    variantId: explicitVariantId ?? variant.value,
    exactVariant: hasVariant || explicitVariantId !== undefined,
  };
}

function findSelectedIndex(items: readonly CompareItem[], selector: CompareItemSelector, explicitVariantId?: VariantId): number {
  const normalized = normalizeSelector(selector, explicitVariantId);
  if (!normalized) return -1;
  const candidates = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.productId === normalized.productId);
  if (normalized.exactVariant) {
    return candidates.find(({ item }) => item.variantId === normalized.variantId)?.index ?? -1;
  }
  if (candidates.length === 1) return candidates[0].index;
  return candidates.find(({ item }) => item.variantId === null)?.index ?? -1;
}

export function CompareProvider({
  children,
  maxItems = DEFAULT_COMPARE_LIMIT,
}: {
  children: ReactNode;
  maxItems?: number;
}) {
  const resolvedMaxItems = Number.isInteger(maxItems) && maxItems > 0 ? maxItems : DEFAULT_COMPARE_LIMIT;
  const limitMessage = getCompareLimitMessage(resolvedMaxItems);
  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydrationStatus, setHydrationStatus] = useState<CommerceHydrationStatus>('loading');
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageScope, setStorageScope] = useState<CommerceStorageScope>('session');

  const itemsRef = useRef<CompareItem[]>([]);
  const hydratedRef = useRef(false);
  const deferredItemsRef = useRef<CompareItem[] | null>(null);
  const storageWriteFailedRef = useRef(false);

  const persist = useCallback((next: CompareItem[]): boolean => {
    if (!hydratedRef.current) return false;
    setIsPending(true);
    const storage = getSessionStorage();
    if (!storage) {
      storageWriteFailedRef.current = true;
      setStorageScope('memory');
      setError(COMPARE_WRITE_ERROR);
      setIsPending(false);
      return false;
    }

    try {
      storage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(serializeCompareItems(next)));
      storageWriteFailedRef.current = false;
      setStorageScope('session');
      setError(null);
      return true;
    } catch {
      storageWriteFailedRef.current = true;
      setStorageScope('memory');
      setError(COMPARE_WRITE_ERROR);
      return false;
    } finally {
      setIsPending(false);
    }
  }, []);

  const commit = useCallback(
    (next: CompareItem[]): boolean => {
      itemsRef.current = next;
      setCompareItems(next);
      if (!hydratedRef.current) {
        deferredItemsRef.current = next;
        return false;
      }
      return persist(next);
    },
    [persist],
  );

  const hydrateFromStorage = useCallback(() => {
    setHydrationStatus('loading');
    setIsHydrated(false);
    setIsPending(true);
    setError(null);

    const result = readCompareStorage(resolvedMaxItems);
    storageWriteFailedRef.current = false;
    const deferred = deferredItemsRef.current;
    let nextItems = result.items;
    let nextError: string | null = null;
    let nextScope = result.scope;

    if (result.readError) {
      nextError = COMPARE_READ_ERROR;
      nextScope = 'unavailable';
    } else if (result.hadInvalidEntries) {
      nextError = 'Some saved comparison data was malformed. Valid items are shown, and the saved data was left unchanged.';
    } else if (result.wasOversized) {
      nextError = `This saved comparison has more than ${resolvedMaxItems} products. Remove an item before adding another.`;
    }

    if (deferred) {
      nextItems = deferred;
      deferredItemsRef.current = null;
      nextScope = 'session';
    } else if (result.raw === null && itemsRef.current.length > 0) {
      nextItems = itemsRef.current;
      nextScope = 'memory';
    }

    itemsRef.current = nextItems;
    hydratedRef.current = true;
    setCompareItems(nextItems);
    setStorageScope(nextScope);
    setError(nextError);
    setIsHydrated(true);
    setHydrationStatus(nextError ? 'error' : 'ready');
    setIsPending(false);

    if (deferred) persist(nextItems);
  }, [persist, resolvedMaxItems]);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  const addToCompare = useCallback(
    (input: CompareItemInput): CompareMutationResult => {
      const item = normalizeInput(input);
      if (!item) {
        setError(INVALID_COMPARE_ITEM_ERROR);
        return { ok: false, changed: false, reason: 'invalid', message: INVALID_COMPARE_ITEM_ERROR };
      }

      const key = lineKey(item.productId, item.variantId);
      if (itemsRef.current.some((existing) => lineKey(existing.productId, existing.variantId) === key)) {
        return { ok: true, changed: false, reason: 'not-found' };
      }

      if (itemsRef.current.length >= resolvedMaxItems) {
        setError(limitMessage);
        return { ok: false, changed: false, reason: 'limit', message: limitMessage };
      }

      commit([...itemsRef.current, item]);
      return { ok: true, changed: true };
    },
    [commit, limitMessage, resolvedMaxItems],
  );

  const removeFromCompare = useCallback(
    (selector: CompareItemSelector, explicitVariantId?: VariantId): CompareMutationResult => {
      const index = findSelectedIndex(itemsRef.current, selector, explicitVariantId);
      if (index === -1) {
        const normalized = normalizeSelector(selector, explicitVariantId);
        if (normalized) {
          const candidates = itemsRef.current.filter((item) => item.productId === normalized.productId);
          if (!normalized.exactVariant && candidates.length > 1 && !candidates.some((item) => item.variantId === null)) {
            setError(AMBIGUOUS_COMPARE_ERROR);
            return { ok: false, changed: false, reason: 'ambiguous', message: AMBIGUOUS_COMPARE_ERROR };
          }
        }
        return { ok: true, changed: false, reason: 'not-found' };
      }

      commit(itemsRef.current.filter((_, itemIndex) => itemIndex !== index));
      return { ok: true, changed: true };
    },
    [commit],
  );

  const clearCompare = useCallback(() => {
    if (itemsRef.current.length === 0) return;
    commit([]);
  }, [commit]);

  const replaceCompare = useCallback(
    (items: readonly CompareItemInput[]): CompareMutationResult => {
      const normalizedItems: CompareItem[] = [];
      const keys = new Set<string>();
      for (const input of items) {
        const item = normalizeInput(input);
        if (!item) {
          setError(INVALID_COMPARE_ITEM_ERROR);
          return { ok: false, changed: false, reason: 'invalid', message: INVALID_COMPARE_ITEM_ERROR };
        }
        const key = lineKey(item.productId, item.variantId);
        if (keys.has(key)) continue;
        keys.add(key);
        normalizedItems.push(item);
      }
      const overLimit = normalizedItems.length > resolvedMaxItems;
      const persisted = commit(normalizedItems);
      if (overLimit && persisted) {
        setError(limitMessage);
      }
      return { ok: true, changed: true, reason: overLimit ? 'limit' : undefined, message: overLimit ? limitMessage : undefined };
    },
    [commit, limitMessage, resolvedMaxItems],
  );

  const isInCompare = useCallback(
    (selector: CompareItemSelector) => {
      if (typeof selector === 'string' || typeof selector === 'number') {
        return itemsRef.current.some((item) => item.productId === selector);
      }
      return findSelectedIndex(itemsRef.current, selector) !== -1;
    },
    [],
  );
  const clearError = useCallback(() => setError(null), []);
  const setSyncPending = useCallback((pending: boolean) => setIsPending(pending), []);
  const setSyncError = useCallback((message: string | null) => setError(message), []);
  const retryHydration = useCallback(() => {
    if (storageWriteFailedRef.current) {
      persist(itemsRef.current);
      return;
    }
    hydrateFromStorage();
  }, [hydrateFromStorage, persist]);
  const isAtLimit = compareItems.length >= resolvedMaxItems;
  const isOverLimit = compareItems.length > resolvedMaxItems;

  const value = useMemo<CompareContextType>(
    () => ({
      compareItems,
      addToCompare,
      removeFromCompare,
      clearCompare,
      replaceCompare,
      isInCompare,
      compareCount: compareItems.length,
      maxItems: resolvedMaxItems,
      maxCompareItems: resolvedMaxItems,
      compareLimit: resolvedMaxItems,
      isAtLimit,
      limitReached: isAtLimit,
      isOverLimit,
      limitMessage,
      isSessionFeature: true,
      isHydrated,
      hydrated: isHydrated,
      hydrationStatus,
      isHydrating: hydrationStatus === 'loading',
      isLoading: !isHydrated,
      loading: !isHydrated,
      isPending,
      pending: isPending,
      error,
      storageError: error,
      setSyncPending,
      setSyncError,
      storageScope,
      retryHydration,
      clearError,
    }),
    [
      addToCompare,
      clearCompare,
      clearError,
      compareItems,
      error,
      hydrationStatus,
      isAtLimit,
      isHydrated,
      isInCompare,
      isOverLimit,
      isPending,
      limitMessage,
      removeFromCompare,
      replaceCompare,
      resolvedMaxItems,
      retryHydration,
      setSyncError,
      setSyncPending,
      storageScope,
    ],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  return useContext(CompareContext);
}

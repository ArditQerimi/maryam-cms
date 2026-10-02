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
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type {
  CommerceHydrationStatus,
  CommerceStorageScope,
  CommerceSyncStatus,
  ProductId,
  VariantId,
} from '@/context/CartContext';

export type { CommerceHydrationStatus, CommerceStorageScope, CommerceSyncStatus, ProductId, VariantId } from '@/context/CartContext';

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

export const COMPARE_LIMIT_MESSAGE = 'Comparison is limited to 4 products. Remove one before adding another.';

function getCompareLimitMessage(maxItems: number): string {
  return `Comparison is limited to ${maxItems} products. Remove one before adding another.`;
}

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

/** Server comparison rows are product-level positive integer IDs. */
function numericProductId(id: ProductId): number | null {
  if (typeof id === 'number') {
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
  const trimmed = id.trim();
  return /^\d+$/.test(trimmed) ? numericProductId(Number(trimmed)) : null;
}

type ServerCompareCommand =
  | { kind: 'add'; productId: number }
  | { kind: 'remove'; productId: number }
  | { kind: 'clear' }
  | { kind: 'import'; productIds: number[] }
  | { kind: 'replace'; productIds: number[] };

const COMPARE_ENDPOINT = '/api/storefront/compare';

async function compareFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  return fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    mode: 'same-origin',
    redirect: 'error',
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });
}

/**
 * Maps a server `{ compare: { items } }` snapshot onto local `CompareItem`s.
 * Display-only extras (rating, old price, category) and a locally chosen
 * variant are preserved from the matching local row so adopting the server
 * set never degrades what the shopper already sees.
 */
function mapServerCompareSnapshot(
  payload: unknown,
  localItems: readonly CompareItem[],
): CompareItem[] | null {
  if (!isRecord(payload)) return null;
  const list: unknown = isRecord(payload.compare) && Array.isArray(payload.compare.items)
    ? payload.compare.items
    : Array.isArray(payload.items)
      ? payload.items
      : null;
  if (!Array.isArray(list)) return null;

  const localByProduct = new Map<number, CompareItem>();
  for (const item of localItems) {
    const id = numericProductId(item.productId);
    if (id !== null && !localByProduct.has(id)) localByProduct.set(id, item);
  }

  const mapped: CompareItem[] = [];
  const seen = new Set<number>();
  for (const raw of list) {
    if (!isRecord(raw)) continue;
    const rawId = raw.productId;
    if (typeof rawId !== 'number' && typeof rawId !== 'string') continue;
    const productId = numericProductId(rawId);
    if (productId === null || seen.has(productId)) continue;
    const local = localByProduct.get(productId) ?? null;
    const product = isRecord(raw.product) ? raw.product : null;
    if (!product) {
      if (local) mapped.push(local);
      continue;
    }
    const rawName = product.name;
    const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : local?.name;
    if (!name) continue;
    const rawPrice = product.price;
    const parsedPrice = typeof rawPrice === 'number'
      ? rawPrice
      : typeof rawPrice === 'string' && rawPrice.trim()
        ? Number(rawPrice)
        : Number.NaN;
    const price = Number.isFinite(parsedPrice) && parsedPrice >= 0
      ? parsedPrice
      : local?.price ?? 0;
    const stock = typeof product.stockQuantity === 'number'
      ? product.stockQuantity
      : local?.stockQuantity ?? 0;
    const rawDescription = product.description;
    seen.add(productId);
    mapped.push(makeCompareItem(
      productId,
      local?.variantId ?? null,
      name,
      price,
      typeof product.imageUrl === 'string' ? product.imageUrl : local?.imageUrl ?? '',
      stock,
      typeof rawDescription === 'string' && rawDescription.trim()
        ? rawDescription
        : local?.description ?? '',
      (typeof product.sku === 'string' && product.sku) || local?.sku || undefined,
      local?.oldPrice,
      local?.rating,
      local?.categoryName,
    ));
  }
  return mapped;
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
  /** Signed-in account synchronization (compare_items table). */
  syncStatus: CommerceSyncStatus;
  serverError: string | null;
  /** Integration hooks for external adapters. */
  setSyncPending: (pending: boolean) => void;
  setSyncError: (message: string | null) => void;
  storageScope: CommerceStorageScope;
  retryHydration: () => void;
  retrySync: () => void;
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
  syncStatus: 'local-only',
  serverError: null,
  retryHydration: () => {},
  retrySync: () => {},
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
  customerSession = true,
}: {
  children: ReactNode;
  maxItems?: number;
  /** False for signed-out shoppers: the list stays local, no 401 probe. */
  customerSession?: boolean;
}) {
  const resolvedMaxItems = Number.isInteger(maxItems) && maxItems > 0 ? maxItems : DEFAULT_COMPARE_LIMIT;
  const { t } = useLocale();
  const limitMessage = t('tools.compare.limit_message', { max: resolvedMaxItems });
  const invalidCompareError = t('tools.compare.error_invalid');
  const ambiguousCompareError = t('tools.compare.error_ambiguous');
  const storageWriteError = t('tools.compare.storage_write_error');
  const compareReadError = t('tools.compare.storage_read_error');
  const syncSaveError = t('tools.compare.sync_save_error');
  const syncLoadError = t('tools.compare.sync_load_error');
  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydrationStatus, setHydrationStatus] = useState<CommerceHydrationStatus>('loading');
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageScope, setStorageScope] = useState<CommerceStorageScope>('session');
  const [syncStatus, setSyncStatus] = useState<CommerceSyncStatus>('local-only');
  const [serverError, setServerError] = useState<string | null>(null);

  const itemsRef = useRef<CompareItem[]>([]);
  const hydratedRef = useRef(false);
  const deferredItemsRef = useRef<CompareItem[] | null>(null);
  const storageWriteFailedRef = useRef(false);
  const serverModeRef = useRef<'unknown' | 'guest' | 'customer'>('unknown');
  const serverProbedRef = useRef(false);
  const initialImportDoneRef = useRef(false);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingServerOpsRef = useRef<Map<number, 'add' | 'remove'>>(new Map());
  const [probeNonce, setProbeNonce] = useState(0);
  const [probedAsCustomer, setProbedAsCustomer] = useState(customerSession);
  if (customerSession !== probedAsCustomer) {
    // Adjust during render (no effect): a fresh sign-in re-runs the probe.
    setProbedAsCustomer(customerSession);
    if (customerSession) setProbeNonce((value) => value + 1);
  }

  const persist = useCallback((next: CompareItem[]): boolean => {
    if (!hydratedRef.current) return false;
    setIsPending(true);
    const storage = getSessionStorage();
    if (!storage) {
      storageWriteFailedRef.current = true;
      setStorageScope('memory');
      setError(storageWriteError);
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
      setError(storageWriteError);
      return false;
    } finally {
      setIsPending(false);
    }
  }, [storageWriteError]);

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
      nextError = compareReadError;
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
  }, [compareReadError, persist, resolvedMaxItems]);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  /**
   * Keeps a local item that has a command in flight (an add the server has
   * not processed yet, or a remove it has not confirmed) so adopting a
   * server snapshot never flickers the list backwards between commands.
   */
  const applyServerRetention = useCallback((serverItems: CompareItem[]): CompareItem[] => {
    const pending = pendingServerOpsRef.current;
    if (pending.size === 0) return serverItems;
    const kept = serverItems.filter((item) => {
      const id = numericProductId(item.productId);
      return !(id !== null && pending.get(id) === 'remove');
    });
    const present = new Set(kept.map((item) => numericProductId(item.productId)));
    for (const [id, kind] of pending) {
      if (kind !== 'add' || present.has(id)) continue;
      const local = itemsRef.current.find((item) => numericProductId(item.productId) === id);
      if (local) kept.unshift(local);
    }
    return kept;
  }, []);

  const adoptServerSnapshot = useCallback((payload: unknown): boolean => {
    const mapped = mapServerCompareSnapshot(payload, itemsRef.current);
    if (!mapped) return false;
    commit(applyServerRetention(mapped));
    return true;
  }, [applyServerRetention, commit]);

  const enqueueServerSync = useCallback(
    (command: ServerCompareCommand) => {
      if (serverModeRef.current !== 'customer') return;

      if (command.kind === 'add' || command.kind === 'remove') {
        pendingServerOpsRef.current.set(command.productId, command.kind);
      } else if (command.kind === 'import' || command.kind === 'replace') {
        for (const productId of command.productIds) {
          pendingServerOpsRef.current.set(productId, 'add');
        }
      }

      const clearPending = () => {
        if (command.kind === 'add' || command.kind === 'remove') {
          pendingServerOpsRef.current.delete(command.productId);
        } else if (command.kind === 'import' || command.kind === 'replace') {
          for (const productId of command.productIds) {
            pendingServerOpsRef.current.delete(productId);
          }
        }
      };

      setSyncStatus('syncing');
      syncQueueRef.current = syncQueueRef.current.then(async () => {
        if (serverModeRef.current !== 'customer') {
          clearPending();
          return;
        }
        try {
          let response: Response;
          if (command.kind === 'add') {
            response = await compareFetch(COMPARE_ENDPOINT, {
              method: 'POST',
              body: JSON.stringify({ action: 'add', productId: command.productId }),
            });
          } else if (command.kind === 'remove') {
            response = await compareFetch(
              `${COMPARE_ENDPOINT}/items/${encodeURIComponent(String(command.productId))}`,
              { method: 'DELETE' },
            );
          } else if (command.kind === 'clear') {
            response = await compareFetch(COMPARE_ENDPOINT, {
              method: 'POST',
              body: JSON.stringify({ action: 'clear' }),
            });
          } else if (command.kind === 'import') {
            response = await compareFetch(`${COMPARE_ENDPOINT}/import`, {
              method: 'POST',
              body: JSON.stringify({ productIds: command.productIds }),
            });
          } else {
            const clearResponse = await compareFetch(COMPARE_ENDPOINT, {
              method: 'POST',
              body: JSON.stringify({ action: 'clear' }),
            });
            if (clearResponse.status === 401) {
              clearPending();
              serverModeRef.current = 'guest';
              setSyncStatus('local-only');
              return;
            }
            if (!clearResponse.ok) throw new Error(`compare-clear-failed:${clearResponse.status}`);
            response = await compareFetch(`${COMPARE_ENDPOINT}/import`, {
              method: 'POST',
              body: JSON.stringify({ productIds: command.productIds }),
            });
          }

          if (response.status === 401) {
            clearPending();
            serverModeRef.current = 'guest';
            setSyncStatus('local-only');
            return;
          }
          if (!response.ok) throw new Error(`compare-sync-failed:${response.status}`);

          const payload: unknown = await response.json().catch(() => null);
          clearPending();
          adoptServerSnapshot(payload);
          setSyncStatus('synced');
          setServerError(null);
        } catch {
          clearPending();
          setSyncStatus('error');
          setServerError(syncSaveError);
        }
      });
    },
    [adoptServerSnapshot, syncSaveError],
  );

  // Probe the account comparison once after hydration: guests stay local,
  // customers merge their browser list into the account list and adopt the
  // resulting snapshot.
  useEffect(() => {
    if (!isHydrated || serverProbedRef.current) return;
    if (!customerSession) {
      // Signed out: stay local and don't mark the probe done, so signing in
      // later runs the real account probe.
      serverModeRef.current = 'guest';
      return;
    }
    serverProbedRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const response = await compareFetch(COMPARE_ENDPOINT);
        if (cancelled) return;
        if (response.status === 401) {
          serverModeRef.current = 'guest';
          setSyncStatus('local-only');
          return;
        }
        if (!response.ok) throw new Error(`compare-probe-failed:${response.status}`);
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled) return;
        serverModeRef.current = 'customer';

        const localIds: number[] = [];
        const seen = new Set<number>();
        for (const item of itemsRef.current) {
          const id = numericProductId(item.productId);
          if (id !== null && !seen.has(id)) {
            seen.add(id);
            localIds.push(id);
          }
        }

        if (localIds.length > 0 && !initialImportDoneRef.current) {
          initialImportDoneRef.current = true;
          enqueueServerSync({ kind: 'import', productIds: localIds });
          return;
        }
        adoptServerSnapshot(payload);
        setSyncStatus('synced');
        setServerError(null);
      } catch {
        if (cancelled) return;
        setSyncStatus('error');
        setServerError(syncLoadError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, probeNonce, customerSession, adoptServerSnapshot, enqueueServerSync, syncLoadError]);

  const addToCompare = useCallback(
    (input: CompareItemInput): CompareMutationResult => {
      const item = normalizeInput(input);
      if (!item) {
        setError(invalidCompareError);
        return { ok: false, changed: false, reason: 'invalid', message: invalidCompareError };
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
      const numericId = numericProductId(item.productId);
      if (numericId !== null) enqueueServerSync({ kind: 'add', productId: numericId });
      return { ok: true, changed: true };
    },
    [commit, enqueueServerSync, invalidCompareError, limitMessage, resolvedMaxItems],
  );

  const removeFromCompare = useCallback(
    (selector: CompareItemSelector, explicitVariantId?: VariantId): CompareMutationResult => {
      const index = findSelectedIndex(itemsRef.current, selector, explicitVariantId);
      if (index === -1) {
        const normalized = normalizeSelector(selector, explicitVariantId);
        if (normalized) {
          const candidates = itemsRef.current.filter((item) => item.productId === normalized.productId);
          if (!normalized.exactVariant && candidates.length > 1 && !candidates.some((item) => item.variantId === null)) {
            setError(ambiguousCompareError);
            return { ok: false, changed: false, reason: 'ambiguous', message: ambiguousCompareError };
          }
        }
        return { ok: true, changed: false, reason: 'not-found' };
      }

      const [removedItem] = itemsRef.current.slice(index, index + 1);
      commit(itemsRef.current.filter((_, itemIndex) => itemIndex !== index));
      const removedId = removedItem ? numericProductId(removedItem.productId) : null;
      if (removedId !== null) enqueueServerSync({ kind: 'remove', productId: removedId });
      return { ok: true, changed: true };
    },
    [ambiguousCompareError, commit, enqueueServerSync],
  );

  const clearCompare = useCallback(() => {
    if (itemsRef.current.length === 0) return;
    commit([]);
    enqueueServerSync({ kind: 'clear' });
  }, [commit, enqueueServerSync]);

  const replaceCompare = useCallback(
    (items: readonly CompareItemInput[]): CompareMutationResult => {
      const normalizedItems: CompareItem[] = [];
      const keys = new Set<string>();
      for (const input of items) {
        const item = normalizeInput(input);
        if (!item) {
          setError(invalidCompareError);
          return { ok: false, changed: false, reason: 'invalid', message: invalidCompareError };
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
      const numericIds = normalizedItems
        .map((item) => numericProductId(item.productId))
        .filter((productId): productId is number => productId !== null);
      if (numericIds.length > 0) {
        enqueueServerSync({ kind: 'replace', productIds: numericIds });
      } else {
        enqueueServerSync({ kind: 'clear' });
      }
      return { ok: true, changed: true, reason: overLimit ? 'limit' : undefined, message: overLimit ? limitMessage : undefined };
    },
    [commit, enqueueServerSync, invalidCompareError, limitMessage, resolvedMaxItems],
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
  const setSyncError = useCallback((message: string | null) => {
    setServerError(message);
    setError(message);
  }, []);
  const retrySync = useCallback(() => {
    serverProbedRef.current = false;
    setServerError(null);
    setSyncStatus(serverModeRef.current === 'customer' ? 'syncing' : 'local-only');
    setProbeNonce((nonce) => nonce + 1);
  }, []);
  const retryHydration = useCallback(() => {
    if (serverError || syncStatus === 'error') {
      retrySync();
      return;
    }
    if (storageWriteFailedRef.current) {
      persist(itemsRef.current);
      return;
    }
    hydrateFromStorage();
  }, [hydrateFromStorage, persist, retrySync, serverError, syncStatus]);
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
      syncStatus,
      serverError,
      setSyncPending,
      setSyncError,
      storageScope,
      retryHydration,
      retrySync,
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
      retrySync,
      serverError,
      setSyncError,
      setSyncPending,
      storageScope,
      syncStatus,
    ],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  return useContext(CompareContext);
}

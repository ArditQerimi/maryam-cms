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
import {
  isStorefrontAuthenticationError,
  isStorefrontClientError,
  mapWishlistResponse,
  storefrontWishlistApi,
  type StorefrontWishlistRow,
} from '@/lib/storefront/client/commerce-api';

export type { CommerceHydrationStatus, CommerceStorageScope, CommerceSyncStatus, ProductId, VariantId } from '@/context/CartContext';

export const WISHLIST_STORAGE_KEY = 'noor_wishlist';
export const WISHLIST_SERVER_MIGRATION_KEY = 'noor_wishlist_server_migration_v1';

export type WishlistItem = {
  productId: ProductId;
  variantId: VariantId;
  name: string;
  price: number;
  imageUrl: string;
  stockQuantity: number;
  addedAt: string;
  priceAvailable?: boolean;
  available?: boolean;
  /** @deprecated Use productId. */
  id: ProductId;
};

export type WishlistItemInput = {
  productId?: ProductId;
  variantId?: VariantId;
  /** @deprecated Use productId. */
  id?: ProductId;
  name: string;
  price: number;
  imageUrl: string;
  stockQuantity: number;
  addedAt?: string;
  priceAvailable?: boolean;
  available?: boolean;
};

export type WishlistItemSelector =
  | ProductId
  | { productId: ProductId; variantId?: VariantId }
  | { id: ProductId; variantId?: VariantId };

type WishlistCommand =
  | { kind: 'add'; productId: number; revision: number }
  | { kind: 'remove'; productId: number; revision: number }
  | { kind: 'clear'; revision: number }
  | { kind: 'import'; productIds: number[]; revision: number };

type WishlistMigrationMarker = {
  version: 1;
  state: 'claimed' | 'complete';
  fingerprint: string;
};

export type WishlistMutationResult = {
  ok: boolean;
  changed: boolean;
  reason?: 'invalid' | 'ambiguous' | 'not-found' | 'sync';
  message?: string;
};

type RecordValue = Record<string, unknown>;

type StoredListResult = {
  items: WishlistItem[];
  hadInvalidEntries: boolean;
};

type StorageReadResult = StoredListResult & {
  raw: string | null;
  available: boolean;
  readError: boolean;
};

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

function parseAddedAt(value: unknown): { valid: boolean; value: string } {
  if (value === undefined || value === null || value === '') return { valid: true, value: '' };
  if (typeof value !== 'string') return { valid: false, value: '' };
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? { valid: false, value: '' } : { valid: true, value };
}

function makeWishlistItem(
  productId: ProductId,
  variantId: VariantId,
  name: string,
  price: number,
  imageUrl: string,
  stockQuantity: number,
  addedAt: string,
  priceAvailable = true,
  available?: boolean,
): WishlistItem {
  return {
    productId,
    variantId,
    name,
    price,
    imageUrl,
    stockQuantity,
    addedAt,
    priceAvailable,
    available,
    id: productId,
  };
}

function normalizeInput(input: WishlistItemInput): { item: Omit<WishlistItem, 'addedAt'>; addedAt: string } | null {
  if (!isRecord(input)) return null;
  const productId = parseProductId(input);
  if (productId === null) return null;

  const variant = parseVariantId(input.variantId);
  if (!variant.valid) return null;

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const price = parsePrice(input.price);
  const stock = parseStock(input.stockQuantity);
  const imageUrl = input.imageUrl === undefined || input.imageUrl === null ? '' : input.imageUrl;
  if (!name || price === null || !stock.valid || typeof imageUrl !== 'string') return null;

  const addedAt = parseAddedAt(input.addedAt);
  if (!addedAt.valid) return null;

  return {
    item: {
      productId,
      variantId: variant.value,
      name,
      price,
      imageUrl,
      stockQuantity: stock.value,
      priceAvailable: input.priceAvailable !== false,
      available: typeof input.available === 'boolean' ? input.available : undefined,
      id: productId,
    },
    addedAt: addedAt.value || new Date().toISOString(),
  };
}

function lineKey(productId: ProductId, variantId: VariantId): string {
  return JSON.stringify([
    typeof productId,
    productId,
    typeof variantId,
    variantId,
  ]);
}

function normalizeStoredList(value: unknown): StoredListResult {
  if (!Array.isArray(value)) return { items: [], hadInvalidEntries: true };

  const items: WishlistItem[] = [];
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
    const addedAt = parseAddedAt(rawItem.addedAt);
    if (!name || price === null || !stock.valid || typeof imageUrl !== 'string' || !addedAt.valid) {
      hadInvalidEntries = true;
      continue;
    }

    const key = lineKey(productId, variant.value);
    if (keys.has(key)) {
      // Duplicate saved rows are harmless; keep the first row and do not reorder it.
      continue;
    }
    keys.add(key);
    items.push(
      makeWishlistItem(
        productId,
        variant.value,
        name,
        price,
        imageUrl,
        stock.value,
        addedAt.value,
        rawItem.priceAvailable !== false,
        typeof rawItem.available === 'boolean' ? rawItem.available : undefined,
      ),
    );
  }

  return { items, hadInvalidEntries };
}

function serializeWishlistItems(items: readonly WishlistItem[]) {
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    name: item.name,
    price: item.price,
    imageUrl: item.imageUrl,
    stockQuantity: item.stockQuantity,
    addedAt: item.addedAt,
    priceAvailable: item.priceAvailable,
    available: item.available,
  }));
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readWishlistStorage(): StorageReadResult {
  const storage = getLocalStorage();
  if (!storage) {
    return { items: [], raw: null, available: false, readError: true, hadInvalidEntries: false };
  }

  try {
    const raw = storage.getItem(WISHLIST_STORAGE_KEY);
    if (raw === null) {
      return { items: [], raw: null, available: true, readError: false, hadInvalidEntries: false };
    }
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeStoredList(parsed);
    return { ...normalized, raw, available: true, readError: false };
  } catch {
    return { items: [], raw: null, available: false, readError: true, hadInvalidEntries: true };
  }
}

type WishlistContextType = {
  wishlist: WishlistItem[];
  addToWishlist: (item: WishlistItemInput) => WishlistMutationResult;
  removeFromWishlist: (selector: WishlistItemSelector, variantId?: VariantId) => WishlistMutationResult;
  clearWishlist: () => void;
  isInWishlist: (selector: WishlistItemSelector) => boolean;
  replaceWishlist: (items: readonly WishlistItemInput[]) => WishlistMutationResult;
  wishlistCount: number;
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
  /** Optional integration hooks for callers that coordinate additional sync work. */
  setSyncPending: (pending: boolean) => void;
  setSyncError: (message: string | null) => void;
  storageScope: CommerceStorageScope;
  syncStatus: CommerceSyncStatus;
  isServerSynced: boolean;
  isLocalOnly: boolean;
  serverAuthenticated: boolean;
  serverError: string | null;
  hasLocalDraft: boolean;
  refreshFromServer: () => void;
  retrySync: () => void;
  retryHydration: () => void;
  clearError: () => void;
};

const defaultWishlistContext: WishlistContextType = {
  wishlist: [],
  addToWishlist: () => ({ ok: true, changed: false }),
  removeFromWishlist: () => ({ ok: true, changed: false }),
  clearWishlist: () => {},
  isInWishlist: () => false,
  replaceWishlist: () => ({ ok: true, changed: false }),
  wishlistCount: 0,
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
  isServerSynced: false,
  isLocalOnly: true,
  serverAuthenticated: false,
  serverError: null,
  hasLocalDraft: false,
  refreshFromServer: () => {},
  retrySync: () => {},
  retryHydration: () => {},
  clearError: () => {},
};

const WishlistContext = createContext<WishlistContextType>(defaultWishlistContext);

function normalizeSelector(
  selector: WishlistItemSelector,
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

function findSelectedIndex(items: readonly WishlistItem[], selector: WishlistItemSelector, explicitVariantId?: VariantId): number {
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

function readWishlistMigrationMarker(): WishlistMigrationMarker | null {
  const local = getLocalStorage();
  const session = typeof window === 'undefined' ? null : (() => {
    try { return window.sessionStorage; } catch { return null; }
  })();
  for (const storage of [local, session]) {
    if (!storage) continue;
    try {
      const raw = storage.getItem(WISHLIST_SERVER_MIGRATION_KEY);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || parsed.version !== 1 || (parsed.state !== 'claimed' && parsed.state !== 'complete') || typeof parsed.fingerprint !== 'string') continue;
      return { version: 1, state: parsed.state, fingerprint: parsed.fingerprint };
    } catch {
      // Try the fallback storage area without changing malformed data.
    }
  }
  return null;
}

function writeWishlistMigrationMarker(marker: WishlistMigrationMarker): boolean {
  const storages = [getLocalStorage(), typeof window === 'undefined' ? null : (() => {
    try { return window.sessionStorage; } catch { return null; }
  })()];
  let wrote = false;
  for (const storage of storages) {
    if (!storage) continue;
    try {
      storage.setItem(WISHLIST_SERVER_MIGRATION_KEY, JSON.stringify(marker));
      wrote = true;
    } catch {
      // Try the fallback storage area.
    }
  }
  return wrote;
}

function wishlistFingerprint(items: readonly WishlistItem[]): string {
  return JSON.stringify([...items].map((item) => [String(item.productId)]).sort());
}

function wishlistItemFromServer(row: StorefrontWishlistRow): WishlistItem {
  return makeWishlistItem(
    row.productId,
    row.variantId,
    row.name,
    row.price,
    row.imageUrl,
    row.stockQuantity,
    row.addedAt,
    row.priceAvailable,
    row.available,
  );
}

function mergeWishlistServerMetadata(localItems: readonly WishlistItem[], serverItems: readonly WishlistItem[]): WishlistItem[] {
  const serverByProduct = new Map(serverItems.map((item) => [String(item.productId), item]));
  return localItems.map((item) => {
    const serverItem = serverByProduct.get(String(item.productId));
    if (!serverItem) return item;
    return {
      ...item,
      productId: serverItem.productId,
      variantId: null,
      name: serverItem.name,
      price: serverItem.price,
      imageUrl: serverItem.imageUrl,
      stockQuantity: serverItem.stockQuantity,
      addedAt: serverItem.addedAt,
      priceAvailable: serverItem.priceAvailable,
      available: serverItem.available,
      id: serverItem.productId,
    };
  });
}

function toWishlistServerId(value: ProductId): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function wishlistErrorText(error: unknown, fallback: string): string {
  return isStorefrontClientError(error) && error.message.trim() ? error.message : fallback;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const wishlistReadError = t('tools.wishlist.storage_read_error');
  const wishlistWriteError = t('tools.wishlist.storage_write_error');
  const invalidWishlistError = t('tools.wishlist.error_invalid');
  const ambiguousWishlistError = t('tools.wishlist.error_ambiguous');
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydrationStatus, setHydrationStatus] = useState<CommerceHydrationStatus>('loading');
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageScope, setStorageScope] = useState<CommerceStorageScope>('local');
  const [syncStatus, setSyncStatus] = useState<CommerceSyncStatus>('local-only');
  const [serverAuthenticated, setServerAuthenticated] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const itemsRef = useRef<WishlistItem[]>([]);
  const hydratedRef = useRef(false);
  const deferredItemsRef = useRef<WishlistItem[] | null>(null);
  const storageWriteFailedRef = useRef(false);
  const storageProtectedRef = useRef(false);
  const storageWarningRef = useRef<string | null>(null);
  const serverWishlistRef = useRef<WishlistItem[]>([]);
  const serverAuthenticatedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const serverInitPromiseRef = useRef<Promise<void> | null>(null);
  const serverSyncInFlightRef = useRef(false);
  const serverRefreshAbortRef = useRef<AbortController | null>(null);
  const commandQueueRef = useRef<WishlistCommand[]>([]);
  const commandProcessingRef = useRef(false);
  const failedCommandRef = useRef<WishlistCommand | null>(null);
  const localRevisionRef = useRef(0);
  const syncCountRef = useRef(0);
  const externalPendingRef = useRef(false);
  const migrationMarkerRef = useRef<WishlistMigrationMarker | null>(null);

  const updatePending = useCallback(() => {
    setIsPending(syncCountRef.current > 0 || externalPendingRef.current || !hydratedRef.current);
  }, []);

  const beginSync = useCallback(() => {
    syncCountRef.current += 1;
    updatePending();
  }, [updatePending]);

  const endSync = useCallback(() => {
    syncCountRef.current = Math.max(0, syncCountRef.current - 1);
    updatePending();
  }, [updatePending]);

  const persist = useCallback((next: WishlistItem[], force = false): boolean => {
    if (!hydratedRef.current) return false;
    if (storageProtectedRef.current && !force) return true;
    const storage = getLocalStorage();
    if (!storage) {
      storageWriteFailedRef.current = true;
      setStorageScope('memory');
      setError(wishlistWriteError);
      return false;
    }

    try {
      storage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(serializeWishlistItems(next)));
      storageWriteFailedRef.current = false;
      if (force) {
        storageProtectedRef.current = false;
        storageWarningRef.current = null;
      }
      setStorageScope('local');
      setError((current) => current === wishlistWriteError ? null : current);
      return true;
    } catch {
      storageWriteFailedRef.current = true;
      setStorageScope('memory');
      setError(wishlistWriteError);
      return false;
    }
  }, [wishlistWriteError]);

  const commit = useCallback(
    (next: WishlistItem[]): boolean => {
      itemsRef.current = next;
      setWishlist(next);
      if (!hydratedRef.current) {
        deferredItemsRef.current = next;
        return false;
      }
      return persist(next);
    },
    [persist],
  );

  const prepareLocalMutation = useCallback(() => {
    storageProtectedRef.current = false;
    storageWarningRef.current = null;
  }, []);

  const hydrateFromStorage = useCallback(() => {
    setHydrationStatus('loading');
    setIsHydrated(false);
    setError(null);
    beginSync();
    migrationMarkerRef.current = readWishlistMigrationMarker();

    const result = readWishlistStorage();
    storageWriteFailedRef.current = false;
    const deferred = deferredItemsRef.current;
    let nextItems = result.items;
    let nextError: string | null = null;
    let nextScope: CommerceStorageScope = result.available ? 'local' : 'memory';

    if (result.readError) {
      nextError = wishlistReadError;
      nextScope = 'unavailable';
    } else if (result.hadInvalidEntries) {
      nextError = 'Some saved wishlist data was malformed. Valid items are shown, and the saved data was left unchanged.';
    }

    if (deferred) {
      nextItems = deferred;
      deferredItemsRef.current = null;
    } else if (result.raw === null && itemsRef.current.length > 0) {
      nextItems = itemsRef.current;
      nextScope = 'memory';
    }

    storageProtectedRef.current = Boolean(nextError);
    storageWarningRef.current = nextError;
    if (deferred) {
      storageProtectedRef.current = false;
      storageWarningRef.current = null;
    }
    itemsRef.current = nextItems;
    hydratedRef.current = true;
    setWishlist(nextItems);
    setStorageScope(nextScope);
    setError(nextError);
    setIsHydrated(true);
    setHydrationStatus(nextError ? 'error' : 'ready');
    if (!nextError) setSyncStatus('local-only');
    endSync();

    if (deferred) persist(nextItems);
  }, [beginSync, endSync, persist, wishlistReadError]);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  const applyServerItems = useCallback((
    authoritativeItems: readonly WishlistItem[],
    revision: number,
    preserveLocalDraft = false,
  ) => {
    serverWishlistRef.current = [...authoritativeItems];
    serverAuthenticatedRef.current = true;
    serverReadyRef.current = true;
    setServerAuthenticated(true);
    const shouldReplaceLocal = !preserveLocalDraft && localRevisionRef.current === revision;
    const nextItems = shouldReplaceLocal
      ? [...authoritativeItems]
      : mergeWishlistServerMetadata(itemsRef.current, authoritativeItems);
    itemsRef.current = nextItems;
    setWishlist(nextItems);
    setServerError(null);
    setSyncStatus('synced');
    setError(storageProtectedRef.current ? storageWarningRef.current : null);
    persist(nextItems);
    if (!preserveLocalDraft) {
      const markerSaved = writeWishlistMigrationMarker({
        version: 1,
        state: 'complete',
        fingerprint: wishlistFingerprint(authoritativeItems),
      });
      if (!markerSaved) {
        const message = 'The server wishlist is synced, but this browser could not record migration completion. It will be checked safely before the next import.';
        setServerError(message);
        setSyncStatus('error');
        setError(message);
      }
    }
  }, [persist]);

  const executeWishlistCommand = useCallback(async (command: WishlistCommand) => {
    if (command.kind === 'import') {
      const response = await storefrontWishlistApi.import(command.productIds);
      return mapWishlistResponse(response).items;
    }
    if (command.kind === 'clear') {
      const response = await storefrontWishlistApi.clear();
      return mapWishlistResponse(response).items;
    }
    if (command.kind === 'add') {
      const response = await storefrontWishlistApi.add(command.productId);
      return mapWishlistResponse(response).items;
    }
    const response = await storefrontWishlistApi.remove(command.productId);
    return mapWishlistResponse(response).items;
  }, []);

  const processCommandQueue = useCallback(async () => {
    if (commandProcessingRef.current) return;
    commandProcessingRef.current = true;
    try {
      while (commandQueueRef.current.length > 0 && !failedCommandRef.current) {
        const command = commandQueueRef.current[0];
        if (!serverInitPromiseRef.current) return;
        beginSync();
        try {
          await serverInitPromiseRef.current;
          if (!serverReadyRef.current || !serverAuthenticatedRef.current) {
            throw new Error('The server wishlist is not ready. Your local draft is safe.');
          }
          const authoritative = await executeWishlistCommand(command);
          applyServerItems(authoritative.map(wishlistItemFromServer), command.revision);
          commandQueueRef.current.shift();
        } catch (error) {
          if (isStorefrontClientError(error) && error.status === 404 && command.kind === 'remove') {
            try {
              const current = mapWishlistResponse(await storefrontWishlistApi.get());
              applyServerItems(current.items.map(wishlistItemFromServer), command.revision);
              commandQueueRef.current.shift();
              continue;
            } catch (refreshError) {
              error = refreshError;
            }
          }
          failedCommandRef.current = command;
          const message = wishlistErrorText(error, 'The wishlist could not be synced. Your local draft is safe.');
          setServerError(message);
          setSyncStatus(isStorefrontAuthenticationError(error) ? 'local-only' : 'error');
          setError(message);
          if (isStorefrontAuthenticationError(error)) {
            serverReadyRef.current = false;
            serverAuthenticatedRef.current = false;
            setServerAuthenticated(false);
          }
          break;
        } finally {
          endSync();
        }
      }
    } finally {
      commandProcessingRef.current = false;
    }
  }, [applyServerItems, beginSync, endSync, executeWishlistCommand]);

  const enqueueWishlistCommand = useCallback((command: WishlistCommand) => {
    if (!serverAuthenticatedRef.current) return;
    if (command.kind === 'add' || command.kind === 'remove') {
      if (!Number.isSafeInteger(command.productId) || command.productId < 1) {
        const message = 'This wishlist product needs a valid server product ID before it can sync.';
        setServerError(message);
        setSyncStatus('error');
        setError(message);
        return;
      }
    }
    commandQueueRef.current.push(command);
    if (failedCommandRef.current) {
      setSyncStatus('error');
      return;
    }
    setServerError(null);
    setSyncStatus('syncing');
    void processCommandQueue();
  }, [processCommandQueue]);

  const addToWishlist = useCallback(
    (input: WishlistItemInput): WishlistMutationResult => {
      const normalized = normalizeInput(input);
      if (!normalized) {
        setError(invalidWishlistError);
        return { ok: false, changed: false, reason: 'invalid', message: invalidWishlistError };
      }

      const item = makeWishlistItem(
        normalized.item.productId,
        normalized.item.variantId,
        normalized.item.name,
        normalized.item.price,
        normalized.item.imageUrl,
        normalized.item.stockQuantity,
        normalized.addedAt,
        normalized.item.priceAvailable,
        normalized.item.available,
      );
      const key = lineKey(item.productId, item.variantId);
      const alreadyPresent = serverAuthenticatedRef.current
        ? itemsRef.current.some((existing) => String(existing.productId) === String(item.productId))
        : itemsRef.current.some((existing) => lineKey(existing.productId, existing.variantId) === key);
      if (alreadyPresent) {
        // Idempotent: a repeated add must not create a duplicate or reorder the list.
        return { ok: true, changed: false, reason: 'not-found' };
      }

      const revision = localRevisionRef.current + 1;
      localRevisionRef.current = revision;
      prepareLocalMutation();
      commit([...itemsRef.current, item]);
      const serverProductId = toWishlistServerId(item.productId);
      if (serverProductId !== null) {
        enqueueWishlistCommand({ kind: 'add', productId: serverProductId, revision });
      }
      return { ok: true, changed: true };
    },
    [ambiguousWishlistError, commit, enqueueWishlistCommand, invalidWishlistError, prepareLocalMutation],
  );

  const removeFromWishlist = useCallback(
    (selector: WishlistItemSelector, explicitVariantId?: VariantId): WishlistMutationResult => {
      const normalizedSelector = normalizeSelector(selector, explicitVariantId);
      const index = serverAuthenticatedRef.current && normalizedSelector
        ? itemsRef.current.findIndex((item) => String(item.productId) === String(normalizedSelector.productId))
        : findSelectedIndex(itemsRef.current, selector, explicitVariantId);
      if (index === -1) {
        const normalized = normalizeSelector(selector, explicitVariantId);
        if (normalized) {
          const candidates = itemsRef.current.filter((item) => item.productId === normalized.productId);
          if (!normalized.exactVariant && candidates.length > 1 && !candidates.some((item) => item.variantId === null)) {
            setError(ambiguousWishlistError);
            return { ok: false, changed: false, reason: 'ambiguous', message: ambiguousWishlistError };
          }
        }
        // Removing an item that is already absent is intentionally a no-op.
        return { ok: true, changed: false, reason: 'not-found' };
      }

      const selected = itemsRef.current[index];
      const revision = localRevisionRef.current + 1;
      localRevisionRef.current = revision;
      prepareLocalMutation();
      commit(itemsRef.current.filter((_, itemIndex) => itemIndex !== index));
      const serverProductId = toWishlistServerId(selected.productId);
      if (serverProductId !== null) {
        enqueueWishlistCommand({ kind: 'remove', productId: serverProductId, revision });
      }
      return { ok: true, changed: true };
    },
    [ambiguousWishlistError, commit, enqueueWishlistCommand, invalidWishlistError, prepareLocalMutation],
  );

  const clearWishlist = useCallback(() => {
    if (itemsRef.current.length === 0) return;
    const revision = localRevisionRef.current + 1;
    localRevisionRef.current = revision;
    prepareLocalMutation();
    commit([]);
    enqueueWishlistCommand({ kind: 'clear', revision });
  }, [commit, enqueueWishlistCommand, prepareLocalMutation]);

  const isInWishlist = useCallback(
    (selector: WishlistItemSelector) => {
      const normalized = normalizeSelector(selector);
      if (!normalized) return false;
      if (serverAuthenticatedRef.current) {
        return itemsRef.current.some((item) => String(item.productId) === String(normalized.productId));
      }
      return findSelectedIndex(itemsRef.current, selector) !== -1;
    },
    [],
  );

  const replaceWishlist = useCallback(
    (items: readonly WishlistItemInput[]): WishlistMutationResult => {
      const normalizedItems: WishlistItem[] = [];
      const keys = new Set<string>();
      for (const input of items) {
        const normalized = normalizeInput(input);
        if (!normalized) {
          setError(invalidWishlistError);
          return { ok: false, changed: false, reason: 'invalid', message: invalidWishlistError };
        }
        const item = makeWishlistItem(
          normalized.item.productId,
          normalized.item.variantId,
          normalized.item.name,
          normalized.item.price,
          normalized.item.imageUrl,
          normalized.item.stockQuantity,
          normalized.addedAt,
          normalized.item.priceAvailable,
          normalized.item.available,
        );
        const key = lineKey(item.productId, item.variantId);
        if (keys.has(key)) continue;
        keys.add(key);
        normalizedItems.push(item);
      }
      localRevisionRef.current += 1;
      prepareLocalMutation();
      commit(normalizedItems);
      return { ok: true, changed: true };
    },
    [commit, invalidWishlistError, prepareLocalMutation],
  );

  const runServerSync = useCallback(async () => {
    if (typeof window === 'undefined' || serverSyncInFlightRef.current || commandProcessingRef.current) return;
    serverSyncInFlightRef.current = true;
    const controller = new AbortController();
    serverRefreshAbortRef.current = controller;
    beginSync();
    setSyncStatus('syncing');

    try {
      const snapshot = mapWishlistResponse(await storefrontWishlistApi.get(controller.signal));
      const serverItems = snapshot.items.map(wishlistItemFromServer);
      serverWishlistRef.current = serverItems;
      serverAuthenticatedRef.current = true;
      serverReadyRef.current = true;
      setServerAuthenticated(true);

      const localItems = [...itemsRef.current];
      const marker = readWishlistMigrationMarker();
      migrationMarkerRef.current = marker;
      const fingerprint = wishlistFingerprint(localItems);

      if (localItems.length === 0 || (marker?.state === 'complete' && marker.fingerprint === fingerprint && serverItems.length > 0)) {
        applyServerItems(serverItems, localRevisionRef.current);
        return;
      }

      const productIds = Array.from(new Set(localItems.map((item) => toWishlistServerId(item.productId))));
      if (productIds.some((productId) => productId === null)) {
        applyServerItems(serverItems, localRevisionRef.current, true);
        const message = 'A local wishlist item has no valid server product ID yet. It remains a local draft.';
        setServerError(message);
        setSyncStatus('error');
        setError(message);
        return;
      }

      const importCommand: WishlistCommand = {
        kind: 'import',
        productIds: productIds as number[],
        revision: localRevisionRef.current,
      };
      const claimedMarker: WishlistMigrationMarker = { version: 1, state: 'claimed', fingerprint };
      if (!marker || marker.fingerprint !== fingerprint) {
        if (!writeWishlistMigrationMarker(claimedMarker)) {
          const message = 'The local wishlist is ready, but its migration marker could not be saved. Import was not attempted.';
          setServerError(message);
          setSyncStatus('error');
          setError(message);
          return;
        }
        migrationMarkerRef.current = claimedMarker;
      }

      try {
        const authoritative = await executeWishlistCommand(importCommand);
        applyServerItems(authoritative.map(wishlistItemFromServer), importCommand.revision);
        const completeMarker: WishlistMigrationMarker = {
          ...claimedMarker,
          state: 'complete',
          fingerprint: wishlistFingerprint(authoritative.map(wishlistItemFromServer)),
        };
        if (!writeWishlistMigrationMarker(completeMarker)) {
          const message = 'The server wishlist is synced, but migration completion could not be recorded. It will be checked safely before the next import.';
          setServerError(message);
          setSyncStatus('error');
          setError(message);
        } else {
          migrationMarkerRef.current = completeMarker;
        }
      } catch (error) {
        failedCommandRef.current = importCommand;
        const message = wishlistErrorText(error, 'The local wishlist could not be imported. Your local draft is safe; retry when ready.');
        setServerError(message);
        setSyncStatus(isStorefrontAuthenticationError(error) ? 'local-only' : 'error');
        setError(message);
        if (isStorefrontAuthenticationError(error)) {
          serverReadyRef.current = false;
          serverAuthenticatedRef.current = false;
          setServerAuthenticated(false);
        }
      }
    } catch (error) {
      serverReadyRef.current = false;
      serverAuthenticatedRef.current = false;
      setServerAuthenticated(false);
      if (isStorefrontAuthenticationError(error)) {
        serverReadyRef.current = false;
        serverAuthenticatedRef.current = false;
        setServerAuthenticated(false);
        setSyncStatus('local-only');
        setServerError(null);
        setError(storageProtectedRef.current ? storageWarningRef.current : null);
      } else {
        const message = wishlistErrorText(error, 'The server wishlist could not be loaded. Your local draft is safe; retry when ready.');
        setServerError(message);
        setSyncStatus('error');
        setError(message);
      }
    } finally {
      if (serverRefreshAbortRef.current === controller) serverRefreshAbortRef.current = null;
      serverSyncInFlightRef.current = false;
      endSync();
      if (serverReadyRef.current && serverAuthenticatedRef.current) void processCommandQueue();
    }
  }, [applyServerItems, beginSync, endSync, executeWishlistCommand, processCommandQueue]);

  const initializeServer = useCallback(() => {
    if (typeof window === 'undefined') return Promise.resolve();
    if (!serverInitPromiseRef.current) {
      serverInitPromiseRef.current = runServerSync().finally(() => {
        if (serverReadyRef.current && serverAuthenticatedRef.current) void processCommandQueue();
      });
      return serverInitPromiseRef.current;
    }
    if (!serverReadyRef.current || !serverAuthenticatedRef.current) {
      void serverInitPromiseRef.current.then(() => {
        if (!serverReadyRef.current || !serverAuthenticatedRef.current) void runServerSync();
      });
    }
    return serverInitPromiseRef.current;
  }, [processCommandQueue, runServerSync]);

  const refreshFromServer = useCallback(() => {
    void runServerSync();
  }, [runServerSync]);

  const retrySync = useCallback(() => {
    const failed = failedCommandRef.current;
    if (!failed) {
      refreshFromServer();
      return;
    }
    if (failed.kind === 'import') {
      failedCommandRef.current = null;
      void runServerSync();
      return;
    }
    void (async () => {
      failedCommandRef.current = null;
      await runServerSync();
      if (serverReadyRef.current && serverAuthenticatedRef.current) {
        const failedIndex = commandQueueRef.current.indexOf(failed);
        if (failedIndex >= 0) commandQueueRef.current.splice(failedIndex, 1);
        commandQueueRef.current.unshift(failed);
        void processCommandQueue();
      } else {
        failedCommandRef.current = failed;
      }
    })();
  }, [processCommandQueue, refreshFromServer, runServerSync]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;
    void initializeServer();
    return () => {
      serverRefreshAbortRef.current?.abort();
    };
  }, [initializeServer, isHydrated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let focusTimer: number | undefined;
    const refresh = () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        if (hydratedRef.current) void runServerSync();
      }, 150);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== WISHLIST_STORAGE_KEY) return;
      if (serverReadyRef.current && serverAuthenticatedRef.current) {
        const currentSerialized = JSON.stringify(serializeWishlistItems(itemsRef.current));
        if (event.newValue === currentSerialized) return;
        const incoming = readWishlistStorage();
        if (!incoming.readError) {
          storageProtectedRef.current = false;
          storageWarningRef.current = null;
          itemsRef.current = incoming.items;
          localRevisionRef.current += 1;
          setWishlist(incoming.items);
        } else {
          storageProtectedRef.current = true;
          storageWarningRef.current = wishlistReadError;
          setError(wishlistReadError);
        }
        void runServerSync();
        return;
      }
      const result = readWishlistStorage();
      if (result.readError) {
        setError(wishlistReadError);
        return;
      }
      storageProtectedRef.current = false;
      storageWarningRef.current = null;
      itemsRef.current = result.items;
      localRevisionRef.current += 1;
      setWishlist(result.items);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    return () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [isHydrated, runServerSync, wishlistReadError]);

  const clearError = useCallback(() => {
    setServerError(null);
    setError(null);
  }, []);
  const setSyncPending = useCallback((pending: boolean) => {
    externalPendingRef.current = pending;
    updatePending();
  }, [updatePending]);
  const setSyncError = useCallback((message: string | null) => {
    setServerError(message);
    setError(message);
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
  const wishlistCount = useMemo(() => wishlist.length, [wishlist]);
  const hasLocalDraft = useMemo(() => {
    if (!serverReadyRef.current || !serverAuthenticatedRef.current) return wishlist.length > 0;
    return wishlistFingerprint(wishlist) !== wishlistFingerprint(serverWishlistRef.current);
  }, [wishlist]);
  const isServerSynced = syncStatus === 'synced' && serverAuthenticated;
  const isLocalOnly = syncStatus === 'local-only' || !serverAuthenticated;

  const value = useMemo<WishlistContextType>(
    () => ({
      wishlist,
      addToWishlist,
      removeFromWishlist,
      clearWishlist,
      isInWishlist,
      replaceWishlist,
      wishlistCount,
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
      syncStatus,
      isServerSynced,
      isLocalOnly,
      serverAuthenticated,
      serverError,
      hasLocalDraft,
      refreshFromServer,
      retrySync,
      retryHydration,
      clearError,
    }),
    [
      addToWishlist,
      clearError,
      error,
      hydrationStatus,
      isHydrated,
      isInWishlist,
      isPending,
      removeFromWishlist,
      clearWishlist,
      replaceWishlist,
      retryHydration,
      setSyncError,
      setSyncPending,
      storageScope,
      syncStatus,
      isServerSynced,
      isLocalOnly,
      serverAuthenticated,
      serverError,
      hasLocalDraft,
      refreshFromServer,
      retrySync,
      wishlist,
      wishlistCount,
    ],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  return useContext(WishlistContext);
}

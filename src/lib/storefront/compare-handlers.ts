import type { NextRequest } from 'next/server';
import { getStorefrontContext, assertMutationOrigin } from './context';
import {
  addCompareProduct,
  clearCompare,
  getCompare,
  importCompare,
  removeCompareProduct,
  type CompareMutationResult,
} from './compare';
import {
  isRecord,
  parseRequestAction,
  parseWishlistAddInput,
  parseWishlistImportInput,
  parseWishlistRemoveInput,
} from './validation';
import { StorefrontInputError } from './errors';
import { noStoreJson, readJsonBody, runStorefrontRoute } from './http';

function responseBody(
  result: CompareMutationResult | { items: Awaited<ReturnType<typeof getCompare>>['items']; count: number },
) {
  const compare = 'compare' in result ? result.compare : result;
  return {
    compare,
    items: compare.items,
    count: compare.count,
    ...('imported' in result && result.imported ? { imported: true } : {}),
  };
}

function compareResponse(result: CompareMutationResult, status = 200) {
  return noStoreJson(responseBody(result), status);
}

async function compareMutationContext(request: NextRequest) {
  const context = await getStorefrontContext(request, { allowGuest: false });
  assertMutationOrigin(request, context);
  return context;
}

export async function handleCompareGet(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const context = await getStorefrontContext(request, { allowGuest: false });
    return noStoreJson(responseBody(await getCompare(context)));
  });
}

export async function handleComparePost(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const context = await compareMutationContext(request);
    const body = await readJsonBody(request);
    const action = parseRequestAction(body);

    if (action === 'clear') {
      return compareResponse(await clearCompare(context));
    }
    if (action === 'import') {
      return compareResponse(await importCompare(context, parseWishlistImportInput(body)));
    }
    if (action === 'remove') {
      return compareResponse(await removeCompareProduct(context, parseWishlistRemoveInput(body)));
    }
    if (action !== 'add') {
      throw new StorefrontInputError('Unsupported comparison action.', 'action');
    }
    return compareResponse(await addCompareProduct(context, parseWishlistAddInput(body)), 201);
  });
}

export async function handleCompareImport(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const context = await compareMutationContext(request);
    const body = await readJsonBody(request);
    return compareResponse(await importCompare(context, parseWishlistImportInput(body)));
  });
}

export async function handleCompareRemove(
  request: NextRequest,
  forcedProductId?: string,
) {
  return runStorefrontRoute(async () => {
    const context = await compareMutationContext(request);
    const body = await readJsonBody(request);
    const input = parseWishlistRemoveInput(
      forcedProductId && isRecord(body) ? { ...body, productId: forcedProductId } : body,
    );
    return compareResponse(await removeCompareProduct(context, input));
  });
}

export async function handleCompareClear(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const context = await compareMutationContext(request);
    return compareResponse(await clearCompare(context));
  });
}

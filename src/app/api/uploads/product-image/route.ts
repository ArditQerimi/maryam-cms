import { requireTenantAccess } from '@/lib/api-security/auth';
import { ImageValidationError, MAX_IMAGE_BYTES, validateAndNormalizeImage } from '@/lib/api-security/image';
import { uploadImageToExactCompany } from '@/lib/api-security/media';
import { apiError, apiInternalError, apiJson, positiveSafeInteger } from '@/lib/api-security/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 512 * 1024;

function requestIsTooLarge(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (!contentLength) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > MAX_MULTIPART_BYTES;
}

function readOptionalLabel(formData: FormData, name: string) {
  const value = formData.get(name);
  if (value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 100 || value.includes('..') || /[\u0000-\u001f\u007f/\\]/.test(value)) {
    throw new ImageValidationError('Invalid upload metadata');
  }
  return value.trim() || undefined;
}

export async function POST(request: Request) {
  const access = await requireTenantAccess({ permission: 'inventory.manage' });
  if (!access.ok) return access.response;
  const { context } = access;

  if (requestIsTooLarge(request)) {
    return apiError('Image must be 5MB or smaller', 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError('Invalid multipart request');
  }

  const files = formData.getAll('file');
  if (files.length === 0) return apiError('No file provided');
  if (files.length !== 1 || !(files[0] instanceof File)) {
    return apiError('Exactly one file is required');
  }
  const file = files[0];

  let normalized;
  let productSlug: string | undefined;
  let category: string | undefined;
  let isGallery = false;
  let galleryIndex: number | undefined;
  try {
    normalized = await validateAndNormalizeImage(file);
    productSlug = readOptionalLabel(formData, 'productSlug');
    category = readOptionalLabel(formData, 'category');

    const galleryValue = formData.get('isGallery');
    if (galleryValue !== null && galleryValue !== 'true' && galleryValue !== 'false') {
      throw new ImageValidationError('Invalid gallery metadata');
    }
    isGallery = galleryValue === 'true';

    const galleryValueIndex = formData.get('galleryIndex');
    if (galleryValueIndex !== null) {
      if (typeof galleryValueIndex !== 'string' || !/^\d{1,2}$/.test(galleryValueIndex)) {
        throw new ImageValidationError('Invalid gallery metadata');
      }
      galleryIndex = Number(galleryValueIndex);
      if (!Number.isSafeInteger(galleryIndex) || galleryIndex > 99) {
        throw new ImageValidationError('Invalid gallery metadata');
      }
    }
    if (galleryIndex !== undefined && !isGallery) {
      throw new ImageValidationError('Invalid gallery metadata');
    }

    const storeValue = formData.get('storeId');
    const requestedStoreId = positiveSafeInteger(storeValue);
    if (storeValue !== null && storeValue !== '' && requestedStoreId === null) {
      throw new ImageValidationError('Invalid store selection');
    }
    if (
      requestedStoreId !== null &&
      context.user.storeId !== null &&
      requestedStoreId !== context.user.storeId
    ) {
      return apiError('You are not allowed to upload for this store', 403);
    }
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return apiError(
        error.status === 413 ? 'Image must be 5MB or smaller' : 'Invalid image or upload metadata',
        error.status,
      );
    }
    return apiError('Invalid upload metadata');
  }

  try {
    const uploaded = await uploadImageToExactCompany({
      companyId: context.companyId,
      file: normalized.file,
      target: 'products',
      extension: normalized.extension,
      options: {
        productSlug,
        subFolder: category,
        isGallery,
        galleryIndex,
      },
    });

    return apiJson({
      url: uploaded.url,
      provider: uploaded.provider,
      ...(uploaded.provider === 'cloudinary' ? { publicId: uploaded.publicId } : {}),
    });
  } catch {
    return apiInternalError('Failed to upload image');
  }
}

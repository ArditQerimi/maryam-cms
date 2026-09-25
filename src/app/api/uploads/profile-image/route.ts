import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireTenantAccess } from '@/lib/api-security/auth';
import { ImageValidationError, MAX_IMAGE_BYTES, validateAndNormalizeImage } from '@/lib/api-security/image';
import { uploadImageToExactCompany } from '@/lib/api-security/media';
import { apiError, apiInternalError, apiJson } from '@/lib/api-security/http';
import * as tenantSchema from '@/db/schema-tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 512 * 1024;

function requestIsTooLarge(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (!contentLength) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > MAX_MULTIPART_BYTES;
}

export async function POST(request: Request) {
  const access = await requireTenantAccess();
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
  try {
    normalized = await validateAndNormalizeImage(file);
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return apiError(
        error.status === 413 ? 'Image must be 5MB or smaller' : 'Invalid image',
        error.status,
      );
    }
    return apiError('Invalid image');
  }

  try {
    const uploaded = await uploadImageToExactCompany({
      companyId: context.companyId,
      file: normalized.file,
      target: 'profiles',
      extension: normalized.extension,
    });

    await context.db
      .update(tenantSchema.users)
      .set({ photoUrl: uploaded.url, updatedAt: new Date() })
      .where(and(
        eq(tenantSchema.users.id, context.userId),
        eq(tenantSchema.users.status, 'Active'),
      ));
    revalidatePath('/profile');
    revalidatePath('/settings/profile');
    revalidatePath('/users');

    return apiJson({ url: uploaded.url, provider: uploaded.provider });
  } catch {
    return apiInternalError('Failed to upload image');
  }
}

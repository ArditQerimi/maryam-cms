import { requireTenantAccess } from '@/lib/api-security/auth';
import {
  cloudinaryNotConfiguredResponse,
  getCloudinarySigningContext,
  signCloudinaryParams,
  validateCloudinaryUploadParams,
} from '@/lib/api-security/cloudinary';
import { apiError, apiInternalError, apiJson, isPlainObject } from '@/lib/api-security/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SIGNATURE_BODY_BYTES = 16 * 1024;

function requestIsTooLarge(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (!contentLength) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > MAX_SIGNATURE_BODY_BYTES;
}

export async function POST(request: Request) {
  const access = await requireTenantAccess({ permission: 'inventory.manage' });
  if (!access.ok) return access.response;
  const { context } = access;

  if (requestIsTooLarge(request)) {
    return apiError('Request body is too large', 413);
  }

  let signingContext;
  try {
    signingContext = await getCloudinarySigningContext(context.companyId, context.company.subdomain);
  } catch {
    return apiInternalError('Unable to prepare Cloudinary signing');
  }
  if (!signingContext) return cloudinaryNotConfiguredResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body');
  }
  if (!isPlainObject(body)) return apiError('Invalid request body');

  const rawParams = body.paramsToSign ?? body.params_to_sign;
  const params = validateCloudinaryUploadParams(rawParams, signingContext.tenantFolderRoot);
  if (!params) return apiError('Invalid Cloudinary upload parameters');

  try {
    return apiJson({ signature: signCloudinaryParams(params, signingContext.apiSecret) });
  } catch {
    return apiInternalError('Unable to create Cloudinary signature');
  }
}

import { uploadProductsExcel } from '@/lib/excel-actions';
import { requireTenantAccess } from '@/lib/api-security/auth';
import { SpreadsheetValidationError, MAX_SPREADSHEET_BYTES, validateAndNormalizeSpreadsheet } from '@/lib/api-security/spreadsheet';
import { apiError, apiJson } from '@/lib/api-security/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MULTIPART_BYTES = MAX_SPREADSHEET_BYTES + 512 * 1024;

function requestIsTooLarge(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (!contentLength) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > MAX_MULTIPART_BYTES;
}

export async function POST(request: Request) {
  const access = await requireTenantAccess({ permission: 'inventory.manage' });
  if (!access.ok) return access.response;

  if (requestIsTooLarge(request)) {
    return apiError('Spreadsheet must be 10MB or smaller', 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError('Invalid multipart request');
  }

  const files = formData.getAll('file');
  if (files.length === 0) return apiError('No file uploaded');
  if (files.length !== 1 || !(files[0] instanceof File)) {
    return apiError('Exactly one file is required');
  }

  let normalized;
  try {
    normalized = await validateAndNormalizeSpreadsheet(files[0]);
  } catch (error) {
    if (error instanceof SpreadsheetValidationError) {
      return apiError(
        error.status === 413 ? 'Spreadsheet must be 10MB or smaller' : 'Invalid Excel spreadsheet',
        error.status,
      );
    }
    return apiError('Invalid Excel spreadsheet');
  }

  const safeFormData = new FormData();
  safeFormData.set('file', normalized.file);

  try {
    const result = await uploadProductsExcel(safeFormData);
    if (
      result &&
      typeof result === 'object' &&
      Number((result as { failed?: unknown }).failed) > 0
    ) {
      return apiError('Some product rows could not be imported');
    }
    return apiJson({ ok: true });
  } catch {
    return apiError('Product import failed');
  }
}

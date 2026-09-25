// Server-only: Cloudinary secrets must never be imported by client code.
import { v2 as cloudinary } from 'cloudinary';
import { getTenantMediaStorageSettings } from '@/lib/tenant-media-storage';
import { apiError } from './http';

const MAX_PARAM_COUNT = 32;
const MAX_PARAM_VALUE_LENGTH = 2_048;
const MAX_FOLDER_LENGTH = 512;
const MAX_PUBLIC_ID_LENGTH = 255;

const SAFE_PARAM_KEYS = new Set([
  'access_mode',
  'allowed_formats',
  'context',
  'eager',
  'filename_override',
  'folder',
  'invalidate',
  'metadata',
  'moderation',
  'overwrite',
  'public_id',
  'quality_analysis',
  'resource_type',
  'tags',
  'timestamp',
  'transformation',
  'type',
  'unique_filename',
  'upload_preset',
  'use_filename',
]);

const FORBIDDEN_PARAM_KEYS = new Set([
  'api_key',
  'api_secret',
  'authorization',
  'callback',
  'cookie',
  'headers',
  'notification_url',
  'proxy',
  'secret',
  'signature',
]);

const IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export type CloudinarySigningContext = {
  apiSecret: string;
  tenantFolderRoot: string;
};

function safeSegment(value: string) {
  const normalized = value.normalize('NFKC').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,126}$/.test(normalized)) return null;
  if (normalized === '.' || normalized === '..') return null;
  return normalized;
}

function canonicalFolder(value: string) {
  const normalized = value.normalize('NFKC').trim();
  if (
    !normalized ||
    normalized.length > MAX_FOLDER_LENGTH ||
    normalized.includes('\\') ||
    normalized.includes('%') ||
    normalized.includes('//') ||
    normalized.startsWith('/') ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    return null;
  }

  const segments = normalized.split('/');
  if (segments.length > 5 || segments.some((segment) => segment.includes('..') || !safeSegment(segment))) return null;
  return segments.join('/');
}

export function getTenantCloudinaryFolderRoot(baseFolder: string | null | undefined, subdomain: string) {
  const safeSubdomain = safeSegment(subdomain);
  if (!safeSubdomain) return null;

  const base = canonicalFolder(baseFolder || 'tenants');
  if (!base) return null;

  // Older installations sometimes stored the tenant subdomain as part of the
  // configured base. Do not create a second tenant segment in that case.
  if (base === safeSubdomain || base.endsWith(`/${safeSubdomain}`)) return base;
  return `${base}/${safeSubdomain}`;
}

function valueToString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return null;
}

function validatePublicId(value: string) {
  if (!value || value.length > MAX_PUBLIC_ID_LENGTH) return false;
  if (value.includes('..') || value.includes('\\') || value.startsWith('/') || /[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }
  return value.split('/').every((segment) => safeSegment(segment) !== null);
}

function validateBoolean(value: string) {
  return value === 'true' || value === 'false';
}

/**
 * Validates and canonicalizes the small set of Cloudinary parameters this
 * application permits for signed image uploads. In particular, folder is
 * required to be below the authenticated company's tenant root. The upload
 * widget must submit that root-prefixed folder; signing a relative folder
 * would allow a tenant to write outside its namespace.
 */
export function validateCloudinaryUploadParams(
  value: unknown,
  tenantFolderRoot: string,
): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const canonicalRoot = canonicalFolder(tenantFolderRoot);
  if (!canonicalRoot) return null;

  const rawObject = value as Record<string, unknown>;
  if (typeof rawObject.folder !== 'string' || typeof rawObject.resource_type !== 'string') return null;

  const entries = Object.entries(rawObject);
  if (entries.length === 0 || entries.length > MAX_PARAM_COUNT) return null;

  const params: Record<string, string> = {};
  for (const [key, rawValue] of entries) {
    if (
      !/^[a-z][a-z0-9_]{0,63}$/.test(key) ||
      FORBIDDEN_PARAM_KEYS.has(key) ||
      !SAFE_PARAM_KEYS.has(key)
    ) {
      return null;
    }

    const stringValue = valueToString(rawValue);
    if (
      !stringValue ||
      stringValue.length > MAX_PARAM_VALUE_LENGTH ||
      /[\u0000-\u001f\u007f&=%]/.test(stringValue)
    ) {
      return null;
    }
    params[key] = stringValue;
  }

  const timestamp = params.timestamp;
  if (!timestamp || !/^\d{10,13}$/.test(timestamp)) return null;

  if (params.resource_type !== 'image') return null;
  if (params.type && params.type !== 'upload') return null;
  if (params.access_mode && params.access_mode !== 'public') return null;

  const folder = canonicalFolder(params.folder || '');
  if (
    !folder ||
    params.folder !== folder ||
    folder === canonicalRoot ||
    !folder.startsWith(`${canonicalRoot}/`)
  ) {
    return null;
  }
  params.folder = folder;

  if (params.public_id && !validatePublicId(params.public_id)) return null;
  if (params.filename_override && !validatePublicId(params.filename_override)) return null;

  if (params.allowed_formats) {
    const formats = params.allowed_formats.split(',').map((format) => format.trim().toLowerCase());
    const normalizedFormats = formats.join(',');
    if (
      !formats.length ||
      formats.some((format) => !IMAGE_FORMATS.has(format)) ||
      params.allowed_formats !== normalizedFormats
    ) {
      return null;
    }
    params.allowed_formats = normalizedFormats;
  }

  for (const key of ['invalidate', 'overwrite', 'unique_filename', 'use_filename']) {
    if (params[key] && !validateBoolean(params[key])) return null;
  }
  if (params.invalidate === 'true' || params.overwrite === 'true') return null;

  if (params.upload_preset) {
    const configuredPreset = String(
      process.env.CLOUDINARY_UPLOAD_PRESET || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '',
    ).trim();
    if (!configuredPreset || params.upload_preset !== configuredPreset) return null;
  }

  return params;
}

export function signCloudinaryParams(params: Record<string, string>, apiSecret: string) {
  return cloudinary.utils.api_sign_request(params, apiSecret);
}

export async function getCloudinarySigningContext(companyId: number, subdomain: string): Promise<CloudinarySigningContext | null> {
  if (!Number.isSafeInteger(companyId) || companyId <= 0) return null;

  const settings = await getTenantMediaStorageSettings(companyId);
  if (
    settings.provider !== 'cloudinary' ||
    !settings.cloudinaryApiSecret ||
    !settings.cloudinaryCloudName
  ) {
    return null;
  }

  const tenantFolderRoot = getTenantCloudinaryFolderRoot(settings.cloudinaryFolder, subdomain);
  if (!tenantFolderRoot) return null;

  return {
    apiSecret: settings.cloudinaryApiSecret,
    tenantFolderRoot,
  };
}

export function cloudinaryNotConfiguredResponse() {
  return apiError('Cloudinary is not configured for this tenant', 503);
}

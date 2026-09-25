// Server-only: this module handles tenant credentials and filesystem writes.
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { getTenantMediaStorageSettings } from '@/lib/tenant-media-storage';
import { getTenantCloudinaryFolderRoot } from './cloudinary';
import { MAX_IMAGE_BYTES } from './image';

export type SecureUploadTarget = 'products' | 'profiles';

export type SecureUploadOptions = {
  subFolder?: string | null;
  productSlug?: string | null;
  isGallery?: boolean;
  galleryIndex?: number;
};

export type SecureUploadResult = {
  url: string;
  provider: 'local' | 'cloudinary';
  publicId?: string;
};

function slugSegment(value: string, fallback: string) {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  return normalized || fallback;
}

function safeSubdomain(value: string) {
  const normalized = value.normalize('NFKC').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/.test(normalized)) {
    throw new Error('Invalid tenant media configuration');
  }
  return normalized;
}

function safeLocalBasePath(value: string | null | undefined) {
  const normalized = String(value || '/uploads').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized || normalized.length > 255) throw new Error('Invalid local media configuration');
  const segments = normalized.split('/');
  if (segments.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment) || segment === '.' || segment === '..')) {
    throw new Error('Invalid local media configuration');
  }
  return segments.join('/');
}

function ensureInsideRoot(root: string, candidate: string) {
  const relative = path.relative(
    path.resolve(/*turbopackIgnore: true*/ root),
    path.resolve(/*turbopackIgnore: true*/ candidate),
  );
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid local media path');
  }
}

function randomFileName(extension: string) {
  return `${Date.now()}-${randomBytes(12).toString('hex')}.${extension}`;
}

async function uploadToExactLocalStorage(params: {
  file: File;
  extension: string;
  companySubdomain: string;
  target: SecureUploadTarget;
  localBasePath: string | null | undefined;
}) {
  const relativeBase = safeLocalBasePath(params.localBasePath);
  const defaultFilesystemRoot = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    'public',
  );
  const filesystemRoot = process.env.LOCAL_UPLOAD_FILESYSTEM_ROOT
    ? path.resolve(/*turbopackIgnore: true*/ process.env.LOCAL_UPLOAD_FILESYSTEM_ROOT)
    : defaultFilesystemRoot;
  const uploadDirectory = path.join(
    /*turbopackIgnore: true*/ filesystemRoot,
    relativeBase,
    params.companySubdomain,
    params.target,
  );
  ensureInsideRoot(filesystemRoot, uploadDirectory);
  await fs.mkdir(uploadDirectory, { recursive: true });

  const fileName = randomFileName(params.extension);
  const absolutePath = path.join(/*turbopackIgnore: true*/ uploadDirectory, fileName);
  ensureInsideRoot(filesystemRoot, absolutePath);
  const bytes = Buffer.from(await params.file.arrayBuffer());
  await fs.writeFile(absolutePath, bytes, { flag: 'wx' });

  return {
    provider: 'local' as const,
    url: `/${relativeBase}/${params.companySubdomain}/${params.target}/${fileName}`,
  };
}

async function uploadToExactCloudinaryStorage(params: {
  file: File;
  companySubdomain: string;
  target: SecureUploadTarget;
  settings: Awaited<ReturnType<typeof getTenantMediaStorageSettings>>;
  options?: SecureUploadOptions;
}) {
  if (!params.settings.cloudinaryApiKey || !params.settings.cloudinaryApiSecret || !params.settings.cloudinaryCloudName) {
    throw new Error('Cloudinary is not configured for this tenant');
  }

  const folderRoot = getTenantCloudinaryFolderRoot(params.settings.cloudinaryFolder, params.companySubdomain);
  if (!folderRoot) throw new Error('Invalid tenant media configuration');

  const category = params.options?.subFolder
    ? slugSegment(String(params.options.subFolder), params.target)
    : params.target;
  const productSlug = params.options?.productSlug
    ? slugSegment(String(params.options.productSlug), 'product')
    : '';
  const gallery = params.options?.isGallery;
  const galleryIndex = params.options?.galleryIndex;
  if (galleryIndex !== undefined && (!Number.isSafeInteger(galleryIndex) || galleryIndex < 0 || galleryIndex > 99)) {
    throw new Error('Invalid gallery index');
  }

  const folder = [
    folderRoot,
    category,
    ...(productSlug ? [productSlug] : []),
    ...(gallery ? ['gallery'] : []),
  ].join('/');
  const publicId = productSlug
    ? `${productSlug}-${gallery ? 'gallery' : 'main'}${galleryIndex !== undefined ? `-${String(galleryIndex).padStart(2, '0')}` : ''}`
    : `${params.target}-${Date.now()}-${randomBytes(8).toString('hex')}`;

  const { v2: cloudinary } = await import('cloudinary');

  const bytes = Buffer.from(await params.file.arrayBuffer());
  const dataUri = `data:${params.file.type};base64,${bytes.toString('base64')}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    cloud_name: params.settings.cloudinaryCloudName,
    api_key: params.settings.cloudinaryApiKey,
    api_secret: params.settings.cloudinaryApiSecret,
    folder,
    public_id: publicId,
    resource_type: 'image',
    overwrite: false,
    unique_filename: true,
    use_filename: false,
  });

  if (!result.secure_url || typeof result.public_id !== 'string') {
    throw new Error('Cloudinary upload did not return a usable asset URL');
  }

  return {
    provider: 'cloudinary' as const,
    url: result.secure_url,
    publicId: result.public_id,
  };
}

/**
 * Uploads using only the company id already authenticated by the route. The
 * storage implementation never calls host-based tenant resolution.
 */
export async function uploadImageToExactCompany(params: {
  companyId: number;
  file: File;
  target: SecureUploadTarget;
  extension: string;
  options?: SecureUploadOptions;
}) {
  if (!Number.isSafeInteger(params.companyId) || params.companyId <= 0) {
    throw new Error('Invalid tenant company');
  }
  if (params.file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be 5MB or smaller');
  }
  if (!/^(?:jpg|png|webp|gif)$/.test(params.extension)) {
    throw new Error('Invalid image extension');
  }
  const expectedMime: Record<string, string> = {
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  if (params.file.type !== expectedMime[params.extension]) {
    throw new Error('Image type does not match its extension');
  }

  const company = await masterDb.query.companies.findFirst({
    where: eq(masterSchema.companies.id, params.companyId),
    columns: {
      id: true,
      subdomain: true,
      status: true,
    },
  });
  if (!company || company.status !== 'Active') throw new Error('Tenant company not found');

  const companySubdomain = safeSubdomain(company.subdomain);
  const settings = await getTenantMediaStorageSettings(company.id);

  if (settings.provider === 'local') {
    return uploadToExactLocalStorage({
      file: params.file,
      extension: params.extension,
      companySubdomain,
      target: params.target,
      localBasePath: settings.localBasePath,
    });
  }

  return uploadToExactCloudinaryStorage({
    file: params.file,
    companySubdomain,
    target: params.target,
    settings,
    options: params.options,
  });
}

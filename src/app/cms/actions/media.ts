'use server';

import { revalidatePath } from 'next/cache';
import { v2 as cloudinary } from 'cloudinary';
import { and, eq } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { cmsMedia, products } from '@/db/schema-tenant';
import { slugify } from '@/lib/cms/format';
import { requireCmsSession } from '@/lib/cms/session';
import { getTenantCloudinaryFolderRoot } from '@/lib/api-security/cloudinary';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
  'application/pdf',
  'video/mp4',
];

export type MediaActionResult = {
  ok: boolean;
  error?: string;
  uploaded?: number;
  deleted?: number;
};

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return false;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return true;
}

function mimeKind(mime: string | null | undefined) {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'document';
  return 'file';
}

export async function uploadMedia(formData: FormData): Promise<MediaActionResult> {
  const session = await requireCmsSession();
  const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!files.length) return { ok: false, error: 'Choose at least one file to upload.' };
  if (files.length > 12) return { ok: false, error: 'Upload up to 12 files at a time.' };

  const invalid = files.find(
    (file) => file.size > MAX_UPLOAD_BYTES || (file.type && !ALLOWED_MIME.includes(file.type)),
  );
  if (invalid) {
    return {
      ok: false,
      error:
        invalid.size > MAX_UPLOAD_BYTES
          ? `"${invalid.name}" is larger than 8 MB.`
          : `"${invalid.type}" is not an allowed file type.`,
    };
  }

  if (!configureCloudinary()) {
    return { ok: false, error: 'Cloudinary is not configured. Check CLOUDINARY_* in .env.' };
  }

  let company;
  try {
    company = await getContextCompany();
  } catch {
    return { ok: false, error: 'Could not resolve the current tenant.' };
  }

  const root = getTenantCloudinaryFolderRoot(process.env.CLOUDINARY_FOLDER, company.subdomain);
  if (!root) return { ok: false, error: 'Invalid Cloudinary folder configuration.' };

  const db = await getContextDb();
  const folder = String(formData.get('folder') || '/');
  const safeFolder = folder.startsWith('/') ? folder : `/${folder}`;

  let uploaded = 0;
  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await new Promise<{ secure_url: string; public_id: string; bytes: number; width?: number; height?: number; format?: string }>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: `${root}/cms${safeFolder === '/' ? '' : safeFolder}`,
                resource_type: 'image',
                unique_filename: true,
              },
              (error, value) => (error ? reject(error) : resolve(value as any)),
            )
            .end(buffer);
        },
      );

      await db.insert(cmsMedia).values({
        companyId: company.id,
        filename: result.public_id.split('/').pop() || file.name,
        originalName: file.name,
        url: result.secure_url,
        publicId: result.public_id,
        mimeType: file.type || mimeKind(file.type),
        sizeBytes: result.bytes ?? file.size,
        width: result.width ?? null,
        height: result.height ?? null,
        altText: '',
        folder: safeFolder,
        uploadedBy: Number((session as any).userId) || null,
      });
      uploaded += 1;
    } catch (error) {
      console.error('[cms/media] upload failed', file.name, error);
    }
  }

  if (!uploaded) return { ok: false, error: 'Upload failed. Check the Cloudinary credentials.' };

  revalidatePath('/cms/media');
  return { ok: true, uploaded };
}

export async function updateMedia(
  id: number,
  values: { altText?: string; originalName?: string },
): Promise<MediaActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  const patch: Record<string, unknown> = {};
  if (typeof values.altText === 'string') patch.altText = values.altText.slice(0, 500);
  if (typeof values.originalName === 'string' && values.originalName.trim()) {
    patch.originalName = values.originalName.trim().slice(0, 500);
  }
  if (!Object.keys(patch).length) return { ok: false, error: 'Nothing to update.' };

  await db.update(cmsMedia).set(patch).where(eq(cmsMedia.id, id));
  revalidatePath('/cms/media');
  return { ok: true };
}

export async function deleteMedia(id: number): Promise<MediaActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  const [row] = await db.select().from(cmsMedia).where(eq(cmsMedia.id, id)).limit(1);
  if (!row) return { ok: false, error: 'That file no longer exists.' };

  if (row.publicId && configureCloudinary()) {
    try {
      await cloudinary.uploader.destroy(row.publicId, { resource_type: 'image' });
    } catch (error) {
      console.error('[cms/media] cloudinary destroy failed', error);
    }
  }

  await db.delete(cmsMedia).where(and(eq(cmsMedia.id, id)));
  revalidatePath('/cms/media');
  return { ok: true, deleted: 1 };
}

/*
 * Product photos through Cloudinary's own upload modal (crop, camera, link). One folder per product,
 * named after its title (slug), and two tags on every photo to find them in Cloudinary:
 *   <tenant root>/cms/products/<slug>/   tags: <slug>, product-<id>
 *   (a new product not saved yet: …/products/new/, tag product-new)
 * A later title change keeps the old photos where they are (their links never break).
 * Which photo is the cover is not a folder: it is the order of products.image_url (first = cover),
 * so reordering never moves files. The browser asks this server to sign each upload; the API secret
 * never leaves the server and the signature only covers that product's folder.
 */
const PRODUCT_UPLOAD_KEYS = new Set(['timestamp', 'folder', 'source', 'custom_coordinates', 'tags', 'unique_filename', 'use_filename']);

type UploadTarget = { folder: string; tags: string[]; mediaFolder: string };

/** The product's Cloudinary folder (by title) and tags; null when the product does not exist. */
async function productTarget(root: string, productId: number | null): Promise<UploadTarget | null> {
  if (!productId) return { folder: `${root}/cms/products/new`, tags: ['product-new'], mediaFolder: '/products/new' };
  if (!Number.isSafeInteger(productId) || productId <= 0) return null;
  const db = await getContextDb();
  const [product] = await db
    .select({ name: products.name, slug: products.slug })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) return null;
  const slug = slugify(product.slug || product.name).slice(0, 100).replace(/-+$/, '') || `product-${productId}`;
  return { folder: `${root}/cms/products/${slug}`, tags: [slug, `product-${productId}`], mediaFolder: `/products/${slug}` };
}

async function cmsCloudinaryRoot() {
  if (!configureCloudinary()) return null;
  const company = await getContextCompany().catch(() => null);
  return company ? getTenantCloudinaryFolderRoot(process.env.CLOUDINARY_FOLDER, company.subdomain) : null;
}

export async function getProductUploadConfig(productId: number | null) {
  await requireCmsSession();
  const root = await cmsCloudinaryRoot();
  if (!root) return { ok: false as const, error: 'Cloudinary is not configured. Check CLOUDINARY_* in .env.' };
  const target = await productTarget(root, productId);
  if (!target) return { ok: false as const, error: 'Product not found.' };
  return {
    ok: true as const,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    folder: target.folder,
    tags: target.tags,
  };
}

/** Signs one upload of Cloudinary's widget, only into that product's folder with its tags. */
export async function signProductUpload(productId: number | null, paramsToSign: Record<string, unknown>) {
  await requireCmsSession();
  const root = await cmsCloudinaryRoot();
  if (!root || !paramsToSign || typeof paramsToSign !== 'object') return { ok: false as const };
  const target = await productTarget(root, productId);
  if (!target) return { ok: false as const };
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(paramsToSign)) {
    if (!PRODUCT_UPLOAD_KEYS.has(key)) return { ok: false as const };
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return { ok: false as const };
    params[key] = String(value);
    if (params[key].length > 500) return { ok: false as const };
  }
  if (!/^\d{10}$/.test(params.timestamp ?? '') || Math.abs(Date.now() / 1000 - Number(params.timestamp)) > 3600) return { ok: false as const };
  if (params.folder !== target.folder) return { ok: false as const };
  if (params.tags && params.tags.split(',').some((tag) => !target.tags.includes(tag))) return { ok: false as const };
  return { ok: true as const, signature: cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!) };
}

/** Adds a photo the widget uploaded to the CMS media library (folder /products/<slug>). */
export async function recordProductUpload(
  productId: number | null,
  info: { public_id?: unknown; secure_url?: unknown; bytes?: unknown; width?: unknown; height?: unknown; format?: unknown; original_filename?: unknown },
): Promise<{ ok: boolean; url?: string }> {
  const session = await requireCmsSession();
  const root = await cmsCloudinaryRoot();
  const publicId = typeof info.public_id === 'string' ? info.public_id : '';
  const url = typeof info.secure_url === 'string' ? info.secure_url : '';
  if (!root || !publicId || !url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`)) {
    return { ok: false };
  }
  // Fixed-folder accounts put the folder in the public id. Accounts in Cloudinary's "dynamic folders"
  // mode may not: there the asset's real folder is asked from Cloudinary (never taken from the browser).
  const target = await productTarget(root, productId);
  if (!target) return { ok: false };
  const folder = target.folder;
  if (!publicId.startsWith(`${folder}/`)) {
    const asset = (await cloudinary.api.resource(publicId).catch(() => null)) as { asset_folder?: string } | null;
    if (asset?.asset_folder !== folder) {
      console.warn('[cms/media] product upload outside its folder', { publicId, assetFolder: asset?.asset_folder ?? null, folder });
      return { ok: false };
    }
  }

  const company = await getContextCompany();
  const db = await getContextDb();
  const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null);
  const format = typeof info.format === 'string' ? info.format.slice(0, 20) : '';
  await db.insert(cmsMedia).values({
    companyId: company.id,
    filename: publicId.split('/').pop() || 'image',
    originalName: typeof info.original_filename === 'string' ? `${info.original_filename.slice(0, 480)}${format ? `.${format}` : ''}` : null,
    url,
    publicId,
    mimeType: format ? `image/${format === 'jpg' ? 'jpeg' : format}` : 'image',
    sizeBytes: number(info.bytes),
    width: number(info.width),
    height: number(info.height),
    altText: '',
    folder: target.mediaFolder,
    uploadedBy: Number((session as { userId?: unknown }).userId) || null,
  });
  revalidatePath('/cms/media');
  return { ok: true, url };
}

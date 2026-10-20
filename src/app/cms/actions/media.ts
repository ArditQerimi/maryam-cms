'use server';

import { revalidatePath } from 'next/cache';
import { v2 as cloudinary } from 'cloudinary';
import { and, eq, inArray } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { cmsMedia, products } from '@/db/schema-tenant';
import { slugify } from '@/lib/cms/format';
import { parseCloudinaryUrl, withPublicId } from '@/lib/cloudinary-url';
import { parseProductImages, serializeProductImages } from '@/components/store/format-product';
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

/**
 * The shop's root folder in Cloudinary. CLOUDINARY_TENANT_FOLDER sets it exactly (e.g.
 * "tenants/elifstore"); otherwise CLOUDINARY_FOLDER + the tenant's subdomain ("tenants/arditi").
 */
function shopCloudinaryRoot(subdomain: string) {
  const exact = String(process.env.CLOUDINARY_TENANT_FOLDER ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (exact) return getTenantCloudinaryFolderRoot(exact, exact.split('/').pop() ?? '');
  return getTenantCloudinaryFolderRoot(process.env.CLOUDINARY_FOLDER, subdomain);
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

  const root = shopCloudinaryRoot(company.subdomain);
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
 * Product photos through Cloudinary’s own upload modal (crop, camera, link). One folder per product,
 * named by its id (stays the same when the title changes), and two tags on every photo to find it by title:
 *   <tenant root>/cms/products/<id>/   tags: <slug>, product-<id>
 *   (a new product not saved yet: …/products/new/, tag product-new)
 * Photos uploaded before (other folders / the import) are moved here by organizeProductPhotos().
 * Which photo is the cover is not a folder: it is the order of products.image_url (first = cover),
 * so reordering never moves files. The browser asks this server to sign each upload; the API secret
 * never leaves the server and the signature only covers that product's folder.
 */
const PRODUCT_UPLOAD_KEYS = new Set(['timestamp', 'folder', 'source', 'custom_coordinates', 'tags', 'unique_filename', 'use_filename']);

type UploadTarget = { folder: string; tags: string[]; mediaFolder: string };

/** The product’s Cloudinary folder (by id) and tags (title + id); null when the product does not exist. */
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
  return { folder: `${root}/cms/products/${productId}`, tags: [slug, `product-${productId}`], mediaFolder: `/products/${productId}` };
}

async function cmsCloudinaryRoot() {
  if (!configureCloudinary()) return null;
  const company = await getContextCompany().catch(() => null);
  return company ? shopCloudinaryRoot(company.subdomain) : null;
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

/** Adds a photo the widget uploaded to the CMS media library (folder /products/<id>). */
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

export type OrganizeReport = {
  ok: boolean;
  error?: string;
  dryRun: boolean;
  root: string;
  /** Photos still outside their product's folder (before this run). */
  pending: number;
  moved: number;
  failed: number;
  samples: Array<{ product: string; from: string; to: string }>;
  errors: string[];
};

const ORGANIZE_BATCH = 40;

/**
 * Moves the product photos uploaded from the CMS (any …/cms/products/… folder: title folders, another
 * tenant root) that are not yet in <root>/cms/products/<id>/ — photos from the import (books/, libra/…)
 * stay where they are — and
 * updates the links on the products and in the media library; crops are kept. `dryRun` only counts.
 * Works in batches (call again until `pending` is 0); a photo used by several products goes to the first.
 */
export async function organizeProductPhotos(dryRun: boolean, onlyProductIds?: number[]): Promise<OrganizeReport> {
  await requireCmsSession();
  const root = await cmsCloudinaryRoot();
  const empty = { dryRun, root: root ?? '', pending: 0, moved: 0, failed: 0, samples: [], errors: [] };
  if (!root) return { ...empty, ok: false, error: 'Cloudinary is not configured. Check CLOUDINARY_* in .env.' };
  const cloud = process.env.CLOUDINARY_CLOUD_NAME!;
  const db = await getContextDb();
  // Optional limit to some products (tests; the CMS button organizes all of them).
  const only = Array.isArray(onlyProductIds) ? onlyProductIds.filter((id) => Number.isSafeInteger(id) && id > 0) : null;
  const rows = await db
    .select({ id: products.id, name: products.name, slug: products.slug, imageUrl: products.imageUrl })
    .from(products)
    .where(only ? inArray(products.id, only.length ? only : [0]) : undefined)
    .orderBy(products.id);

  // old public id → where it goes (first product that uses it)
  const moves = new Map<string, { productId: number; product: string; folder: string; to: string; tags: string[] }>();
  for (const row of rows) {
    const folder = `${root}/cms/products/${row.id}`;
    const slug = slugify(row.slug || row.name).slice(0, 100).replace(/-+$/, '') || `product-${row.id}`;
    for (const url of parseProductImages(row.imageUrl)) {
      const parts = parseCloudinaryUrl(url);
      if (!parts || parts.cloud !== cloud || parts.publicId.startsWith(`${folder}/`) || moves.has(parts.publicId)) continue;
      if (!/(^|\/)cms\/products\//.test(parts.publicId)) continue; // imported photos stay
      const name = parts.publicId.split('/').pop()!;
      moves.set(parts.publicId, { productId: row.id, product: row.name, folder, to: `${folder}/${name}`, tags: [slug, `product-${row.id}`] });
    }
  }

  const report: OrganizeReport = {
    ...empty,
    ok: true,
    pending: moves.size,
    samples: [...moves].slice(0, 5).map(([from, move]) => ({ product: move.product, from, to: move.to })),
  };
  if (dryRun || moves.size === 0) return report;

  // Move one batch in Cloudinary.
  const done = new Map<string, { publicId: string; version: string | null }>();
  for (const [from, move] of [...moves].slice(0, ORGANIZE_BATCH)) {
    try {
      let result = (await cloudinary.uploader.rename(from, move.to, { overwrite: false }).catch(async (error: { message?: string; http_code?: number }) => {
        // Already moved by an earlier, interrupted run: use the photo that is there.
        const existing = (await cloudinary.api.resource(move.to).catch(() => null)) as { public_id?: string; version?: number } | null;
        if (existing?.public_id) return existing;
        throw error;
      })) as { public_id?: string; version?: number };
      if (!result?.public_id) throw new Error('Cloudinary did not return the new photo.');
      // Folder shown in Cloudinary (dynamic-folder accounts) and the tags; the move itself already worked.
      result = { ...result, ...((await cloudinary.uploader.explicit(result.public_id, { type: 'upload', asset_folder: move.folder, tags: move.tags }).catch(() => null)) ?? {}) };
      done.set(from, { publicId: result.public_id!, version: result.version != null ? String(result.version) : null });
      report.moved += 1;
    } catch (error) {
      report.failed += 1;
      const message = error instanceof Error ? error.message : (error as { message?: string })?.message ?? 'unknown error';
      if (report.errors.length < 5) report.errors.push(`${from}: ${message}`.slice(0, 200));
    }
  }

  // Point every product / media row that used a moved photo at its new place.
  if (done.size > 0) {
    for (const row of rows) {
      const images = parseProductImages(row.imageUrl);
      let changed = false;
      const next = images.map((url) => {
        const parts = parseCloudinaryUrl(url);
        const moved = parts && parts.cloud === cloud ? done.get(parts.publicId) : undefined;
        if (!moved) return url;
        changed = true;
        return withPublicId(url, moved.publicId, moved.version);
      });
      if (changed) {
        await db.update(products).set({ imageUrl: serializeProductImages(next), updatedAt: new Date() }).where(eq(products.id, row.id));
      }
    }
    for (const [from, moved] of done) {
      const move = moves.get(from)!;
      const rowsOfMedia = await db.select({ id: cmsMedia.id, url: cmsMedia.url }).from(cmsMedia).where(eq(cmsMedia.publicId, from));
      for (const media of rowsOfMedia) {
        await db
          .update(cmsMedia)
          .set({ publicId: moved.publicId, url: withPublicId(media.url, moved.publicId, moved.version), folder: `/products/${move.productId}` })
          .where(eq(cmsMedia.id, media.id));
      }
    }
    revalidatePath('/cms/products');
    revalidatePath('/cms/media');
    revalidatePath('/home', 'layout');
  }
  report.pending = moves.size - report.moved;
  return report;
}

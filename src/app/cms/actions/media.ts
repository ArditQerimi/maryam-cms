'use server';

import { revalidatePath } from 'next/cache';
import { v2 as cloudinary } from 'cloudinary';
import { and, eq } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { cmsMedia } from '@/db/schema-tenant';
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

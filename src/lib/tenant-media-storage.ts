import path from 'path';
import { promises as fs } from 'fs';
import { eq, sql } from 'drizzle-orm';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { getContextCompany } from './tenant';

export type MediaStorageProvider = 'local' | 'cloudinary';

type TenantMediaSettings = {
  provider: MediaStorageProvider;
  localBasePath: string | null;
  cloudinaryCloudName: string | null;
  cloudinaryApiKey: string | null;
  cloudinaryApiSecret: string | null;
  cloudinaryFolder: string | null;
};

type UploadTarget = 'products' | 'profiles';

type UploadOptions = {
  subFolder?: string | null; // e.g. 'Books'
  productSlug?: string | null; // e.g. 'kitabu-teuhid'
  isGallery?: boolean; // if true, puts in 'gallery' subfolder
  galleryIndex?: number; // for naming gallery-01, gallery-02
};

type UploadResult = {
  url: string;
  provider: MediaStorageProvider;
  publicId?: string;
};

const DEFAULT_LOCAL_UPLOAD_BASE = '/uploads';
const DEFAULT_LOCAL_UPLOAD_FILESYSTEM_ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public');
const CONFIGURED_LOCAL_UPLOAD_FILESYSTEM_ROOT = process.env.LOCAL_UPLOAD_FILESYSTEM_ROOT
  ? path.resolve(/*turbopackIgnore: true*/ process.env.LOCAL_UPLOAD_FILESYSTEM_ROOT)
  : DEFAULT_LOCAL_UPLOAD_FILESYSTEM_ROOT;

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function trimOrNull(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function normalizeProvider(value: string | null | undefined): MediaStorageProvider {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'cloudinary') return 'cloudinary';
  return 'local';
}

async function ensureTenantMediaSettingsTable() {
  await masterDb.execute(sql`
    CREATE TABLE IF NOT EXISTS tenant_media_settings (
      id serial PRIMARY KEY,
      company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      provider varchar(20) NOT NULL DEFAULT 'local',
      local_base_path varchar(255),
      cloudinary_cloud_name varchar(120),
      cloudinary_api_key varchar(120),
      cloudinary_api_secret varchar(255),
      cloudinary_folder varchar(255),
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);

  await masterDb.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS tenant_media_settings_company_idx
    ON tenant_media_settings(company_id)
  `);
}

function isMissingMediaSettingsTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { cause?: { code?: string }; code?: string }).cause?.code || (error as { code?: string }).code;
  if (code === '42P01') return true;
  const message = String((error as { message?: string }).message || '').toLowerCase();
  return message.includes('tenant_media_settings') && message.includes('does not exist');
}

async function getTenantMediaSettings(companyId: number): Promise<TenantMediaSettings> {
  try {
    const result = await masterDb.execute(sql`
      SELECT provider, local_base_path, cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret, cloudinary_folder
      FROM tenant_media_settings
      WHERE company_id = ${companyId}
      LIMIT 1
    `);

    const rows = ((result as unknown as { rows?: Array<Record<string, unknown>> }).rows) || [];
    const record = rows[0] || {};

    const provider = normalizeProvider(
      String(process.env.MEDIA_STORAGE_PROVIDER ?? record.provider ?? (process.env.CLOUDINARY_API_KEY ? 'cloudinary' : 'local'))
    );

    return {
      provider,
      localBasePath: trimOrNull(String(record.local_base_path ?? process.env.LOCAL_UPLOAD_BASE_PATH ?? DEFAULT_LOCAL_UPLOAD_BASE)),
      cloudinaryCloudName: trimOrNull(String(record.cloudinary_cloud_name ?? process.env.CLOUDINARY_CLOUD_NAME ?? '')),
      cloudinaryApiKey: trimOrNull(String(record.cloudinary_api_key ?? process.env.CLOUDINARY_API_KEY ?? '')),
      cloudinaryApiSecret: trimOrNull(String(record.cloudinary_api_secret ?? process.env.CLOUDINARY_API_SECRET ?? '')),
      cloudinaryFolder: trimOrNull(String(record.cloudinary_folder ?? process.env.CLOUDINARY_FOLDER ?? 'tenants')),
    };
  } catch (error) {
    if (isMissingMediaSettingsTableError(error)) {
      await ensureTenantMediaSettingsTable();
      return getTenantMediaSettings(companyId);
    }
    throw error;
  }
}

export async function getTenantMediaStorageSettings(companyId: number): Promise<TenantMediaSettings> {
  await ensureTenantMediaSettingsTable();
  return getTenantMediaSettings(companyId);
}

export async function upsertTenantMediaStorageSettings(params: {
  companyId: number;
  provider: MediaStorageProvider;
  localBasePath?: string | null;
  cloudinaryCloudName?: string | null;
  cloudinaryApiKey?: string | null;
  cloudinaryApiSecret?: string | null;
  cloudinaryFolder?: string | null;
}) {
  await ensureTenantMediaSettingsTable();

  await masterDb.execute(sql`
    INSERT INTO tenant_media_settings (
      company_id,
      provider,
      local_base_path,
      cloudinary_cloud_name,
      cloudinary_api_key,
      cloudinary_api_secret,
      cloudinary_folder,
      updated_at
    ) VALUES (
      ${params.companyId},
      ${params.provider},
      ${params.localBasePath ?? null},
      ${params.cloudinaryCloudName ?? null},
      ${params.cloudinaryApiKey ?? null},
      ${params.cloudinaryApiSecret ?? null},
      ${params.cloudinaryFolder ?? null},
      now()
    )
    ON CONFLICT (company_id)
    DO UPDATE SET
      provider = EXCLUDED.provider,
      local_base_path = EXCLUDED.local_base_path,
      cloudinary_cloud_name = EXCLUDED.cloudinary_cloud_name,
      cloudinary_api_key = EXCLUDED.cloudinary_api_key,
      cloudinary_api_secret = EXCLUDED.cloudinary_api_secret,
      cloudinary_folder = EXCLUDED.cloudinary_folder,
      updated_at = now()
  `);
}

async function resolveCompanyContext(companyId?: number) {
  if (companyId && Number.isFinite(companyId)) {
    const company = await masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.id, companyId),
    });
    if (company) return company;
  }

  return getContextCompany();
}

async function uploadToLocal(file: File, companySubdomain: string, target: UploadTarget, localBasePath: string | null): Promise<UploadResult> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name) || '.jpg';
  const baseName = path.basename(file.name, ext);
  const uniqueName = `${Date.now()}-${sanitizeName(baseName)}${ext.toLowerCase()}`;

  const normalizedBase = localBasePath || DEFAULT_LOCAL_UPLOAD_BASE;
  const relativeDir = normalizedBase.replace(/^\/+/, '').replace(/\/+$/, '');
  const filesystemRoot = path.resolve(
    /*turbopackIgnore: true*/ CONFIGURED_LOCAL_UPLOAD_FILESYSTEM_ROOT,
  );
  const uploadsDir = path.resolve(
    /*turbopackIgnore: true*/ filesystemRoot,
    relativeDir,
    companySubdomain,
    target,
  );
  if (!uploadsDir.startsWith(`${filesystemRoot}${path.sep}`)) {
    throw new Error('Invalid local upload directory.');
  }
  await fs.mkdir(uploadsDir, { recursive: true });

  const absolutePath = path.join(/*turbopackIgnore: true*/ uploadsDir, uniqueName);
  await fs.writeFile(absolutePath, buffer);

  return {
    provider: 'local',
    url: `/${relativeDir}/${companySubdomain}/${target}/${uniqueName}`,
  };
}

export async function deleteTenantImage(params: {
  url: string;
  companyId?: number;
}) {
  const company = await resolveCompanyContext(params.companyId);
  if (!company) return;

  const settings = await getTenantMediaSettings(company.id);
  if (settings.provider === 'cloudinary') {
    // Extract public_id from URL
    // Cloudinary URL: https://res.cloudinary.com/[cloud]/image/upload/v[version]/[public_id].[ext]
    const parts = params.url.split('/upload/');
    if (parts.length < 2) return;
    
    const afterUpload = parts[1];
    // Remove version prefix (v1234567890/) if present
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    const publicId = withoutVersion.replace(/\.[^.]+$/, ''); // Remove extension

    if (!settings.cloudinaryCloudName || !settings.cloudinaryApiKey || !settings.cloudinaryApiSecret) return;

    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: settings.cloudinaryCloudName,
      api_key: settings.cloudinaryApiKey,
      api_secret: settings.cloudinaryApiSecret,
    });

    try {
      await cloudinary.uploader.destroy(publicId);
      console.log('Cloudinary Delete Success:', publicId);
    } catch (err) {
      console.warn('Failed to delete from Cloudinary:', publicId, err);
    }
  } else {
    // Local delete
    const filesystemRoot = path.resolve(
      /*turbopackIgnore: true*/ CONFIGURED_LOCAL_UPLOAD_FILESYSTEM_ROOT,
    );
    const absolutePath = path.resolve(
      /*turbopackIgnore: true*/ filesystemRoot,
      params.url.replace(/^[/\\]+/, ''),
    );
    if (!absolutePath.startsWith(`${filesystemRoot}${path.sep}`)) {
      console.warn('Refused to delete a local file outside the upload root.');
      return;
    }
    try {
      await fs.unlink(absolutePath);
    } catch (err) {
      console.warn('Failed to delete local file:', absolutePath, err);
    }
  }
}

async function uploadToCloudinary(
  file: File,
  companySubdomain: string,
  target: UploadTarget,
  settings: TenantMediaSettings,
  options?: UploadOptions
): Promise<UploadResult> {
  if (!settings.cloudinaryCloudName || !settings.cloudinaryApiKey || !settings.cloudinaryApiSecret) {
    throw new Error('Missing Cloudinary credentials for this tenant.');
  }

  // Use official Cloudinary SDK — handles all auth/signing internally
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config({
    cloud_name: settings.cloudinaryCloudName,
    api_key: settings.cloudinaryApiKey,
    api_secret: settings.cloudinaryApiSecret,
  });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;

  // Folder structure: [Base]/[Tenant]/[Category]/[ProductSlug]/[gallery]
  const baseFolder = settings.cloudinaryFolder || 'tenants';
  const categoryFolder = options?.subFolder ? slugify(String(options.subFolder)) : target;
  const productFolder = options?.productSlug ? slugify(String(options.productSlug)) : '';
  const galleryPart = options?.isGallery ? '/gallery' : '';

  const folder = `${baseFolder}/${companySubdomain}/${categoryFolder}${productFolder ? `/${productFolder}` : ''}${galleryPart}`;
  
  // Public ID: [ProductSlug]-[main|gallery-XX]
  const ext = path.extname(file.name) || '.jpg';
  const baseName = path.basename(file.name, ext);
  let publicId = sanitizeName(baseName);

  if (options?.productSlug) {
    const slug = slugify(options.productSlug);
    const mainOrGallery = options.isGallery ? 'gallery' : 'main';
    const indexPart = options.galleryIndex !== undefined ? `-${String(options.galleryIndex).padStart(2, '0')}` : '';
    publicId = `${slug}-${mainOrGallery}${indexPart}`;
  }

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: publicId,
    overwrite: true,
    resource_type: 'image',
  });

  console.log('Cloudinary Upload Success:', result.secure_url);

  return {
    provider: 'cloudinary',
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function uploadTenantImage(params: {
  file: File;
  target: UploadTarget;
  companyId?: number;
  options?: UploadOptions;
}): Promise<UploadResult> {
  const company = await resolveCompanyContext(params.companyId);
  if (!company) {
    throw new Error('Unable to resolve tenant company context for media upload.');
  }

  await ensureTenantMediaSettingsTable();
  const settings = await getTenantMediaSettings(company.id);

  if (settings.provider === 'local') {
    return uploadToLocal(params.file, company.subdomain, params.target, settings.localBasePath);
  }

  return uploadToCloudinary(params.file, company.subdomain, params.target, settings, params.options);
}

export async function createTenantCloudinaryFolders(companyId: number) {
  const company = await masterDb.query.companies.findFirst({ where: eq(masterSchema.companies.id, companyId) });
  if (!company) throw new Error('Company not found');

  const settings = await getTenantMediaSettings(companyId);
  if (!settings.cloudinaryCloudName || !settings.cloudinaryApiKey || !settings.cloudinaryApiSecret) {
    console.log('Cloudinary not configured for company, skipping folder creation');
    return;
  }

  const baseFolder = `${settings.cloudinaryFolder || 'tenants'}/${company.subdomain}`;
  const desired = ['books', 'supplements', 'profiles', 'products', 'bundles'];

  const auth = Buffer.from(`${settings.cloudinaryApiKey}:${settings.cloudinaryApiSecret}`).toString('base64');

  for (const sub of desired) {
    const pathToCreate = `${baseFolder}/${sub}`;
    try {
      const resp = await fetch(`https://api.cloudinary.com/v1_1/${settings.cloudinaryCloudName}/folders`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: pathToCreate }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        // Cloudinary may return 409 if folder exists; ignore non-fatal errors
        if (!text.includes('already exists') && resp.status !== 409) {
          console.warn(`Failed to create Cloudinary folder ${pathToCreate}: ${text}`);
        }
      }
    } catch (err) {
      console.warn(`Error creating Cloudinary folder ${pathToCreate}:`, err);
    }
  }
}

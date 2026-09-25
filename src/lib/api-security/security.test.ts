import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  getTenantCloudinaryFolderRoot,
  signCloudinaryParams,
  validateCloudinaryUploadParams,
} from './cloudinary';
import { ImageValidationError, validateAndNormalizeImage } from './image';
import { SpreadsheetValidationError, validateAndNormalizeSpreadsheet } from './spreadsheet';
import { requireDevelopmentPlatformSuperAdmin } from './auth';

function pngBytes(width = 1, height = 1) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

test('debug authorization is unavailable in production before session loading', async () => {
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnvironment.NODE_ENV;
  const previousSecret = mutableEnvironment.SESSION_SECRET;
  mutableEnvironment.NODE_ENV = 'production';
  delete mutableEnvironment.SESSION_SECRET;

  try {
    const result = await requireDevelopmentPlatformSuperAdmin();
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 404);
      assert.match(result.response.headers.get('cache-control') || '', /no-store/);
    }
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnvironment.NODE_ENV;
    else mutableEnvironment.NODE_ENV = previousNodeEnv;
    if (previousSecret === undefined) delete mutableEnvironment.SESSION_SECRET;
    else mutableEnvironment.SESSION_SECRET = previousSecret;
  }
});

test('image validation accepts a matching PNG and derives a safe extension', async () => {
  const result = await validateAndNormalizeImage(
    new File([pngBytes()], 'not-an-image.txt', { type: 'image/png' }),
  );

  assert.equal(result.mime, 'image/png');
  assert.equal(result.extension, 'png');
  assert.equal(result.file.name, 'upload.png');
  assert.equal(result.file.type, 'image/png');
  assert.equal(result.width, 1);
  assert.equal(result.height, 1);
});

test('image validation rejects a declared type that does not match the bytes', async () => {
  await assert.rejects(
    validateAndNormalizeImage(new File([pngBytes()], 'image.jpg', { type: 'image/jpeg' })),
    (error: unknown) => error instanceof ImageValidationError && error.status === 400,
  );
});

test('image validation rejects dimensions over the pixel cap', async () => {
  await assert.rejects(
    validateAndNormalizeImage(new File([pngBytes(10_001, 1)], 'huge.png', { type: 'image/png' })),
    (error: unknown) => error instanceof ImageValidationError && /dimensions/i.test(error.message),
  );
});

test('Cloudinary folder roots are tenant-specific and traversal is rejected', () => {
  assert.equal(getTenantCloudinaryFolderRoot('tenants', 'acme'), 'tenants/acme');
  assert.equal(getTenantCloudinaryFolderRoot('tenants/acme', 'acme'), 'tenants/acme');

  const valid = validateCloudinaryUploadParams({
    timestamp: '1700000000',
    folder: 'tenants/acme/products/book',
    resource_type: 'image',
    public_id: 'book-main',
  }, 'tenants/acme');
  assert.ok(valid);

  assert.equal(validateCloudinaryUploadParams({
    timestamp: '1700000000',
    folder: 'tenants/other/products/book',
    resource_type: 'image',
  }, 'tenants/acme'), null);
  assert.equal(validateCloudinaryUploadParams({
    timestamp: '1700000000',
    folder: 'tenants/acme/../other',
    resource_type: 'image',
  }, 'tenants/acme'), null);
  assert.equal(validateCloudinaryUploadParams({
    timestamp: '1700000000',
    folder: 'tenants/acme/products/book',
    resource_type: 'video',
  }, 'tenants/acme'), null);
});

test('spreadsheet validation derives a safe filename from the file signature', async () => {
  const result = await validateAndNormalizeSpreadsheet(new File(
    [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])],
    'anything.exe',
    { type: 'application/octet-stream' },
  ));

  assert.equal(result.kind, 'xlsx');
  assert.equal(result.file.name, 'products.xlsx');
});

test('spreadsheet validation rejects non-Excel content', async () => {
  await assert.rejects(
    validateAndNormalizeSpreadsheet(new File(['not an excel file'], 'products.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })),
    (error: unknown) => error instanceof SpreadsheetValidationError,
  );
});

test('Cloudinary signatures are deterministic and do not include unapproved parameters', () => {
  const params = {
    folder: 'tenants/acme/products/book',
    resource_type: 'image',
    timestamp: '1700000000',
  };
  const expected = createHash('sha1')
    .update('folder=tenants/acme/products/book&resource_type=image&timestamp=1700000000secret')
    .digest('hex');

  assert.equal(signCloudinaryParams(params, 'secret'), expected);
  assert.equal(validateCloudinaryUploadParams({
    ...params,
    notification_url: 'https://attacker.example/collect',
  }, 'tenants/acme'), null);
});

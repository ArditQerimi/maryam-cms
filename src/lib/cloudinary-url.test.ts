import assert from 'node:assert/strict';
import test from 'node:test';
import { originalUrl, parseCloudinaryUrl, readCrop, withCrop, withPublicId } from './cloudinary-url';

const plain = 'https://res.cloudinary.com/demo/image/upload/v1792498989/tenants/arditi/cms/products/42/abc123.jpg';
const cropped = 'https://res.cloudinary.com/demo/image/upload/c_crop,x_10,y_20,w_300,h_400/v1792498989/tenants/arditi/cms/products/42/abc123.jpg';

test('parses version, folder path, extension and transformations', () => {
  const parts = parseCloudinaryUrl(cropped)!;
  assert.equal(parts.cloud, 'demo');
  assert.deepEqual(parts.transformations, ['c_crop,x_10,y_20,w_300,h_400']);
  assert.equal(parts.version, '1792498989');
  assert.equal(parts.publicId, 'tenants/arditi/cms/products/42/abc123');
  assert.equal(parts.ext, '.jpg');
  assert.equal(parseCloudinaryUrl('https://example.com/a.jpg'), null);
  assert.equal(parseCloudinaryUrl('/uploads/a.jpg'), null);
});

test('a folder that looks like a transformation is still part of the path', () => {
  const parts = parseCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/my_books/cover.png')!;
  assert.deepEqual(parts.transformations, []);
  assert.equal(parts.publicId, 'my_books/cover');
});

test('crop: added, read back, replaced (always from the original)', () => {
  const once = withCrop(plain, { x: 10.4, y: 20, width: 300, height: 399.6 });
  assert.equal(once, cropped);
  assert.deepEqual(readCrop(once), { x: 10, y: 20, width: 300, height: 400 });
  const twice = withCrop(once, { x: 0, y: 0, width: 50, height: 50 });
  assert.equal(twice, plain.replace('/upload/', '/upload/c_crop,x_0,y_0,w_50,h_50/'));
  assert.equal(originalUrl(twice), plain);
  assert.equal(readCrop(plain), null);
  assert.equal(withCrop('/uploads/a.jpg', { x: 0, y: 0, width: 1, height: 1 }), '/uploads/a.jpg');
});

test('moving a photo keeps its crop', () => {
  const moved = withPublicId(cropped, 'tenants/elifstore/cms/products/koment-i-akides/abc123', 1800000000);
  assert.equal(
    moved,
    'https://res.cloudinary.com/demo/image/upload/c_crop,x_10,y_20,w_300,h_400/v1800000000/tenants/elifstore/cms/products/koment-i-akides/abc123.jpg',
  );
});

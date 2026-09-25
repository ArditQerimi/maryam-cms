import assert from 'node:assert/strict';
import test from 'node:test';
import { parseImageUrl } from './image-url';

test('parses a legacy Cloudinary-style JSON media array', () => {
  const raw = JSON.stringify([{ src: 'https://cdn.example.com/catalog/book.jpg' }]);
  assert.equal(parseImageUrl(raw), 'https://cdn.example.com/catalog/book.jpg');
});

test('accepts root-relative and HTTP(S) image URLs', () => {
  assert.equal(parseImageUrl('/uploads/book.jpg'), '/uploads/book.jpg');
  assert.equal(
    parseImageUrl('https://cdn.example.com/book.jpg?width=600'),
    'https://cdn.example.com/book.jpg?width=600',
  );
});

test('rejects executable, credential-bearing, and protocol-relative URLs', () => {
  assert.equal(parseImageUrl('javascript:alert(1)'), '');
  assert.equal(parseImageUrl('data:image/svg+xml,<svg onload=alert(1)>'), '');
  assert.equal(parseImageUrl('//cdn.example.com/book.jpg'), '');
  assert.equal(parseImageUrl('https://user:pass@cdn.example.com/book.jpg'), '');
});

test('uses only a safe fallback', () => {
  assert.equal(parseImageUrl('not a URL', '/uploads/fallback.jpg'), '/uploads/fallback.jpg');
  assert.equal(parseImageUrl('not a URL', 'javascript:alert(1)'), '');
});

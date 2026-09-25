import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSafeImageUrl,
  parseEditorPayload,
  parseSafeBlogContent,
  serializeEditorPayload,
  serializeSafeBlogContent,
  slugify,
  type BlogContentBlock,
} from './content';

const storyBlocks: BlogContentBlock[] = [
  { type: 'heading', text: 'A safer editorial workflow', url: '', alt: '' },
  { type: 'paragraph', text: 'Readers get useful, structured content.', url: '', alt: '' },
  { type: 'quote', text: 'Good books deserve a thoughtful shelf.', url: '', alt: '' },
  { type: 'image', text: 'A quiet reading corner', url: 'https://images.example/story.jpg', alt: 'Reading corner' },
];

test('slugify creates bounded, URL-safe values', () => {
  assert.equal(slugify('  Shëtitja & Libra — 2026!  '), 'shetitja-libra-2026');
  assert.equal(slugify('***').length <= 120, true);
});

test('image URL validation rejects unsafe schemes and protocol-relative paths', () => {
  assert.equal(getSafeImageUrl('/images/story.jpg'), '/images/story.jpg');
  assert.equal(getSafeImageUrl('https://images.example/story.jpg'), 'https://images.example/story.jpg');
  assert.equal(getSafeImageUrl('//evil.example/story.jpg'), null);
  assert.equal(getSafeImageUrl('javascript:alert(1)'), null);
  assert.equal(getSafeImageUrl('data:image/png;base64,AAAA'), null);
  assert.equal(getSafeImageUrl('https://user:pass@example.com/story.jpg'), null);
  assert.equal(getSafeImageUrl('/safe\\evil.jpg'), null);
});

test('editor payload round-trips only the supported block contract', () => {
  const payload = serializeEditorPayload(storyBlocks);
  assert.deepEqual(parseEditorPayload(payload), storyBlocks);
  assert.throws(() => parseEditorPayload('{bad json'), /invalid/i);
});

test('content serialization emits the storefront-safe subset and escapes text', () => {
  const html = serializeSafeBlogContent([
    ...storyBlocks,
    { type: 'paragraph', text: '<script>alert(1)</script> & useful text', url: '', alt: '' },
    { type: 'image', text: '', url: 'javascript:alert(1)', alt: 'unsafe' },
  ]);

  assert.match(html, /<h2>A safer editorial workflow<\/h2>/);
  assert.match(html, /<blockquote><p>Good books deserve a thoughtful shelf\.<\/p><\/blockquote>/);
  assert.match(html, /<figure><img src="https:\/\/images\.example\/story\.jpg" alt="Reading corner">/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('legacy storefront markup is reduced to editable safe blocks', () => {
  const blocks = parseSafeBlogContent(
    '<h2 style="color:red">Chapter</h2><p onclick="bad()">Hello <strong>reader</strong>.</p><blockquote>Quote</blockquote><figure><img src="javascript:bad" onerror="bad()"><figcaption>Unsafe</figcaption></figure>',
  );

  assert.deepEqual(blocks, [
    { type: 'heading', text: 'Chapter', url: '', alt: '' },
    { type: 'paragraph', text: 'Hello reader .', url: '', alt: '' },
    { type: 'quote', text: 'Quote', url: '', alt: '' },
  ]);
  assert.doesNotMatch(serializeSafeBlogContent(blocks), /style=|onclick|onerror|javascript:/i);
});

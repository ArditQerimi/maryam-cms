import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeEditorPayload } from './content';
import {
  BlogValidationError,
  validateBlogPostForm,
  validateDeleteConfirmation,
} from './validation';

function validForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const values: Record<string, string> = {
    title: 'A Safer Reading Routine',
    slug: 'a-safer-reading-routine',
    authorName: 'Elif Editorial',
    categoryId: '',
    tags: 'reading, routine',
    excerpt: 'A practical guide for a calmer reading habit.',
    coverImageUrl: 'https://images.example/cover.jpg',
    status: 'Published',
    publishedAt: '2025-01-15T10:30',
    contentBlocks: serializeEditorPayload([
      { type: 'heading', text: 'Make space for the story', url: '', alt: '' },
      { type: 'paragraph', text: 'Choose a comfortable place and begin.', url: '', alt: '' },
    ]),
    ...overrides,
  };

  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

test('valid post form is normalized into a bounded editorial payload', () => {
  const result = validateBlogPostForm(validForm());
  assert.equal(result.title, 'A Safer Reading Routine');
  assert.equal(result.slug, 'a-safer-reading-routine');
  assert.equal(result.status, 'Published');
  assert.deepEqual(result.tagNames, ['reading', 'routine']);
  assert.equal(result.coverImageUrl, 'https://images.example/cover.jpg');
  assert.match(result.content, /^<h2>Make space for the story<\/h2><p>Choose a comfortable place and begin\.<\/p>$/);
  assert.equal(result.publishedAt?.toISOString(), '2025-01-15T10:30:00.000Z');
});

test('drafts clear publish date and malformed image URLs are rejected', () => {
  const result = validateBlogPostForm(validForm({ status: 'Draft' }));
  assert.equal(result.publishedAt, null);

  assert.throws(
    () => validateBlogPostForm(validForm({ coverImageUrl: 'data:image/png;base64,AAAA' })),
    (error: unknown) => error instanceof BlogValidationError && Boolean(error.fieldErrors.coverImageUrl),
  );
});

test('future publication is rejected while script text is escaped', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  assert.throws(
    () => validateBlogPostForm(validForm({ publishedAt: future })),
    (error: unknown) => error instanceof BlogValidationError && Boolean(error.fieldErrors.publishedAt),
  );

  const safe = validateBlogPostForm(validForm({
    contentBlocks: serializeEditorPayload([
      { type: 'paragraph', text: '<script>alert(1)</script>', url: '', alt: '' },
      { type: 'image', text: '', url: '/images/story.jpg', alt: 'Story' },
    ]),
  }));
  assert.doesNotMatch(safe.content, /<script/i);
  assert.match(safe.content, /&lt;script&gt;/);
});

test('delete confirmation requires a positive post id and title', () => {
  const form = new FormData();
  form.set('postId', '42');
  form.set('confirmation', 'A title');
  assert.deepEqual(validateDeleteConfirmation(form), { postId: 42, confirmation: 'A title' });

  form.set('postId', '-1');
  assert.throws(() => validateDeleteConfirmation(form), BlogValidationError);
});

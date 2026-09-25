import {
  BLOG_CONTENT_LIMITS,
  getBlogContentPlainText,
  getSafeImageUrl,
  normalizeBlockText,
  parseEditorPayload,
  serializeSafeBlogContent,
  slugify,
  type BlogContentBlock,
} from './content';
import type { BlogPublicationStatus } from './types';

export const BLOG_FIELD_LIMITS = {
  title: 180,
  slug: 120,
  author: 120,
  excerpt: 320,
  tags: 12,
  tagName: 40,
  imageUrl: BLOG_CONTENT_LIMITS.maxImageUrl,
} as const;

export type BlogPostField = keyof BlogPostActionFieldErrors;

export type BlogPostActionFieldErrors = Partial<Record<
  | 'title'
  | 'slug'
  | 'author'
  | 'categoryId'
  | 'tags'
  | 'excerpt'
  | 'coverImageUrl'
  | 'content'
  | 'status'
  | 'publishedAt'
  | 'confirmation',
  string
>>;

export type ValidatedBlogPostInput = {
  categoryId: number | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  authorName: string;
  coverImageUrl: string | null;
  status: BlogPublicationStatus;
  publishedAt: Date | null;
  tagNames: string[];
};

export class BlogValidationError extends Error {
  readonly fieldErrors: BlogPostActionFieldErrors;

  constructor(fieldErrors: BlogPostActionFieldErrors) {
    super('Please correct the highlighted blog fields.');
    this.name = 'BlogValidationError';
    this.fieldErrors = fieldErrors;
  }
}

function readString(formData: FormData, name: string, maxRawLength = 100_000): string {
  const value = formData.get(name);
  if (value === null) return '';
  if (typeof value !== 'string') {
    throw new BlogValidationError({ [name]: 'Invalid form value.' });
  }
  if (value.length > maxRawLength) {
    throw new BlogValidationError({ [name]: 'This value is too long.' });
  }
  return value;
}

function normalizeSingleLine(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
}

export function parsePositiveInteger(value: unknown): number | null {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d{1,12}$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(candidate) && candidate > 0 ? candidate : null;
}

function parseTags(value: string, errors: BlogPostActionFieldErrors): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const rawTag of value.split(/[,\n]/)) {
    const tag = normalizeSingleLine(rawTag);
    if (!tag) continue;
    if (tag.length > BLOG_FIELD_LIMITS.tagName) {
      errors.tags = `Each tag must be ${BLOG_FIELD_LIMITS.tagName} characters or fewer.`;
      continue;
    }
    const key = tag.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }

  if (tags.length > BLOG_FIELD_LIMITS.tags) {
    errors.tags = `Use no more than ${BLOG_FIELD_LIMITS.tags} tags.`;
  }

  return tags.slice(0, BLOG_FIELD_LIMITS.tags);
}

function validateContent(rawPayload: string, errors: BlogPostActionFieldErrors): { blocks: BlogContentBlock[]; html: string } {
  let blocks: BlogContentBlock[];
  try {
    blocks = parseEditorPayload(rawPayload);
  } catch {
    errors.content = 'The content blocks could not be read. Refresh the page and try again.';
    return { blocks: [], html: '' };
  }

  let meaningfulBlocks = 0;
  blocks.forEach((block, index) => {
    if (block.type === 'image') {
      if (!getSafeImageUrl(block.url)) {
        errors.content = `Image block ${index + 1} needs a root-relative path or a valid HTTP(S) URL.`;
      }
      if (block.alt.length > BLOG_CONTENT_LIMITS.maxAlt) {
        errors.content = `Image block ${index + 1} has alt text longer than ${BLOG_CONTENT_LIMITS.maxAlt} characters.`;
      }
      if (block.text.length > BLOG_CONTENT_LIMITS.maxCaption) {
        errors.content = `Image block ${index + 1} has a caption longer than ${BLOG_CONTENT_LIMITS.maxCaption} characters.`;
      }
      if (getSafeImageUrl(block.url)) meaningfulBlocks += 1;
      return;
    }

    if (block.text.length > BLOG_CONTENT_LIMITS.maxTextPerBlock) {
      errors.content = `Content block ${index + 1} is too long.`;
    }
    if (normalizeBlockText(block.text)) meaningfulBlocks += 1;
  });

  const html = serializeSafeBlogContent(blocks);
  if (meaningfulBlocks === 0 && !errors.content) {
    errors.content = 'Add at least one paragraph, heading, quote, or image block.';
  }
  if (html.length > BLOG_CONTENT_LIMITS.maxCharacters && !errors.content) {
    errors.content = `Keep the story under ${BLOG_CONTENT_LIMITS.maxCharacters.toLocaleString('en-US')} characters.`;
  }

  return { blocks, html };
}

function parsePublishDate(value: string, status: BlogPublicationStatus, errors: BlogPostActionFieldErrors): Date | null {
  if (status === 'Draft') return null;
  if (!value.trim()) return new Date();

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value.trim())) {
    errors.publishedAt = 'Enter a valid publish date and time.';
    return null;
  }

  const normalized = value.trim().length === 16 ? `${value.trim()}:00Z` : `${value.trim()}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    errors.publishedAt = 'Enter a valid publish date and time.';
    return null;
  }
  if (parsed.getTime() > Date.now() + 5_000) {
    errors.publishedAt = 'A published post cannot have a future date. Save it as a draft instead.';
  }

  return parsed;
}

export function validateBlogPostForm(formData: FormData): ValidatedBlogPostInput {
  const errors: BlogPostActionFieldErrors = {};

  const title = normalizeSingleLine(readString(formData, 'title', 2_000));
  if (!title) errors.title = 'Enter a post title.';
  else if (title.length > BLOG_FIELD_LIMITS.title) {
    errors.title = `Keep the title under ${BLOG_FIELD_LIMITS.title} characters.`;
  }

  const rawSlug = readString(formData, 'slug', 500).trim();
  const slug = slugify(rawSlug || title);
  if (rawSlug && (rawSlug.toLowerCase().includes('://') || !slug)) {
    errors.slug = 'Use letters, numbers, and hyphens only.';
  }

  const authorName = normalizeSingleLine(readString(formData, 'authorName', 1_000));
  if (!authorName) errors.author = 'Enter an author.';
  else if (authorName.length > BLOG_FIELD_LIMITS.author) {
    errors.author = `Keep the author under ${BLOG_FIELD_LIMITS.author} characters.`;
  }

  const rawCategory = readString(formData, 'categoryId', 32).trim();
  let categoryId: number | null = null;
  if (rawCategory) {
    categoryId = parsePositiveInteger(rawCategory);
    if (!categoryId) errors.categoryId = 'Choose a valid category.';
  }

  const tagNames = parseTags(readString(formData, 'tags', 4_000), errors);

  let excerpt = normalizeSingleLine(readString(formData, 'excerpt', 4_000));
  if (excerpt.length > BLOG_FIELD_LIMITS.excerpt) {
    errors.excerpt = `Keep the excerpt under ${BLOG_FIELD_LIMITS.excerpt} characters.`;
    excerpt = excerpt.slice(0, BLOG_FIELD_LIMITS.excerpt);
  }

  const rawCover = readString(formData, 'coverImageUrl', 4_000).trim();
  let coverImageUrl: string | null = null;
  if (rawCover) {
    coverImageUrl = getSafeImageUrl(rawCover);
    if (!coverImageUrl) {
      errors.coverImageUrl = 'Use a root-relative path or a valid HTTP(S) image URL without credentials.';
    }
  }

  const rawStatus = readString(formData, 'status', 32);
  const status: BlogPublicationStatus = rawStatus === 'Published' ? 'Published' : 'Draft';
  if (rawStatus !== 'Draft' && rawStatus !== 'Published') errors.status = 'Choose Draft or Published.';

  const { html: content } = validateContent(readString(formData, 'contentBlocks', 500_000), errors);
  if (!excerpt && content && !errors.excerpt) {
    const plain = getBlogContentPlainText(content).replace(/\s+/g, ' ').trim();
    excerpt = plain.length > 280 ? `${plain.slice(0, 277).replace(/\s+\S*$/, '')}…` : plain;
  }

  const publishedAt = parsePublishDate(readString(formData, 'publishedAt', 64), status, errors);

  if (Object.keys(errors).length > 0) throw new BlogValidationError(errors);

  return {
    categoryId,
    title,
    slug,
    excerpt,
    content,
    authorName,
    coverImageUrl,
    status,
    publishedAt,
    tagNames,
  };
}

export function validateDeleteConfirmation(formData: FormData): { postId: number; confirmation: string } {
  const errors: BlogPostActionFieldErrors = {};
  const postId = parsePositiveInteger(readString(formData, 'postId', 32));
  const confirmation = readString(formData, 'confirmation', 500);
  if (!postId) errors.confirmation = 'The selected post is invalid.';
  if (!confirmation.trim()) errors.confirmation = 'Type the post title to confirm deletion.';
  if (Object.keys(errors).length > 0) throw new BlogValidationError(errors);
  return { postId: postId as number, confirmation };
}

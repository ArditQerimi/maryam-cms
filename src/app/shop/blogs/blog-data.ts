import { cache } from 'react';
import { parseImageUrl } from '@/lib/image-url';
import { getPublicBlogPostRecords } from '@/lib/storefront/blogs';

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  publishedAt: string;
  category: string;
  tags: string[];
  image: string;
  readingMinutes: number;
  status: string;
  featured: boolean;
};

const DEFAULT_IMAGE = '/auth-illustration.png';

/**
 * These stories are the small editorial set that originally lived in
 * BookstoreBlog. Keeping a local copy means the storefront remains useful
 * when the optional CMS connection is unavailable, without changing that
 * shared component.
 */
export const FALLBACK_BLOG_POSTS: BlogPost[] = [
  {
    id: 'editorial-family-library',
    slug: 'si-te-krijoni-nje-bibliotek-familjare',
    title: 'Si të krijoni një bibliotekë familjare të fortë',
    excerpt:
      'Këshilla të thjeshta për të zgjedhur libra që i mbajnë shpirtërhëniet të lidhura dhe lexohen me gëzim.',
    content: `Një bibliotekë familjare nuk ka nevojë të jetë e madhe. Ajo fillon me zgjedhje të përgatitura dhe me kohë të lehtë për t'u gjetur.

Merrni parasysh interesat e secilit anëtar të familjes, por mos harroni të lini hapësirë edhe për libra që mund t'i zgjidhni së bashku. Një raft i dedikuar për çdo person i bën bibliotekën më të personalizuar dhe më të gjallë.

Më në fund, vendosni librat në vende ku fëmijët t'i shohin lehtë. Një kënd i qetë, një dysheme e papërdorur dhe një karrige komode janë më shumë se të mjaftueshme për të filluar.`,
    authorName: 'Ekipi Elif',
    publishedAt: '2026-02-15T00:00:00.000Z',
    category: 'Familja',
    tags: ['Familja', 'Këshilla', 'Libra'],
    image:
      'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=85',
    readingMinutes: 5,
    status: 'Active',
    featured: true,
  },
  {
    id: 'editorial-before-thirty',
    slug: 'librat-qe-duhet-lexuar-para-30',
    title: "Pesë libra që duhet t’i lexoni para të tridhjetave",
    excerpt:
      'Zgjedhje të kujdesshme për ata që duan të ndërtojnë një rutinë të leximit që zgjat për vite.',
    content: `Leximi nuk është një garë dhe nuk ka një listë të vetme të përshtatshme për të gjithë. Megjithatë, disa libra janë shumë të mirë për të filluar një rutinë të re.

Kërkoni libra që ofrojnë një ide të qartë, një histori interesante dhe hapësira për të menduar. Mos e matni veten me numrin e faqeve: rëndësia e vetëm është të gjeni librin që ju kthen te pyetjet më të mira.

Lexoni pak çdo ditë dhe shënojeni një mendim ose një citat që ju ngjiti. Pas pak muajsh, do të keni një bibliotekë personale që pasqyron udhëtimin tuaj.`,
    authorName: 'Ekipi Elif',
    publishedAt: '2026-02-02T00:00:00.000Z',
    category: 'Rekomandim',
    tags: ['Rekomandim', 'Lexim', 'Libra'],
    image:
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=85',
    readingMinutes: 4,
    status: 'Active',
    featured: false,
  },
  {
    id: 'editorial-classics-contemporary',
    slug: 'nga-klasika-te-bashkekohoret',
    title: 'Nga klasika te bashkëkohoret: një udhëtim i shkurtër',
    excerpt:
      'Një udhëtim i butë nga klasikët te librat e sotëm, për ata që duan të zbulojnë lidhjet mes tyre.',
    content: `Librat e klasikëve dhe shkronjet bashkëkohorëse nuk duhet të konkurrrojnë njëri-tjetrin. Secili hap një dritare të ndryshme për kulturën, historinë dhe përvojën tonë.

Provoni të filloni me një klasik që ju kthen te pyetja të mëdha, pastaj kërkoni një autor bashkëkohor që i jep përgjigje të tjera. Kjo krijon një dialog të natyrshëm ndërmjet brezave.

Mbani shënime për frazat që ju ngjajnë. Është një mënyrë e thjeshtë për të kthyer leximin nga detyrë në përvojë të përbashkët.`,
    authorName: 'Ekipi Elif',
    publishedAt: '2026-01-20T00:00:00.000Z',
    category: 'Ese',
    tags: ['Ese', 'Klasikë', 'Kulturë'],
    image:
      'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1200&q=85',
    readingMinutes: 6,
    status: 'Active',
    featured: false,
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function cleanText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(value: string): string {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toIsoDate(value: unknown, fallback = new Date()): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return fallback.toISOString();
}

function makeExcerpt(content: string, fallback = ''): string {
  const text = cleanText(content);
  if (!text) return fallback;
  if (text.length <= 190) return text;
  return `${text.slice(0, 187).replace(/\s+\S*$/, '')}…`;
}

export function getReadingMinutes(content: string, explicitValue?: unknown): number {
  const explicit = asNumber(explicitValue, 0);
  if (explicit) return Math.max(1, Math.round(explicit));
  const words = cleanText(content).split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.ceil(words / 210));
}

function readImage(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    const raw = value.trim();
    try {
      const parsed: unknown = JSON.parse(raw);
      return readImage(parsed);
    } catch {
      return raw;
    }
  }

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' || asRecord(item));
    return first ? readImage(first) : '';
  }

  const record = asRecord(value);
  if (record) return asString(record.src) || asString(record.url) || asString(record.imageUrl);

  return '';
}

function readCategory(record: Record<string, unknown>): string {
  const category = record.category;
  const categoryRecord = asRecord(category);
  return (
    asString(categoryRecord?.name) ||
    asString(record.categoryName) ||
    (typeof category === 'string' ? category.trim() : '') ||
    'Journal'
  );
}

function pushUnique(values: string[], value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return;
  const normalized = text.toLocaleLowerCase();
  if (!values.some((item) => item.toLocaleLowerCase() === normalized)) values.push(text);
}

function readTags(record: Record<string, unknown>): string[] {
  const tags: string[] = [];

  const tagLinks = record.tagLinks;
  if (Array.isArray(tagLinks)) {
    for (const link of tagLinks) {
      const linkRecord = asRecord(link);
      const tagRecord = asRecord(linkRecord?.tag);
      pushUnique(tags, tagRecord?.name ?? (typeof link === 'string' ? link : undefined));
    }
  }

  const rawTags = record.tags ?? record.tagNames;
  if (Array.isArray(rawTags)) {
    for (const tag of rawTags) {
      const tagRecord = asRecord(tag);
      pushUnique(tags, tagRecord?.name ?? (typeof tag === 'string' ? tag : undefined));
    }
  } else if (typeof rawTags === 'string') {
    for (const tag of rawTags.split(',')) pushUnique(tags, tag);
  }

  return tags.filter(Boolean);
}

function normalizePost(rawValue: unknown, index: number): BlogPost | null {
  const record = asRecord(rawValue);
  if (!record) return null;

  const title = asString(record.title);
  const slug = slugify(asString(record.slug) || title);
  if (!title || !slug) return null;

  const content = asString(record.content);
  const excerpt = asString(record.excerpt) || makeExcerpt(content, 'Read the latest story from the Elif journal.');
  const category = readCategory(record);
  const tags = readTags(record);
  const image = parseImageUrl(
    readImage(record.coverImageUrl) ||
    readImage(record.coverImage) ||
    readImage(record.imageUrl) ||
    readImage(record.image) ||
    readImage(record.featuredImage),
    DEFAULT_IMAGE,
  );
  const publishedAt = toIsoDate(record.publishedAt ?? record.createdAt, new Date(0));

  return {
    id: asString(record.id, `${slug}-${index}`),
    slug,
    title,
    excerpt,
    content: content || excerpt,
    authorName: asString(record.authorName, 'Elif Editorial'),
    publishedAt,
    category,
    tags,
    image,
    readingMinutes: getReadingMinutes(content || excerpt, record.readingTime ?? record.readTime),
    status: asString(record.status, 'Active'),
    featured: record.featured === true,
  };
}

function isPublicPost(post: BlogPost): boolean {
  const status = post.status.toLocaleLowerCase();
  if (status && !['active', 'published', 'live'].includes(status)) return false;
  const publishedAt = new Date(post.publishedAt).getTime();
  return !Number.isFinite(publishedAt) || publishedAt <= Date.now();
}

/**
 * Prefer CMS stories when the tenant connection is available, while keeping
 * the editorial fallback linked for the existing storefront cards.
 */
export const getStorefrontBlogPosts = cache(async (): Promise<BlogPost[]> => {
  let records: unknown[] = [];
  try {
    const result: unknown = await getPublicBlogPostRecords();
    if (Array.isArray(result)) records = result;
  } catch {
    // The storefront should still render when the optional CMS is not ready.
  }

  const bySlug = new Map<string, BlogPost>();
  const fallbackPosts = process.env.NODE_ENV === 'production' ? [] : FALLBACK_BLOG_POSTS;
  for (const post of fallbackPosts) bySlug.set(post.slug, post);

  records
    .map((record, index) => normalizePost(record, index))
    .filter((post): post is BlogPost => post !== null && isPublicPost(post))
    .forEach((post) => bySlug.set(post.slug, post));

  return Array.from(bySlug.values()).sort(
    (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
  );
});

export async function getStorefrontBlogPost(slug: string): Promise<BlogPost | undefined> {
  const posts = await getStorefrontBlogPosts();
  return posts.find((post) => post.slug === slug);
}

export type BlogFilterOption = {
  label: string;
  value: string;
  count: number;
};

export function getFilterOptions(posts: BlogPost[], kind: 'category' | 'tag'): BlogFilterOption[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const post of posts) {
    const values = kind === 'category' ? [post.category] : post.tags;
    for (const value of values) {
      const key = slugify(value);
      if (!key) continue;
      const current = counts.get(key);
      counts.set(key, { label: current?.label ?? value, count: (current?.count ?? 0) + 1 });
    }
  }

  return Array.from(counts.entries())
    .map(([value, item]) => ({ ...item, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function formatBlogDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

'use server';

import { revalidatePath } from 'next/cache';
import { eq, ilike } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { blogComments, blogPostTags, blogPosts, statusEnum } from '@/db/schema-tenant';
import { requireCmsSession, type CmsSession } from '@/lib/cms/session';
import { slugify } from '@/lib/cms/format';

export type PostActionResult = {
  ok: boolean;
  id?: number;
  error?: string;
};

/** The shared `status` enum of the POS schema (see schema-tenant.ts). */
type DbStatus = (typeof statusEnum.enumValues)[number];

/** Draft / Published / Archived → the shared status enum. */
const STATUS_MAP: Record<string, DbStatus> = {
  Draft: 'Pending',
  Published: 'Active',
  Archived: 'Archived',
  Pending: 'Pending',
  Active: 'Active',
  Inactive: 'Inactive',
  Suspended: 'Suspended',
};

function mapStatus(value: string, fallback: DbStatus): DbStatus {
  return STATUS_MAP[value] || fallback;
}

function readString(formData: FormData, key: string, max = 4000) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function readCategoryId(formData: FormData): number | null {
  const raw = readString(formData, 'categoryId', 20).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** `datetime-local` input → Date, or null when empty/unparseable. */
function readDate(formData: FormData, key: string): Date | null {
  const raw = readString(formData, key, 40).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `blog_posts.author_name` is NOT NULL — fall back to the signed-in user. */
function sessionAuthor(session: CmsSession): string {
  if (typeof session.name === 'string' && session.name.trim()) return session.name.trim();
  if (typeof session.email === 'string' && session.email.trim()) return session.email.trim();
  return 'Admin';
}

export async function createPost(formData: FormData): Promise<PostActionResult> {
  const session = await requireCmsSession();

  const title = readString(formData, 'title', 255).trim();
  if (!title) return { ok: false, error: 'A title is required.' };

  const db = await getContextDb();
  const slug = slugify(readString(formData, 'slug', 255) || title) || `post-${Date.now()}`;

  const [existing] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);
  if (existing) return { ok: false, error: `The slug "${slug}" is already in use.` };

  const status = mapStatus(readString(formData, 'status'), 'Pending');
  const publishedAt = readDate(formData, 'publishedAt') ?? (status === 'Active' ? new Date() : null);

  const [row] = await db
    .insert(blogPosts)
    .values({
      categoryId: readCategoryId(formData),
      title,
      slug,
      excerpt: readString(formData, 'excerpt', 320),
      content: readString(formData, 'content', 400_000),
      coverImageUrl: readString(formData, 'coverImageUrl', 1000) || null,
      authorName: sessionAuthor(session),
      status,
      publishedAt,
    })
    .returning({ id: blogPosts.id });

  revalidatePath('/cms/posts');
  return { ok: true, id: row.id };
}

export async function updatePost(id: number, formData: FormData): Promise<PostActionResult> {
  const session = await requireCmsSession();

  const title = readString(formData, 'title', 255).trim();
  if (!title) return { ok: false, error: 'A title is required.' };

  const db = await getContextDb();
  const [current] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  if (!current) return { ok: false, error: 'Post not found.' };

  const rawSlug = readString(formData, 'slug', 255);
  const slug = slugify(rawSlug || title) || current.slug;
  if (slug !== current.slug) {
    const [clash] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);
    if (clash && clash.id !== id) {
      return { ok: false, error: `The slug "${slug}" is already in use.` };
    }
  }

  const status = mapStatus(readString(formData, 'status'), current.status);
  const parsed = readDate(formData, 'publishedAt');
  const publishedAt =
    parsed ?? (status === 'Active' ? current.publishedAt ?? new Date() : null);

  await db
    .update(blogPosts)
    .set({
      categoryId: readCategoryId(formData),
      title,
      slug,
      excerpt: readString(formData, 'excerpt', 320),
      content: readString(formData, 'content', 400_000),
      coverImageUrl: readString(formData, 'coverImageUrl', 1000) || null,
      authorName: current.authorName || sessionAuthor(session),
      status,
      publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, id));

  revalidatePath('/cms/posts');
  revalidatePath(`/cms/posts/${id}/edit`);
  return { ok: true, id };
}

export async function deletePost(id: number): Promise<PostActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  const [current] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(eq(blogPosts.id, id))
    .limit(1);
  if (!current) return { ok: false, error: 'That post no longer exists.' };

  // Explicit child deletes keep the action safe even if a legacy tenant is
  // missing the ON DELETE CASCADE clauses declared in schema-tenant.ts.
  await db.delete(blogComments).where(eq(blogComments.postId, id));
  await db.delete(blogPostTags).where(eq(blogPostTags.postId, id));
  await db.delete(blogPosts).where(eq(blogPosts.id, id));

  revalidatePath('/cms/posts');
  return { ok: true, id };
}

export async function duplicatePost(id: number): Promise<PostActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  const [source] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  if (!source) return { ok: false, error: 'Post not found.' };

  // Find the smallest "<slug>-copy-<n>" that is not taken yet. Counting exact
  // matches used to collide ("X-copy-1" already exists) on the second copy.
  const base = `${source.slug}-copy`.slice(0, 240);
  const copies = await db
    .select({ slug: blogPosts.slug })
    .from(blogPosts)
    .where(ilike(blogPosts.slug, `${base}-%`));
  const used = new Set(copies.map((row) => row.slug));
  let suffix = 1;
  let slug = `${base}-${suffix}`;
  while (used.has(slug)) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }

  const [row] = await db
    .insert(blogPosts)
    .values({
      categoryId: source.categoryId,
      title: `${source.title.slice(0, 240)} (copy)`,
      slug,
      excerpt: source.excerpt,
      content: source.content,
      coverImageUrl: source.coverImageUrl,
      authorName: source.authorName,
      status: 'Pending',
      publishedAt: null,
    })
    .returning({ id: blogPosts.id });

  revalidatePath('/cms/posts');
  return { ok: true, id: row.id };
}

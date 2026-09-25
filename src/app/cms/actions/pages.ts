'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { cmsPages } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { slugify } from '@/lib/cms/format';
import { normalizeBlocks, type Block } from '@/app/cms/builder/blocks';

export type PageActionResult = {
  ok: boolean;
  id?: number;
  error?: string;
};

/** Draft / Published / Archived → the shared `status` enum of the POS schema. */
type StatusValue = 'Pending' | 'Active' | 'Archived';

const STATUS_MAP: Record<string, StatusValue> = {
  Draft: 'Pending',
  Published: 'Active',
  Archived: 'Archived',
  Pending: 'Pending',
  Active: 'Active',
};

function mapStatus(value: string, fallback: StatusValue): StatusValue {
  return STATUS_MAP[value] || fallback;
}

function readString(formData: FormData, key: string, max = 4000) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function readBlocks(formData: FormData): Block[] {
  const raw = readString(formData, 'blocks', 400_000);
  if (!raw.trim()) return [];
  try {
    return normalizeBlocks(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function createPage(formData: FormData): Promise<PageActionResult> {
  const session = await requireCmsSession();

  const title = readString(formData, 'title', 255).trim();
  if (!title) return { ok: false, error: 'A title is required.' };

  const db = await getContextDb();
  const rawSlug = readString(formData, 'slug', 255);
  const slug = slugify(rawSlug || title) || `page-${Date.now()}`;

  const [existing] = await db
    .select({ id: cmsPages.id })
    .from(cmsPages)
    .where(eq(cmsPages.slug, slug))
    .limit(1);
  if (existing) return { ok: false, error: `The slug "${slug}" is already in use.` };

  const editorMode = readString(formData, 'editorMode') === 'builder' ? 'builder' : 'classic';

  const [row] = await db
    .insert(cmsPages)
    .values({
      title,
      slug,
      content: readString(formData, 'content'),
      blocks: editorMode === 'builder' ? readBlocks(formData) : [],
      pageType: readString(formData, 'pageType', 30) || 'page',
      excerpt: readString(formData, 'excerpt', 2000),
      featuredImage: readString(formData, 'featuredImage', 1000) || null,
      metaTitle: readString(formData, 'metaTitle', 255) || null,
      metaDescription: readString(formData, 'metaDescription', 2000) || null,
      authorUserId: Number((session as any).userId) || null,
      status: mapStatus(readString(formData, 'status'), 'Pending'),
    })
    .returning({ id: cmsPages.id });

  revalidatePath('/cms/pages');
  revalidatePath(`/cms/pages/${row.id}/edit`);
  return { ok: true, id: row.id };
}

/**
 * Persist a block layout composed in the builder screen, either onto an
 * existing page or as a brand-new one. Only the blocks are touched, so saving
 * over a page never disturbs its title, SEO fields or status.
 */
export async function saveBuilderBlocks(input: {
  pageId: number | null;
  title: string;
  blocks: unknown;
}): Promise<PageActionResult> {
  const session = await requireCmsSession();
  const db = await getContextDb();
  const authorId = Number((session as { userId?: unknown }).userId) || null;
  const blocks = normalizeBlocks(input.blocks);
  if (blocks.length === 0) return { ok: false, error: 'Add at least one block first.' };

  if (input.pageId) {
    const [current] = await db
      .select({ id: cmsPages.id })
      .from(cmsPages)
      .where(eq(cmsPages.id, input.pageId))
      .limit(1);
    if (!current) return { ok: false, error: 'That page no longer exists.' };

    await db
      .update(cmsPages)
      .set({ blocks, updatedBy: authorId })
      .where(eq(cmsPages.id, input.pageId));

    revalidatePath('/cms/pages');
    revalidatePath(`/cms/pages/${input.pageId}/edit`);
    revalidatePath('/shop');
    return { ok: true, id: input.pageId };
  }

  const title = input.title.trim().slice(0, 255);
  if (!title) return { ok: false, error: 'Give the new page a title.' };

  const base = slugify(title) || `page-${Date.now()}`;
  const [taken] = await db
    .select({ id: cmsPages.id })
    .from(cmsPages)
    .where(eq(cmsPages.slug, base))
    .limit(1);
  const slug = taken ? `${base}-${Date.now().toString(36)}` : base;

  const [row] = await db
    .insert(cmsPages)
    .values({
      title,
      slug,
      blocks,
      pageType: 'page',
      authorUserId: authorId,
      status: 'Active',
    })
    .returning({ id: cmsPages.id });

  revalidatePath('/cms/pages');
  revalidatePath('/shop');
  return { ok: true, id: row.id };
}

export async function updatePage(id: number, formData: FormData): Promise<PageActionResult> {
  const session = await requireCmsSession();

  const title = readString(formData, 'title', 255).trim();
  if (!title) return { ok: false, error: 'A title is required.' };

  const db = await getContextDb();
  const [current] = await db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1);
  if (!current) return { ok: false, error: 'Page not found.' };

  const rawSlug = readString(formData, 'slug', 255);
  const slug = slugify(rawSlug || title) || current.slug;
  if (slug !== current.slug) {
    const [clash] = await db
      .select({ id: cmsPages.id })
      .from(cmsPages)
      .where(eq(cmsPages.slug, slug))
      .limit(1);
    if (clash && clash.id !== id) {
      return { ok: false, error: `The slug "${slug}" is already in use.` };
    }
  }

  const editorMode = readString(formData, 'editorMode');
  const useBuilder = editorMode === 'builder' || (!editorMode && Array.isArray(current.blocks) && current.blocks.length > 0);

  await db
    .update(cmsPages)
    .set({
      title,
      slug,
      content: readString(formData, 'content'),
      blocks: useBuilder ? readBlocks(formData) : current.blocks,
      pageType: readString(formData, 'pageType', 30) || current.pageType || 'page',
      excerpt: readString(formData, 'excerpt', 2000),
      featuredImage: readString(formData, 'featuredImage', 1000) || null,
      metaTitle: readString(formData, 'metaTitle', 255) || null,
      metaDescription: readString(formData, 'metaDescription', 2000) || null,
      updatedBy: Number((session as any).userId) || null,
      status: mapStatus(readString(formData, 'status'), current.status as StatusValue),
      updatedAt: new Date(),
    })
    .where(eq(cmsPages.id, id));

  revalidatePath('/cms/pages');
  revalidatePath(`/cms/pages/${id}/edit`);
  return { ok: true, id };
}

export async function deletePage(id: number): Promise<PageActionResult> {
  await requireCmsSession();
  const db = await getContextDb();
  await db.delete(cmsPages).where(eq(cmsPages.id, id));
  revalidatePath('/cms/pages');
  return { ok: true, id };
}

export async function duplicatePage(id: number): Promise<PageActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  const [source] = await db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1);
  if (!source) return { ok: false, error: 'Page not found.' };

  const [countRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(cmsPages)
    .where(eq(cmsPages.slug, source.slug));

  const slug = `${source.slug}-copy-${(countRow?.value ?? 0) + 1}`;

  const [row] = await db
    .insert(cmsPages)
    .values({
      title: `${source.title} (copy)`,
      slug,
      content: source.content,
      blocks: source.blocks,
      pageType: source.pageType,
      excerpt: source.excerpt,
      featuredImage: source.featuredImage,
      metaTitle: source.metaTitle,
      metaDescription: source.metaDescription,
      status: 'Pending',
    })
    .returning({ id: cmsPages.id });

  revalidatePath('/cms/pages');
  return { ok: true, id: row.id };
}

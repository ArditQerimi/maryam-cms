import 'server-only';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { getTenantDb } from '@/db';
import * as schema from '@/db/schema-tenant';
import { getContextCompany } from '@/lib/tenant';
import { getSession } from '@/lib/session';
import { isRoleAllowedForAudience, isSessionForCompany } from '@/lib/auth-validation';
import { getDefaultPermissionsForRole, hasPermission } from '@/lib/permissions';
import { getCompanyRolePermissionKeys } from '@/lib/permission-store';
import { notFound, redirect } from 'next/navigation';

import { estimateReadingMinutes, getBlogContentPlainText, slugify } from './content';
import type {
  BlogAdminCategory,
  BlogAdminPost,
  BlogAdminPostSummary,
  BlogAdminTag,
  BlogEditorPageData,
} from './types';
import {
  BlogValidationError,
  parsePositiveInteger,
  type ValidatedBlogPostInput,
} from './validation';

export type BlogListPageData = {
  posts: BlogAdminPostSummary[];
  categories: BlogAdminCategory[];
  canManage: boolean;
};

export type BlogSaveResult = {
  id: number;
  slug: string;
  previousSlug: string | null,
};

export type BlogTaxonomyStatus = 'Active' | 'Inactive';

export type BlogTaxonomyWriteInput = {
  name: string;
  status: BlogTaxonomyStatus;
};

export class BlogAdminNotFoundError extends Error {
  constructor(message = 'The requested blog post was not found.') {
    super(message);
    this.name = 'BlogAdminNotFoundError';
  }
}

export class BlogAdminSchemaError extends Error {
  readonly code = 'blog-migration-required';

  constructor() {
    super('The additive blog CMS migration has not been applied to this tenant.');
    this.name = 'BlogAdminSchemaError';
  }
}

type TenantDatabase = ReturnType<typeof getTenantDb>;
type TenantTransaction = Parameters<Parameters<TenantDatabase['transaction']>[0]>[0];
type RequiredBlogPermission = 'cms.view' | 'cms.manage';

type BlogAdminAccess = {
  companyId: number;
  db: TenantDatabase;
  userId: number;
  userName: string;
  roleName: string;
  permissions: string[];
  canManage: boolean;
};

async function assertBlogPostSchema(db: TenantDatabase) {
  const result = await db.execute<{ column_name: string }>(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'blog_posts'
      AND column_name IN ('excerpt', 'cover_image_url', 'updated_at')
  `);
  const columns = new Set(result.rows.map((row) => row.column_name));
  if (
    !columns.has('excerpt')
    || !columns.has('cover_image_url')
    || !columns.has('updated_at')
  ) {
    throw new BlogAdminSchemaError();
  }
}

function positiveSessionId(value: unknown): number | null {
  return parsePositiveInteger(value);
}

async function requireBlogAdminAccess(requiredPermission: RequiredBlogPermission): Promise<BlogAdminAccess> {
  const session = await getSession();
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    redirect('/login');
  }

  const payload = session as Record<string, unknown>;
  const audience = payload.audience;
  const staffAudience = payload.platformRole === 'admin' &&
    payload.isPlatformUser !== true &&
    (audience === undefined || audience === 'staff');

  if (!staffAudience) notFound();

  const userId = positiveSessionId(payload.userId);
  if (!userId) redirect('/login');

  // Resolve the company from the exact current host. The signed company claim
  // is only used for an equality check; it never chooses a database.
  const company = await getContextCompany();
  if (!isSessionForCompany(payload, company.id)) notFound();

  const db = getTenantDb(company.dbConnectionString, company.dbSchema);
  const [staff] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      status: schema.users.status,
      roleName: schema.tenantRoles.name,
    })
    .from(schema.users)
    .leftJoin(schema.tenantRoles, eq(schema.users.tenantRoleId, schema.tenantRoles.id))
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!staff || staff.status !== 'Active' || !isRoleAllowedForAudience(staff.roleName, 'staff')) {
    redirect('/login');
  }

  // Resolve current role permissions from the master permission map instead of
  // trusting the permission/role arrays embedded in a potentially old token.
  let permissions = await getCompanyRolePermissionKeys(company.id, staff.roleName!);
  if (permissions.length === 0) permissions = getDefaultPermissionsForRole(staff.roleName!);

  if (!hasPermission(permissions, requiredPermission)) notFound();

  return {
    companyId: company.id,
    db,
    userId,
    userName: staff.name,
    roleName: staff.roleName!,
    permissions,
    canManage: hasPermission(permissions, 'cms.manage'),
  };
}

export async function assertBlogAdminManageAccess(): Promise<void> {
  await requireBlogAdminAccess('cms.manage');
}

function toIso(value: Date | null): string | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
}

function mapSummary(
  row: {
    id: number;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string | null;
    coverImageUrl: string | null;
    authorName: string;
    status: 'Active' | 'Inactive' | 'Archived' | 'Pending' | 'Suspended';
    categoryId: number | null;
    categoryName: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  tags: string[],
): BlogAdminPostSummary {
  const content = row.content ?? '';
  const plainText = getBlogContentPlainText(content);
  const excerpt = row.excerpt?.trim() || (plainText ? `${plainText.slice(0, 187).replace(/\s+\S*$/, '')}…` : '');

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt,
    coverImageUrl: row.coverImageUrl,
    authorName: row.authorName,
    status: row.status === 'Active' ? 'Published' : 'Draft',
    categoryId: row.categoryId,
    categoryName: row.categoryName?.trim() || 'Uncategorized',
    tags,
    publishedAt: toIso(row.publishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readingMinutes: estimateReadingMinutes(content || excerpt),
  };
}

async function readAllTags(db: TenantDatabase): Promise<Map<number, string[]>> {
  const links = await db
    .select({ postId: schema.blogPostTags.postId, tagName: schema.blogTags.name })
    .from(schema.blogPostTags)
    .innerJoin(schema.blogTags, eq(schema.blogPostTags.tagId, schema.blogTags.id))
    .orderBy(asc(schema.blogTags.name));

  const tagsByPost = new Map<number, string[]>();
  for (const link of links) {
    const current = tagsByPost.get(link.postId) ?? [];
    if (!current.includes(link.tagName)) current.push(link.tagName);
    tagsByPost.set(link.postId, current);
  }
  return tagsByPost;
}

async function readCategories(db: TenantDatabase): Promise<BlogAdminCategory[]> {
  return db
    .select({ id: schema.blogCategories.id, name: schema.blogCategories.name, status: schema.blogCategories.status })
    .from(schema.blogCategories)
    .orderBy(asc(schema.blogCategories.name));
}

export async function getBlogCategoriesForAdmin() {
  const access = await requireBlogAdminAccess('cms.view');
  return access.db
    .select()
    .from(schema.blogCategories)
    .orderBy(desc(schema.blogCategories.createdAt));
}

export async function getBlogTagsForAdmin() {
  const access = await requireBlogAdminAccess('cms.view');
  return access.db
    .select()
    .from(schema.blogTags)
    .orderBy(desc(schema.blogTags.createdAt));
}

export async function getBlogCommentsForAdmin() {
  const access = await requireBlogAdminAccess('cms.view');
  return access.db
    .select({
      id: schema.blogComments.id,
      postId: schema.blogComments.postId,
      commenterName: schema.blogComments.commenterName,
      comment: schema.blogComments.comment,
      status: schema.blogComments.status,
      createdAt: schema.blogComments.createdAt,
      post: {
        id: schema.blogPosts.id,
        title: schema.blogPosts.title,
      },
    })
    .from(schema.blogComments)
    .leftJoin(schema.blogPosts, eq(schema.blogComments.postId, schema.blogPosts.id))
    .orderBy(desc(schema.blogComments.createdAt));
}

export async function getBlogListPageData(): Promise<BlogListPageData> {
  const access = await requireBlogAdminAccess('cms.view');
  await assertBlogPostSchema(access.db);
  const [rows, categories, tagsByPost] = await Promise.all([
    access.db
      .select({
        id: schema.blogPosts.id,
        title: schema.blogPosts.title,
        slug: schema.blogPosts.slug,
        excerpt: schema.blogPosts.excerpt,
        content: schema.blogPosts.content,
        coverImageUrl: schema.blogPosts.coverImageUrl,
        authorName: schema.blogPosts.authorName,
        status: schema.blogPosts.status,
        categoryId: schema.blogPosts.categoryId,
        categoryName: schema.blogCategories.name,
        publishedAt: schema.blogPosts.publishedAt,
        createdAt: schema.blogPosts.createdAt,
        updatedAt: schema.blogPosts.updatedAt,
      })
      .from(schema.blogPosts)
      .leftJoin(schema.blogCategories, eq(schema.blogPosts.categoryId, schema.blogCategories.id))
      .orderBy(desc(schema.blogPosts.updatedAt), desc(schema.blogPosts.publishedAt), desc(schema.blogPosts.createdAt)),
    readCategories(access.db),
    readAllTags(access.db),
  ]);

  return {
    posts: rows.map((row) => mapSummary(row, tagsByPost.get(row.id) ?? [])),
    categories,
    canManage: access.canManage,
  };
}

export async function getBlogEditorPageData(postId: number | null): Promise<BlogEditorPageData> {
  const access = await requireBlogAdminAccess('cms.manage');
  await assertBlogPostSchema(access.db);
  const normalizedPostId = postId === null ? null : parsePositiveInteger(postId);
  if (postId !== null && !normalizedPostId) notFound();

  const [categories, tags, row, tagsByPost] = await Promise.all([
    readCategories(access.db),
    access.db
      .select({ id: schema.blogTags.id, name: schema.blogTags.name })
      .from(schema.blogTags)
      .where(eq(schema.blogTags.status, 'Active'))
      .orderBy(asc(schema.blogTags.name)),
    normalizedPostId
      ? access.db
          .select({
            id: schema.blogPosts.id,
            title: schema.blogPosts.title,
            slug: schema.blogPosts.slug,
            excerpt: schema.blogPosts.excerpt,
            content: schema.blogPosts.content,
            coverImageUrl: schema.blogPosts.coverImageUrl,
            authorName: schema.blogPosts.authorName,
            status: schema.blogPosts.status,
            categoryId: schema.blogPosts.categoryId,
            categoryName: schema.blogCategories.name,
            publishedAt: schema.blogPosts.publishedAt,
            createdAt: schema.blogPosts.createdAt,
            updatedAt: schema.blogPosts.updatedAt,
          })
          .from(schema.blogPosts)
          .leftJoin(schema.blogCategories, eq(schema.blogPosts.categoryId, schema.blogCategories.id))
          .where(eq(schema.blogPosts.id, normalizedPostId))
          .limit(1)
      : Promise.resolve([]),
    normalizedPostId ? readAllTags(access.db) : Promise.resolve(new Map<number, string[]>()),
  ]);

  const selected = row[0];
  if (normalizedPostId && !selected) notFound();

  const post: BlogAdminPost | null = selected
    ? {
        ...mapSummary(selected, tagsByPost.get(selected.id) ?? []),
        content: selected.content ?? '',
      }
    : null;

  return {
    categories,
    tags: tags satisfies BlogAdminTag[],
    defaultAuthor: access.userName,
    post,
  };
}

async function reserveUniqueSlug(
  tx: TenantTransaction,
  desiredSlug: string,
  currentPostId: number | null,
): Promise<string> {
  // Serializes slug allocation for writers in this tenant. The existing unique
  // index remains the final integrity guard.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tenant-blog-admin:post-slug:v1'))`);

  const base = slugify(desiredSlug).slice(0, BLOG_SLUG_BASE_LENGTH);
  for (let suffixNumber = 1; suffixNumber <= 999; suffixNumber += 1) {
    const suffix = suffixNumber === 1 ? '' : `-${suffixNumber}`;
    const candidate = `${base.slice(0, 120 - suffix.length)}${suffix}`;
    const existing = await tx
      .select({ id: schema.blogPosts.id })
      .from(schema.blogPosts)
      .where(
        currentPostId
          ? and(eq(schema.blogPosts.slug, candidate), ne(schema.blogPosts.id, currentPostId))
          : eq(schema.blogPosts.slug, candidate),
      )
      .limit(1);

    if (!existing[0]) return candidate;
  }

  throw new BlogValidationError({ slug: 'Could not allocate a unique slug. Choose a shorter or different slug.' });
}

const BLOG_SLUG_BASE_LENGTH = 100;

async function validateCategory(tx: TenantTransaction, categoryId: number | null): Promise<void> {
  if (categoryId === null) return;
  const category = await tx
    .select({ id: schema.blogCategories.id })
    .from(schema.blogCategories)
    .where(eq(schema.blogCategories.id, categoryId))
    .limit(1);
  if (!category[0]) throw new BlogValidationError({ categoryId: 'The selected category no longer exists.' });
}

async function linkTags(tx: TenantTransaction, postId: number, tagNames: string[]): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tenant-blog-admin:tag-names:v1'))`);
  await tx.delete(schema.blogPostTags).where(eq(schema.blogPostTags.postId, postId));

  const tagIds: number[] = [];
  for (const tagName of tagNames) {
    const existing = await tx
      .select({ id: schema.blogTags.id })
      .from(schema.blogTags)
      .where(sql`lower(${schema.blogTags.name}) = lower(${tagName})`)
      .orderBy(asc(schema.blogTags.id))
      .limit(1);

    if (existing[0]) {
      if (!tagIds.includes(existing[0].id)) tagIds.push(existing[0].id);
      continue;
    }

    const inserted = await tx
      .insert(schema.blogTags)
      .values({ name: tagName, status: 'Active' })
      .returning({ id: schema.blogTags.id });
    tagIds.push(inserted[0].id);
  }

  if (tagIds.length > 0) {
    await tx.insert(schema.blogPostTags).values(tagIds.map((tagId) => ({ postId, tagId })));
  }
}

function postValues(input: ValidatedBlogPostInput, now: Date) {
  return {
    categoryId: input.categoryId,
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    content: input.content,
    authorName: input.authorName,
    coverImageUrl: input.coverImageUrl,
    status: input.status === 'Published' ? 'Active' as const : 'Inactive' as const,
    publishedAt: input.publishedAt,
    updatedAt: now,
  };
}

export async function createBlogPost(input: ValidatedBlogPostInput): Promise<BlogSaveResult> {
  const access = await requireBlogAdminAccess('cms.manage');
  await assertBlogPostSchema(access.db);
  const now = new Date();

  return access.db.transaction(async (tx) => {
    await validateCategory(tx, input.categoryId);
    const slug = await reserveUniqueSlug(tx, input.slug, null);
    const [post] = await tx
      .insert(schema.blogPosts)
      .values({ ...postValues(input, now), slug })
      .returning({ id: schema.blogPosts.id, slug: schema.blogPosts.slug });
    await linkTags(tx, post.id, input.tagNames);
    return { id: post.id, slug: post.slug, previousSlug: null };
  });
}

export async function updateBlogPost(postId: number, input: ValidatedBlogPostInput): Promise<BlogSaveResult> {
  const access = await requireBlogAdminAccess('cms.manage');
  await assertBlogPostSchema(access.db);
  const normalizedPostId = parsePositiveInteger(postId);
  if (!normalizedPostId) throw new BlogAdminNotFoundError();
  const now = new Date();

  return access.db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: schema.blogPosts.id, slug: schema.blogPosts.slug })
      .from(schema.blogPosts)
      .where(eq(schema.blogPosts.id, normalizedPostId))
      .limit(1);
    if (!existing) throw new BlogAdminNotFoundError();

    await validateCategory(tx, input.categoryId);
    const slug = await reserveUniqueSlug(tx, input.slug, normalizedPostId);
    const [post] = await tx
      .update(schema.blogPosts)
      .set({ ...postValues(input, now), slug })
      .where(eq(schema.blogPosts.id, normalizedPostId))
      .returning({ id: schema.blogPosts.id, slug: schema.blogPosts.slug });
    if (!post) throw new BlogAdminNotFoundError();

    await linkTags(tx, post.id, input.tagNames);
    return {
      id: post.id,
      slug: post.slug,
      previousSlug: existing.slug === post.slug ? null : existing.slug,
    };
  });
}

export async function deleteBlogPost(postId: number, confirmation: string): Promise<{ slug: string }> {
  const access = await requireBlogAdminAccess('cms.manage');
  const normalizedPostId = parsePositiveInteger(postId);
  if (!normalizedPostId) throw new BlogAdminNotFoundError();

  return access.db.transaction(async (tx) => {
    const [post] = await tx
      .select({ id: schema.blogPosts.id, title: schema.blogPosts.title, slug: schema.blogPosts.slug })
      .from(schema.blogPosts)
      .where(eq(schema.blogPosts.id, normalizedPostId))
      .limit(1);

    if (!post) throw new BlogAdminNotFoundError();
    if (confirmation.trim() !== post.title) {
      throw new BlogValidationError({ confirmation: 'The title does not match. Type it exactly to confirm deletion.' });
    }

    await tx.delete(schema.blogComments).where(eq(schema.blogComments.postId, post.id));
    await tx.delete(schema.blogPostTags).where(eq(schema.blogPostTags.postId, post.id));
    await tx.delete(schema.blogPosts).where(eq(schema.blogPosts.id, post.id));
    return { slug: post.slug };
  });
}

async function assertUniqueTaxonomyName(
  tx: TenantTransaction,
  table: typeof schema.blogCategories | typeof schema.blogTags,
  name: string,
  currentId: number | null,
): Promise<void> {
  const existing = await tx
    .select({ id: table.id })
    .from(table)
    .where(
      currentId
        ? and(sql`lower(${table.name}) = lower(${name})`, ne(table.id, currentId))
        : sql`lower(${table.name}) = lower(${name})`,
    )
    .limit(1);
  if (existing[0]) throw new Error('A category or tag with that name already exists.');
}

export async function createBlogTaxonomyItem(
  kind: 'category' | 'tag',
  input: BlogTaxonomyWriteInput,
) {
  const access = await requireBlogAdminAccess('cms.manage');
  return access.db.transaction(async (tx) => {
    const table = kind === 'category' ? schema.blogCategories : schema.blogTags;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tenant-blog-admin:${kind}:v1'))`);
    await assertUniqueTaxonomyName(tx, table, input.name, null);
    const inserted = await tx.insert(table).values({ name: input.name, status: input.status }).returning({ id: table.id });
    return inserted[0];
  });
}

export async function updateBlogTaxonomyItem(
  kind: 'category' | 'tag',
  id: number,
  input: BlogTaxonomyWriteInput,
) {
  const access = await requireBlogAdminAccess('cms.manage');
  const normalizedId = parsePositiveInteger(id);
  if (!normalizedId) throw new BlogAdminNotFoundError('The category or tag was not found.');

  return access.db.transaction(async (tx) => {
    const table = kind === 'category' ? schema.blogCategories : schema.blogTags;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tenant-blog-admin:${kind}:v1'))`);
    await assertUniqueTaxonomyName(tx, table, input.name, normalizedId);
    const updated = await tx
      .update(table)
      .set({ name: input.name, status: input.status })
      .where(eq(table.id, normalizedId))
      .returning({ id: table.id });
    if (!updated[0]) throw new BlogAdminNotFoundError('The category or tag was not found.');
    return updated[0];
  });
}

export async function deleteBlogTaxonomyItem(kind: 'category' | 'tag', id: number): Promise<void> {
  const access = await requireBlogAdminAccess('cms.manage');
  const normalizedId = parsePositiveInteger(id);
  if (!normalizedId) throw new BlogAdminNotFoundError('The category or tag was not found.');

  await access.db.transaction(async (tx) => {
    if (kind === 'category') {
      const updated = await tx
        .update(schema.blogPosts)
        .set({ categoryId: null, updatedAt: new Date() })
        .where(eq(schema.blogPosts.categoryId, normalizedId))
        .returning({ id: schema.blogPosts.id });
      if (updated.length === 0) {
        const category = await tx
          .select({ id: schema.blogCategories.id })
          .from(schema.blogCategories)
          .where(eq(schema.blogCategories.id, normalizedId))
          .limit(1);
        if (!category[0]) throw new BlogAdminNotFoundError('The category was not found.');
      }
      await tx.delete(schema.blogCategories).where(eq(schema.blogCategories.id, normalizedId));
      return;
    }

    await tx.delete(schema.blogPostTags).where(eq(schema.blogPostTags.tagId, normalizedId));
    const deleted = await tx
      .delete(schema.blogTags)
      .where(eq(schema.blogTags.id, normalizedId))
      .returning({ id: schema.blogTags.id });
    if (!deleted[0]) throw new BlogAdminNotFoundError('The tag was not found.');
  });
}

export async function updateBlogCommentStatus(id: number, status: 'Active' | 'Inactive') {
  const access = await requireBlogAdminAccess('cms.manage');
  const normalizedId = parsePositiveInteger(id);
  if (!normalizedId) throw new BlogAdminNotFoundError('The comment was not found.');
  const updated = await access.db
    .update(schema.blogComments)
    .set({ status })
    .where(eq(schema.blogComments.id, normalizedId))
    .returning({ id: schema.blogComments.id });
  if (!updated[0]) throw new BlogAdminNotFoundError('The comment was not found.');
  return updated[0];
}

export async function deleteBlogCommentById(id: number): Promise<void> {
  const access = await requireBlogAdminAccess('cms.manage');
  const normalizedId = parsePositiveInteger(id);
  if (!normalizedId) throw new BlogAdminNotFoundError('The comment was not found.');
  const deleted = await access.db
    .delete(schema.blogComments)
    .where(eq(schema.blogComments.id, normalizedId))
    .returning({ id: schema.blogComments.id });
  if (!deleted[0]) throw new BlogAdminNotFoundError('The comment was not found.');
}

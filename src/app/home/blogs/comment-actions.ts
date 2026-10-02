'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { blogComments, blogPosts, users } from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';
import { getSession } from '@/lib/session';

export type CommentState = { status: 'idle' | 'error' | 'success'; message?: string };

const MAX_COMMENT = 2000;
const MAX_NAME = 120;

/**
 * "Leave a Reply" on a blog post. Signed-in shoppers comment under their own
 * name; guests give a name. New comments wait as `Pending` until approved in
 * the CMS, so nothing is published unreviewed.
 */
export async function submitBlogComment(
  postSlug: string,
  _previous: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const comment = String(formData.get('comment') ?? '').trim();
  if (!comment) return { status: 'error', message: 'Please write a comment.' };
  if (comment.length > MAX_COMMENT) {
    return { status: 'error', message: `Comments can be at most ${MAX_COMMENT} characters.` };
  }

  try {
    const db = await getContextDb();
    const [post] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, postSlug))
      .limit(1);
    if (!post) return { status: 'error', message: 'Comments are not available for this post.' };

    let name = String(formData.get('name') ?? '').trim();
    const session = await getSession();
    const userId = Number((session as Record<string, unknown> | null)?.userId);
    if (Number.isSafeInteger(userId) && userId > 0) {
      const [user] = await db
        .select({ name: users.name })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.status, 'Active')))
        .limit(1);
      if (user?.name) name = user.name;
    }
    if (!name) return { status: 'error', message: 'Please enter your name.' };
    if (name.length > MAX_NAME) name = name.slice(0, MAX_NAME);

    await db.insert(blogComments).values({
      postId: post.id,
      commenterName: name,
      comment,
      status: 'Pending',
    });
    revalidatePath(`/home/blogs/${postSlug}`);
    return { status: 'success', message: 'Thank you! Your comment is awaiting moderation.' };
  } catch {
    return { status: 'error', message: 'Your comment could not be saved. Please try again later.' };
  }
}

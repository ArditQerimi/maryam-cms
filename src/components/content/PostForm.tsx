'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ExternalLink, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPost, deletePost, updatePost } from '@/app/cms/actions/posts';
import MediaPickerModal, { type PickedMedia } from '@/components/admin/MediaPickerModal';
import TiptapEditor from '@/components/editor/TiptapEditor';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/admin/ui';

export type PostFormInitial = {
  id: number | null;
  title: string;
  slug: string;
  categoryId: number | null;
  excerpt: string;
  coverImageUrl: string;
  content: string;
  /** Stored enum value: Active | Pending | Archived */
  status: string;
  /** `datetime-local` value ("" when never published). */
  publishedAt: string;
};

export type PostCategory = { id: number; name: string };

type StatusValue = 'Draft' | 'Published' | 'Archived';

const DB_TO_STATUS: Record<string, StatusValue> = {
  Active: 'Published',
  Pending: 'Draft',
  Archived: 'Archived',
};

export default function PostForm({
  initial,
  categories,
  viewHref,
}: {
  initial: PostFormInitial;
  categories: PostCategory[];
  /** Storefront permalink for the "View post" link ("" hides it). */
  viewHref: string;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugEdited, setSlugEdited] = useState(Boolean(initial.slug));
  const [categoryId, setCategoryId] = useState(initial.categoryId === null ? '' : String(initial.categoryId));
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl);
  const [content, setContent] = useState(initial.content);
  const [status, setStatus] = useState<StatusValue>(DB_TO_STATUS[initial.status] ?? 'Draft');
  const [publishedAt, setPublishedAt] = useState(initial.publishedAt);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugEdited) setSlug(value);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const result = initial.id
        ? await updatePost(initial.id, formData)
        : await createPost(formData);
      if (!result.ok) {
        toast.error(result.error || 'Could not save the post.');
        return;
      }
      toast.success(initial.id ? 'Post updated.' : 'Post created.');
      router.push('/cms/posts');
      router.refresh();
    } catch {
      toast.error('Something went wrong while saving the post.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!initial.id || deleting) return;
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const result = await deletePost(initial.id);
      if (!result.ok) {
        toast.error(result.error || 'Could not delete the post.');
        return;
      }
      toast.success('Post deleted.');
      router.push('/cms/posts');
      router.refresh();
    } catch {
      toast.error('Could not delete the post.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Post details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Title" htmlFor="post-title">
              <Input
                id="post-title"
                name="title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Five ways to style your new arrivals"
                autoFocus
              />
            </Field>
            <Field label="Slug" htmlFor="post-slug" hint={`The post will live at /${slug || 'your-slug'}`}>
              <Input
                id="post-slug"
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value);
                }}
                placeholder="five-ways-to-style-your-new-arrivals"
              />
            </Field>
            <Field
              label="Excerpt"
              htmlFor="post-excerpt"
              hint="Shown in post listings. Up to 320 characters."
            >
              <Textarea
                id="post-excerpt"
                name="excerpt"
                rows={3}
                maxLength={320}
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                placeholder="A short summary that makes people want to read on…"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent>
            <input type="hidden" name="content" value={content} />
            <TiptapEditor
              value={content}
              onChange={setContent}
              placeholder="Start writing your post…"
              minHeight={420}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Status" htmlFor="post-status">
              <Select
                id="post-status"
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusValue)}
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </Select>
            </Field>
            <Field
              label="Published date"
              htmlFor="post-published-at"
              hint="Leave empty to publish immediately when the status is Published."
            >
              <Input
                id="post-published-at"
                name="publishedAt"
                type="datetime-local"
                value={publishedAt}
                onChange={(event) => setPublishedAt(event.target.value)}
              />
            </Field>
            <Field label="Category" htmlFor="post-category">
              <Select
                id="post-category"
                name="categoryId"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Button type="submit" className="w-full" disabled={saving || deleting}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {initial.id ? 'Save changes' : 'Create post'}
            </Button>
            <Link
              href="/cms/posts"
              className="block text-center text-xs font-medium text-zinc-500 hover:text-zinc-700"
            >
              Cancel
            </Link>

            {initial.id ? (
              <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
                {viewHref ? (
                  <Link
                    href={viewHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5b59d6] hover:underline"
                  >
                    <ExternalLink size={13} /> View post
                  </Link>
                ) : (
                  <span className="text-xs text-zinc-400">No public URL yet</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={onDelete}
                  disabled={deleting || saving}
                >
                  {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Delete
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cover image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {coverImageUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImageUrl}
                  alt={excerpt || title || 'Cover image'}
                  className="aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-50 object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove cover image"
                  onClick={() => setCoverImageUrl('')}
                  className="absolute right-2 top-2 rounded-md bg-zinc-900/70 p-1.5 text-white transition hover:bg-zinc-900"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : null}
            <input type="hidden" name="coverImageUrl" value={coverImageUrl} />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setPickerOpen(true)}
            >
              <ImagePlus size={14} />
              {coverImageUrl ? 'Change image' : 'Choose from media library'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <MediaPickerModal
        open={pickerOpen}
        mode="single"
        onClose={() => setPickerOpen(false)}
        onSelect={(items: PickedMedia[]) => {
          const url = items[0]?.url;
          if (url) setCoverImageUrl(url);
        }}
      />
    </form>
  );
}

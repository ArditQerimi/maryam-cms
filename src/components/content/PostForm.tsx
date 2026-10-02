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
} from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';

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
  const { t } = useLocale();

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugEdited, setSlugEdited] = useState(Boolean(initial.slug));
  const [categoryId, setCategoryId] = useState(initial.categoryId === null ? '' : String(initial.categoryId));
  const [excerpt] = useState(initial.excerpt);
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
        toast.error(result.error || t('cmsshared.post_form.save_error'));
        return;
      }
      toast.success(initial.id ? t('cmsshared.post_form.updated') : t('cmsshared.post_form.created'));
      router.push('/cms/posts');
      router.refresh();
    } catch {
      toast.error(t('cmsshared.post_form.save_failed'));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!initial.id || deleting) return;
    if (!window.confirm(t('cmsshared.post_form.delete_confirm', { title }))) return;
    setDeleting(true);
    try {
      const result = await deletePost(initial.id);
      if (!result.ok) {
        toast.error(result.error || t('cmsshared.post_form.delete_error'));
        return;
      }
      toast.success(t('cmsshared.post_form.deleted'));
      router.push('/cms/posts');
      router.refresh();
    } catch {
      toast.error(t('cmsshared.post_form.delete_error'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('cmsshared.post_form.details_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t('cmsshared.field.title')} htmlFor="post-title">
              <Input
                id="post-title"
                name="title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder={t('cmsshared.post_form.title_placeholder')}
                autoFocus
              />
            </Field>
            <Field
              label={t('cmsshared.product_editor.slug_label')}
              htmlFor="post-slug"
              hint={t('cmsshared.post_form.slug_hint', { slug: slug || 'your-slug' })}
            >
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
            {/* No separate excerpt field: quotes and highlights are added inside the
                content with the editor (quote button); listings use the content's
                opening text. */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('cmsshared.post_form.content_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <input type="hidden" name="content" value={content} />
            <TiptapEditor
              value={content}
              onChange={setContent}
              placeholder={t('cmsshared.post_form.content_placeholder')}
              minHeight={420}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('cmsshared.post_form.publish_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t('cmsshared.field.status')} htmlFor="post-status">
              <Select
                id="post-status"
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusValue)}
              >
                <option value="Draft">{t('cmsshared.post_form.status_draft')}</option>
                <option value="Published">{t('cmsshared.post_form.status_published')}</option>
                <option value="Archived">{t('cmsshared.post_form.status_archived')}</option>
              </Select>
            </Field>
            <Field
              label={t('cmsshared.post_form.published_label')}
              htmlFor="post-published-at"
              hint={t('cmsshared.post_form.published_hint')}
            >
              <Input
                id="post-published-at"
                name="publishedAt"
                type="datetime-local"
                value={publishedAt}
                onChange={(event) => setPublishedAt(event.target.value)}
              />
            </Field>
            <Field label={t('cmsshared.product_editor.category_label')} htmlFor="post-category">
              <Select
                id="post-category"
                name="categoryId"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">{t('cmsshared.post_form.uncategorized')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Button type="submit" className="w-full" disabled={saving || deleting}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {initial.id ? t('cmsshared.action.save_changes') : t('cmsshared.post_form.create')}
            </Button>
            <Link
              href="/cms/posts"
              className="block text-center text-xs font-medium text-zinc-500 hover:text-zinc-700"
            >
              {t('cmsshared.action.cancel')}
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
                    <ExternalLink size={13} /> {t('cmsshared.post_form.view')}
                  </Link>
                ) : (
                  <span className="text-xs text-zinc-400">{t('cmsshared.post_form.no_url')}</span>
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
                  {t('cmsshared.action.delete')}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('cmsshared.post_form.cover_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {coverImageUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImageUrl}
                  alt={excerpt || title || t('cmsshared.post_form.cover_alt')}
                  className="aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-50 object-cover"
                />
                <button
                  type="button"
                  aria-label={t('cmsshared.post_form.remove_cover_aria')}
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
              {coverImageUrl
                ? t('cmsshared.post_form.change_image')
                : t('cmsshared.post_form.choose_library')}
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

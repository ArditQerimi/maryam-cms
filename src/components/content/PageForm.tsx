'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ExternalLink, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageBuilder from '@/app/cms/builder/PageBuilder';
import { normalizeBlocks, type Block } from '@/app/cms/builder/blocks';
import { createPage, deletePage, updatePage } from '@/app/cms/actions/pages';
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
  cn,
} from '@/components/admin/ui';

export type PageFormInitial = {
  id: number | null;
  title: string;
  slug: string;
  content: string;
  blocks: Block[];
  pageType: string;
  excerpt: string;
  featuredImage: string;
  metaTitle: string;
  metaDescription: string;
  /** Stored enum value: Active | Pending | Archived */
  status: string;
  editorMode: 'classic' | 'builder';
};

type StatusValue = 'Draft' | 'Published' | 'Archived';

const DB_TO_STATUS: Record<string, StatusValue> = {
  Active: 'Published',
  Pending: 'Draft',
  Archived: 'Archived',
};

const PAGE_TYPES = [
  { value: 'page', label: 'Page' },
  { value: 'landing', label: 'Landing page' },
  { value: 'legal', label: 'Legal / policy' },
];

const EDITOR_TABS = [
  { id: 'classic', label: 'Classic editor' },
  { id: 'builder', label: 'Page builder' },
] as const;

export default function PageForm({ initial }: { initial: PageFormInitial }) {
  const router = useRouter();

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugEdited, setSlugEdited] = useState(Boolean(initial.slug));
  const [status, setStatus] = useState<StatusValue>(DB_TO_STATUS[initial.status] ?? 'Draft');
  const [pageType, setPageType] = useState(initial.pageType || 'page');
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [metaTitle, setMetaTitle] = useState(initial.metaTitle);
  const [metaDescription, setMetaDescription] = useState(initial.metaDescription);
  const [featuredImage, setFeaturedImage] = useState(initial.featuredImage);
  const [content, setContent] = useState(initial.content);
  const [blocks, setBlocks] = useState<Block[]>(() => normalizeBlocks(initial.blocks));
  const [editorMode, setEditorMode] = useState<'classic' | 'builder'>(initial.editorMode);
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
        ? await updatePage(initial.id, formData)
        : await createPage(formData);
      if (!result.ok) {
        toast.error(result.error || 'Could not save the page.');
        return;
      }
      toast.success(initial.id ? 'Page updated.' : 'Page created.');
      router.push('/cms/pages');
      router.refresh();
    } catch {
      toast.error('Something went wrong while saving the page.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!initial.id || deleting) return;
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const result = await deletePage(initial.id);
      if (!result.ok) {
        toast.error(result.error || 'Could not delete the page.');
        return;
      }
      toast.success('Page deleted.');
      router.push('/cms/pages');
      router.refresh();
    } catch {
      toast.error('Could not delete the page.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* ------------------------------------------------------ main fields */}
        <Card>
          <CardHeader>
            <CardTitle>Page details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Title" htmlFor="page-title">
              <Input
                id="page-title"
                name="title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="About us"
                autoFocus
              />
            </Field>
            <Field
              label="Slug"
              htmlFor="page-slug"
              hint={`The page will live at /${slug || 'your-slug'}`}
            >
              <Input
                id="page-slug"
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value);
                }}
                placeholder="about-us"
              />
            </Field>
            <Field
              label="Excerpt"
              htmlFor="page-excerpt"
              hint="Short summary used in listings and as a fallback description."
            >
              <Textarea
                id="page-excerpt"
                name="excerpt"
                rows={3}
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                placeholder="A one- or two-sentence summary of this page…"
              />
            </Field>
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------- editor */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Content</CardTitle>
            <div className="inline-flex shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              {EDITOR_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEditorMode(tab.id)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition',
                    editorMode === tab.id
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <input type="hidden" name="editorMode" value={editorMode} />
            <input type="hidden" name="content" value={content} />
            {editorMode === 'builder' ? (
              <>
                <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
                <p className="rounded-lg border border-dashed border-[#6d6be8]/30 bg-[#6d6be8]/5 px-3 py-2 text-xs text-zinc-600">
                  Builder blocks are saved with this page — the classic content above stays
                  available if you switch back.
                </p>
                <PageBuilder initialBlocks={blocks} onChange={setBlocks} />
              </>
            ) : (
              <TiptapEditor
                value={content}
                onChange={setContent}
                placeholder="Start writing…"
                minHeight={360}
              />
            )}
          </CardContent>
        </Card>

        {/* --------------------------------------------------- search / meta */}
        <Card>
          <CardHeader>
            <CardTitle>Search appearance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta title" htmlFor="page-meta-title">
              <Input
                id="page-meta-title"
                name="metaTitle"
                value={metaTitle}
                onChange={(event) => setMetaTitle(event.target.value)}
                placeholder={title || 'Page title'}
                maxLength={255}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Meta description"
                htmlFor="page-meta-description"
                hint="Recommended length: up to about 160 characters."
              >
                <Textarea
                  id="page-meta-description"
                  name="metaDescription"
                  rows={3}
                  value={metaDescription}
                  onChange={(event) => setMetaDescription(event.target.value)}
                />
              </Field>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------------- sidebar */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Status" htmlFor="page-status">
              <Select
                id="page-status"
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusValue)}
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </Select>
            </Field>
            <Field label="Page type" htmlFor="page-type">
              <Select
                id="page-type"
                name="pageType"
                value={pageType}
                onChange={(event) => setPageType(event.target.value)}
              >
                {PAGE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Button type="submit" className="w-full" disabled={saving || deleting}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {initial.id ? 'Save changes' : 'Create page'}
            </Button>
            <Link
              href="/cms/pages"
              className="block text-center text-xs font-medium text-zinc-500 hover:text-zinc-700"
            >
              Cancel
            </Link>

            {initial.id ? (
              <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
                <Link
                  href={`/shop/pages/${slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5b59d6] hover:underline"
                >
                  <ExternalLink size={13} /> View page
                </Link>
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
            <CardTitle>Featured image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {featuredImage ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredImage}
                  alt={excerpt || title || 'Featured image'}
                  className="aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-50 object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove featured image"
                  onClick={() => setFeaturedImage('')}
                  className="absolute right-2 top-2 rounded-md bg-zinc-900/70 p-1.5 text-white transition hover:bg-zinc-900"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : null}
            <input type="hidden" name="featuredImage" value={featuredImage} />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setPickerOpen(true)}
            >
              <ImagePlus size={14} />
              {featuredImage ? 'Change image' : 'Choose from media library'}
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
          if (url) setFeaturedImage(url);
        }}
      />
    </form>
  );
}

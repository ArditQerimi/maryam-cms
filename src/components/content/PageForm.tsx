'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
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
import { useLocale } from '@/lib/i18n/LocaleProvider';

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
  { value: 'page', key: 'cmsshared.page_form.type_page' },
  { value: 'landing', key: 'cmsshared.page_form.type_landing' },
  { value: 'legal', key: 'cmsshared.page_form.type_legal' },
] as const;

const EDITOR_TABS = [
  { id: 'classic', labelKey: 'cmsshared.page_form.tab_classic' },
  { id: 'builder', labelKey: 'cmsshared.page_form.tab_builder' },
] as const;

export default function PageForm({
  initial,
  previewTheme,
}: {
  initial: PageFormInitial;
  previewTheme?: Record<string, string>;
}) {
  const router = useRouter();
  const { t } = useLocale();
  /** Lets the builder's Publish button / Ctrl+S submit this very form. */
  const formRef = useRef<HTMLFormElement>(null);

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
        toast.error(result.error || t('cmsshared.page_form.save_error'));
        return;
      }
      toast.success(initial.id ? t('cmsshared.page_form.updated') : t('cmsshared.page_form.created'));
      router.push('/cms/pages');
      router.refresh();
    } catch {
      toast.error(t('cmsshared.page_form.save_failed'));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!initial.id || deleting) return;
    if (!window.confirm(t('cmsshared.page_form.delete_confirm', { title }))) return;
    setDeleting(true);
    try {
      const result = await deletePage(initial.id);
      if (!result.ok) {
        toast.error(result.error || t('cmsshared.page_form.delete_error'));
        return;
      }
      toast.success(t('cmsshared.page_form.deleted'));
      router.push('/cms/pages');
      router.refresh();
    } catch {
      toast.error(t('cmsshared.page_form.delete_error'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* ------------------------------------------------------ main fields */}
        <Card>
          <CardHeader>
            <CardTitle>{t('cmsshared.page_form.details_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t('cmsshared.field.title')} htmlFor="page-title">
              <Input
                id="page-title"
                name="title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder={t('cmsshared.page_form.title_placeholder')}
                autoFocus
              />
            </Field>
            <Field
              label={t('cmsshared.product_editor.slug_label')}
              htmlFor="page-slug"
              hint={t('cmsshared.page_form.slug_hint', { slug: slug || 'your-slug' })}
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
              label={t('cmsshared.post_form.excerpt_label')}
              htmlFor="page-excerpt"
              hint={t('cmsshared.page_form.excerpt_hint')}
            >
              <Textarea
                id="page-excerpt"
                name="excerpt"
                rows={3}
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                placeholder={t('cmsshared.page_form.excerpt_placeholder')}
              />
            </Field>
          </CardContent>
        </Card>

        {/* --------------------------------------------------- search / meta */}
        <Card>
          <CardHeader>
            <CardTitle>{t('cmsshared.page_form.search_title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label={t('cmsshared.page_form.meta_title_label')} htmlFor="page-meta-title">
              <Input
                id="page-meta-title"
                name="metaTitle"
                value={metaTitle}
                onChange={(event) => setMetaTitle(event.target.value)}
                placeholder={title || t('cmsshared.page_form.meta_title_placeholder')}
                maxLength={255}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label={t('cmsshared.page_form.meta_description_label')}
                htmlFor="page-meta-description"
                hint={t('cmsshared.page_form.meta_description_hint')}
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
            <CardTitle>{t('cmsshared.post_form.publish_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t('cmsshared.field.status')} htmlFor="page-status">
              <Select
                id="page-status"
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusValue)}
              >
                <option value="Draft">{t('cmsshared.post_form.status_draft')}</option>
                <option value="Published">{t('cmsshared.post_form.status_published')}</option>
                <option value="Archived">{t('cmsshared.post_form.status_archived')}</option>
              </Select>
            </Field>
            <Field label={t('cmsshared.page_form.type_label')} htmlFor="page-type">
              <Select
                id="page-type"
                name="pageType"
                value={pageType}
                onChange={(event) => setPageType(event.target.value)}
              >
                {PAGE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {t(type.key)}
                  </option>
                ))}
              </Select>
            </Field>

            <Button type="submit" className="w-full" disabled={saving || deleting}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {initial.id ? t('cmsshared.action.save_changes') : t('cmsshared.page_form.create')}
            </Button>
            <Link
              href="/cms/pages"
              className="block text-center text-xs font-medium text-zinc-500 hover:text-zinc-700"
            >
              {t('cmsshared.action.cancel')}
            </Link>

            {initial.id ? (
              <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
                <Link
                  href={`/home/pages/${slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5b59d6] hover:underline"
                >
                  <ExternalLink size={13} /> {t('cmsshared.page_form.view')}
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
                  {t('cmsshared.action.delete')}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('cmsshared.product_editor.featured_label')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {featuredImage ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredImage}
                  alt={excerpt || title || t('cmsshared.product_editor.featured_label')}
                  className="aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-50 object-cover"
                />
                <button
                  type="button"
                  aria-label={t('cmsshared.page_form.remove_featured_aria')}
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
              {featuredImage
                ? t('cmsshared.post_form.change_image')
                : t('cmsshared.post_form.choose_library')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Editor last and full width — the builder needs the whole row to be usable. */}
      <Card className="lg:col-span-3">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t('cmsshared.post_form.content_title')}</CardTitle>
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
                {t(tab.labelKey)}
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
                {t('cmsshared.page_form.builder_note')}
              </p>
              <PageBuilder
                initialBlocks={blocks}
                onChange={setBlocks}
                pageLabel={title || t('cmsshared.page_form.untitled')}
                previewTheme={previewTheme}
                onSave={() => formRef.current?.requestSubmit()}
              />
            </>
          ) : (
            <TiptapEditor
              value={content}
              onChange={setContent}
              placeholder={t('cmsshared.page_form.editor_placeholder')}
              minHeight={360}
            />
          )}
        </CardContent>
      </Card>

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

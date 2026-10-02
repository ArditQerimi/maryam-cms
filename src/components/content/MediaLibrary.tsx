'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { Copy, FileText, Film, Loader2, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { deleteMedia, updateMedia, uploadMedia } from '@/app/cms/actions/media';
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, cn, inputClass } from '@/components/admin/ui';
import { formatDate } from '@/lib/cms/format';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';

export type MediaItem = {
  id: number;
  filename: string;
  originalName: string | null;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  folder: string;
  /** `Date` from the server component, `string` when re-fetched from the API. */
  createdAt: Date | string;
};

type MediaKind = 'all' | 'images' | 'videos' | 'documents';

const KINDS: Array<{ value: MediaKind; labelKey: keyof Dictionary }> = [
  { value: 'all', labelKey: 'cmsshared.media.kind_all' },
  { value: 'images', labelKey: 'cmsshared.media.kind_images' },
  { value: 'videos', labelKey: 'cmsshared.media.kind_videos' },
  { value: 'documents', labelKey: 'cmsshared.media.kind_documents' },
];

function isImage(item: MediaItem) {
  return (
    (item.mimeType || '').startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(item.url)
  );
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibrary({ initialItems }: { initialItems: MediaItem[] }) {
  const { t } = useLocale();
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<MediaKind>('all');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ id: number; name: string; alt: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const firstRun = useRef(true);

  const selected = selectedId === null ? null : items.find((item) => item.id === selectedId) ?? null;

  const load = useCallback(async (q: string, selectedKind: MediaKind) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '300' });
      const trimmed = q.trim();
      if (trimmed) params.set('q', trimmed);
      if (selectedKind !== 'all') params.set('type', selectedKind);
      const res = await fetch(`/api/cms/media?${params.toString()}`, { cache: 'no-store' });
      const data = (await res.json()) as { items?: MediaItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      toast.error(t('cmsshared.media.load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Debounced refresh whenever the search box or the type filter changes.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const handle = setTimeout(() => {
      void load(query, kind);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, kind, load]);

  // Reset the detail-panel edits whenever another tile is selected.
  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({
      id: selected.id,
      name: selected.originalName || selected.filename,
      alt: selected.altText || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    if (files.length > 12) {
      toast.error(t('cmsshared.media.upload_limit'));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of files) formData.append('files', file);
      const result = await uploadMedia(formData);
      if (!result.ok) {
        toast.error(result.error || t('cmsshared.media.upload_error'));
        return;
      }
      toast.success(
        result.uploaded === 1
          ? t('cmsshared.media.uploaded_one', { count: String(result.uploaded) })
          : t('cmsshared.media.uploaded_many', { count: String(result.uploaded) }),
      );
      await load(query, kind);
    } catch {
      toast.error(t('cmsshared.media.upload_error'));
    } finally {
      setUploading(false);
    }
  }

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void uploadFiles(files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void uploadFiles(Array.from(event.dataTransfer.files ?? []));
  }

  async function onSave() {
    if (!draft || !selected || saving) return;
    const name = draft.name.trim();
    const alt = draft.alt;
    setSaving(true);
    try {
      const result = await updateMedia(draft.id, { originalName: name, altText: alt });
      if (!result.ok) {
        toast.error(result.error || t('cmsshared.media.update_error'));
        return;
      }
      toast.success(t('cmsshared.media.updated'));
      setItems((current) =>
        current.map((item) =>
          item.id === draft.id
            ? { ...item, originalName: name || item.originalName, altText: alt }
            : item,
        ),
      );
    } catch {
      toast.error(t('cmsshared.media.update_error'));
    } finally {
      setSaving(false);
    }
  }

  async function onCopyUrl() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.url);
      toast.success(t('cmsshared.media.copy_success'));
    } catch {
      toast.error(t('cmsshared.media.copy_error'));
    }
  }

  async function onDelete() {
    if (!selected || deleting) return;
    const label = selected.originalName || selected.filename;
    if (!window.confirm(t('cmsshared.media.delete_confirm', { label }))) return;
    setDeleting(true);
    try {
      const result = await deleteMedia(selected.id);
      if (!result.ok) {
        toast.error(result.error || t('cmsshared.media.delete_error'));
        return;
      }
      toast.success(t('cmsshared.media.deleted'));
      setItems((current) => current.filter((item) => item.id !== selected.id));
      setSelectedId(null);
    } catch {
      toast.error(t('cmsshared.media.delete_error'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">
        {/* ------------------------------------------------------- toolbar */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={onFilesChange}
              accept="image/*,video/*,application/pdf"
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <UploadCloud size={14} />
              )}
              {uploading ? t('cmsshared.media.uploading') : t('cmsshared.media.upload')}
            </Button>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('cmsshared.media.search_placeholder')}
                aria-label={t('cmsshared.media.search_aria')}
                className={cn(inputClass, 'w-56 pl-9')}
              />
            </div>
            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                <Loader2 size={13} className="animate-spin" /> {t('cmsshared.media.loading')}
              </span>
            ) : null}
          </div>

          <div className="inline-flex shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            {KINDS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setKind(entry.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition',
                  kind === entry.value
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700',
                )}
              >
                {t(entry.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* --------------------------------------------------- grid + drop zone */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'relative rounded-xl border-2 border-dashed p-3 transition',
            dragOver ? 'border-[#6d6be8] bg-[#6d6be8]/5' : 'border-transparent bg-white',
          )}
        >
          {dragOver ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[#6d6be8]/10 text-sm font-medium text-[#4f4dd6]">
              {t('cmsshared.media.drop')}
            </div>
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              title={
                query || kind !== 'all'
                  ? t('cmsshared.media.no_results_title')
                  : t('cmsshared.media.empty_title')
              }
              description={
                query || kind !== 'all'
                  ? t('cmsshared.media.no_results_description')
                  : t('cmsshared.media.empty_description')
              }
              action={
                <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <UploadCloud size={14} /> {t('cmsshared.media.upload_files')}
                </Button>
              }
              icon={<UploadCloud size={28} />}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {items.map((item) => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'group overflow-hidden rounded-lg border text-left transition',
                      active
                        ? 'border-[#6d6be8] ring-2 ring-[#6d6be8]/30'
                        : 'border-zinc-200 hover:border-zinc-300',
                    )}
                  >
                    <span className="relative block aspect-square bg-zinc-100">
                      {isImage(item) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.url}
                          alt={item.altText || ''}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-zinc-400">
                          {(item.mimeType || '').startsWith('video/') ? (
                            <Film size={24} />
                          ) : (
                            <FileText size={24} />
                          )}
                        </span>
                      )}
                    </span>
                    <span className="block truncate bg-white px-2 py-1.5 text-[11px] text-zinc-500">
                      {item.originalName || item.filename}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-zinc-400">
          {items.length === 1
            ? t('cmsshared.media.count_one', { count: items.length })
            : t('cmsshared.media.count_many', { count: items.length })}
          {uploading ? t('cmsshared.media.uploading_suffix') : ''}
        </p>
      </div>

      {/* ----------------------------------------------------- detail panel */}
      {selected ? (
        <aside className="w-full shrink-0 xl:w-80">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{t('cmsshared.media.details_title')}</CardTitle>
              <button
                type="button"
                aria-label={t('cmsshared.media.close_aria')}
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X size={15} />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex max-h-56 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                {isImage(selected) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.url}
                    alt={selected.altText || ''}
                    className="max-h-52 w-auto max-w-full object-contain"
                  />
                ) : (
                  <span className="flex flex-col items-center gap-2 py-6 text-zinc-400">
                    {(selected.mimeType || '').startsWith('video/') ? (
                      <Film size={30} />
                    ) : (
                      <FileText size={30} />
                    )}
                    <span className="text-xs">{selected.mimeType || t('cmsshared.media.file_fallback')}</span>
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="media-filename"
                    className="mb-1.5 block text-sm font-medium text-zinc-700"
                  >
                    {t('cmsshared.media.file_name_label')}
                  </label>
                  <Input
                    id="media-filename"
                    value={draft?.name ?? ''}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, name: event.target.value } : current,
                      )
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="media-alt"
                    className="mb-1.5 block text-sm font-medium text-zinc-700"
                  >
                    {t('cmsshared.media.alt_label')}
                  </label>
                  <Input
                    id="media-alt"
                    value={draft?.alt ?? ''}
                    placeholder={t('cmsshared.media.alt_placeholder')}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, alt: event.target.value } : current,
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={onSave} disabled={saving}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                  {t('cmsshared.action.save_changes')}
                </Button>
                <Button size="sm" variant="outline" onClick={onCopyUrl}>
                  <Copy size={13} /> {t('cmsshared.media.copy_url')}
                </Button>
              </div>

              <dl className="space-y-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                <div className="flex justify-between gap-3">
                  <dt>{t('cmsshared.media.meta_type')}</dt>
                  <dd className="truncate text-right text-zinc-700">
                    {selected.mimeType || '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{t('cmsshared.media.meta_size')}</dt>
                  <dd className="text-right text-zinc-700">{formatBytes(selected.sizeBytes)}</dd>
                </div>
                {selected.width && selected.height ? (
                  <div className="flex justify-between gap-3">
                    <dt>{t('cmsshared.media.meta_dimensions')}</dt>
                    <dd className="text-right text-zinc-700">
                      {selected.width} × {selected.height}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt>{t('cmsshared.media.meta_uploaded')}</dt>
                  <dd className="text-right text-zinc-700">
                    {formatDate(selected.createdAt, true)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{t('cmsshared.media.meta_folder')}</dt>
                  <dd className="truncate text-right text-zinc-700">{selected.folder}</dd>
                </div>
              </dl>

              <Button
                type="button"
                variant="danger"
                size="sm"
                className="w-full"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {t('cmsshared.media.delete_file')}
              </Button>
            </CardContent>
          </Card>
        </aside>
      ) : null}
    </div>
  );
}

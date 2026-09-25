'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2, Search, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadMedia } from '@/app/cms/actions/media';
import { Button, cn, inputClass } from '@/components/admin/ui';

export type PickedMedia = { url: string; alt?: string; id?: number };

type MediaItem = {
  id: number;
  url: string;
  originalName?: string | null;
  altText?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

function isImage(item: MediaItem) {
  return (item.mimeType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(item.url);
}

export default function MediaPickerModal({
  open,
  mode = 'single',
  onClose,
  onSelect,
}: {
  open: boolean;
  mode?: 'single' | 'multi';
  onClose: () => void;
  onSelect: (items: PickedMedia[]) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cms/media?q=${encodeURIComponent(q)}&type=images&limit=300`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    load('');
    setSelected([]);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function onSearch(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(value), 280);
  }

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || !files.length) return;
    const formData = new FormData();
    for (const file of Array.from(files)) formData.append('files', file);
    setUploading(true);
    try {
      const result = await uploadMedia(formData);
      if (!result.ok) toast.error(result.error || 'Upload failed');
      else {
        toast.success(`Uploaded ${result.uploaded} file${result.uploaded === 1 ? '' : 's'}`);
        await load(query);
      }
    } finally {
    setUploading(false);
      event.target.value = '';
    }
  }

  function toggle(item: MediaItem) {
    if (!isImage(item)) return;
    setSelected((current) => {
      if (mode === 'single') return current.includes(item.id) ? [] : [item.id];
      return current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id];
    });
  }

  function confirm() {
    const chosen = items
      .filter((item) => selected.includes(item.id))
      .map((item) => ({ url: item.url, alt: item.altText || '', id: item.id }));
    if (!chosen.length) return;
    onSelect(mode === 'single' ? chosen.slice(0, 1) : chosen);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close media library"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
      />
      <div className="relative flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Media library</h2>
            <p className="text-xs text-zinc-500">
              {mode === 'single' ? 'Pick one image' : 'Pick one or more images'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Search files…"
                className={cn(inputClass, 'w-52 pl-9')}
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              Upload
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={onUpload} />

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-full items-center justify-center text-zinc-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ImageOff size={30} className="mb-3 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-700">No images yet</p>
              <p className="mt-1 text-xs text-zinc-500">Upload an image to use it in your pages.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((item) => {
                const active = selected.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item)}
                    className={cn(
                      'group relative overflow-hidden rounded-lg border-2 text-left transition',
                      active ? 'border-[#6d6be8] ring-2 ring-[#6d6be8]/30' : 'border-transparent hover:border-zinc-300',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.altText || ''} className="aspect-square w-full object-cover" />
                    <span className="block truncate bg-white px-2 py-1.5 text-[11px] text-zinc-500">
                      {item.originalName || item.url.split('/').pop()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3.5">
          <p className="text-xs text-zinc-500">
            {selected.length ? `${selected.length} selected` : 'Nothing selected'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirm} disabled={!selected.length}>
              Insert
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

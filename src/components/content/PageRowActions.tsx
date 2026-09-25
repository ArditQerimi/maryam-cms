'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { deletePage, duplicatePage } from '@/app/cms/actions/pages';
import { Button } from '@/components/admin/ui';

/** Edit / duplicate / delete controls for one row of the pages table. */
export default function PageRowActions({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'duplicate' | 'delete' | null>(null);

  async function onDuplicate() {
    setBusy('duplicate');
    try {
      const result = await duplicatePage(id);
      if (result.ok) {
        toast.success('Page duplicated.');
        router.refresh();
      } else {
        toast.error(result.error || 'Could not duplicate the page.');
      }
    } catch {
      toast.error('Could not duplicate the page.');
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy('delete');
    try {
      const result = await deletePage(id);
      if (result.ok) {
        toast.success('Page deleted.');
        router.refresh();
      } else {
        toast.error(result.error || 'Could not delete the page.');
      }
    } catch {
      toast.error('Could not delete the page.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={`/cms/pages/${id}/edit`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
      >
        <Pencil size={12} /> Edit
      </Link>
      <Button
        variant="outline"
        size="sm"
        onClick={onDuplicate}
        disabled={busy !== null}
        aria-label={`Duplicate ${title}`}
      >
        {busy === 'duplicate' ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
        Duplicate
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-red-600"
        onClick={onDelete}
        disabled={busy !== null}
        aria-label={`Delete ${title}`}
      >
        {busy === 'delete' ? <Loader2 size={12} className="animate-spin" /> : null}
        Delete
      </Button>
    </div>
  );
}

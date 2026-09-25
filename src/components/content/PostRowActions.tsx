'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { deletePost, duplicatePost } from '@/app/cms/actions/posts';
import { Button } from '@/components/admin/ui';

/** Edit / duplicate / delete controls for one row of the posts table. */
export default function PostRowActions({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'duplicate' | 'delete' | null>(null);

  async function onDuplicate() {
    setBusy('duplicate');
    try {
      const result = await duplicatePost(id);
      if (result.ok) {
        toast.success('Post duplicated.');
        router.refresh();
      } else {
        toast.error(result.error || 'Could not duplicate the post.');
      }
    } catch {
      toast.error('Could not duplicate the post.');
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy('delete');
    try {
      const result = await deletePost(id);
      if (result.ok) {
        toast.success('Post deleted.');
        router.refresh();
      } else {
        toast.error(result.error || 'Could not delete the post.');
      }
    } catch {
      toast.error('Could not delete the post.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={`/cms/posts/${id}/edit`}
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

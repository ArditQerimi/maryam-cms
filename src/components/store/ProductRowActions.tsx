'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteProduct, duplicateProduct } from '@/app/cms/actions/products';
import { Button } from '@/components/admin/ui';

/** Edit / view / duplicate / delete controls for one row of the products table. */
export default function ProductRowActions({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'duplicate' | 'delete' | null>(null);

  async function onDuplicate() {
    setBusy('duplicate');
    try {
      const result = await duplicateProduct(id);
      if (result.ok) {
        toast.success('Product duplicated.');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Could not duplicate the product.');
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy('delete');
    try {
      const result = await deleteProduct(id);
      if (result.ok) {
        toast.success('Product deleted.');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Could not delete the product.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={`/cms/products/${id}/edit`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
        aria-label={`Edit ${name}`}
      >
        <Pencil size={12} /> Edit
      </Link>
      <Link
        href={`/shop/products/${id}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
        aria-label={`View ${name} in the shop`}
      >
        <ExternalLink size={12} /> Shop
      </Link>
      <Button
        variant="outline"
        size="sm"
        onClick={onDuplicate}
        disabled={busy !== null}
        aria-label={`Duplicate ${name}`}
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
        aria-label={`Delete ${name}`}
      >
        {busy === 'delete' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      </Button>
    </div>
  );
}

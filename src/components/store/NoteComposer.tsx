'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Label, Textarea } from '@/components/admin/ui';
import { addOrderNote } from '@/app/cms/actions/orders';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/** Adds an internal (or customer-visible) note to an order. */
export default function NoteComposer({ orderId }: { orderId: number }) {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('orderId', String(orderId));

    setBusy(true);
    try {
      const result = await addOrderNote(formData);
      if (result.ok) {
        toast.success(t('cmsshared.note.success'));
        form.reset();
        router.refresh();
      } else {
        toast.error(result.error || t('cmsshared.note.error'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.note.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor={`note-body-${orderId}`}>{t('cmsshared.note.title')}</Label>
        <Textarea
          id={`note-body-${orderId}`}
          name="body"
          required
          maxLength={4000}
          placeholder={t('cmsshared.note.order_placeholder')}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            name="isCustomerNote"
            className="h-4 w-4 rounded border-zinc-300 accent-[#6d6be8]"
          />
          {t('cmsshared.note.visible_to_customer')}
        </label>
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {t('cmsshared.note.submit')}
        </Button>
      </div>
    </form>
  );
}

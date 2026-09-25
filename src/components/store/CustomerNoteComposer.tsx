'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Label, Textarea } from '@/components/admin/ui';
import { addCustomerNote } from '@/app/cms/actions/customers';

/** Appends an internal note to a customer's CRM record. */
export default function CustomerNoteComposer({ customerId }: { customerId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('customerId', String(customerId));

    setBusy(true);
    try {
      const result = await addCustomerNote(formData);
      if (result.ok) {
        toast.success('Note added.');
        form.reset();
        router.refresh();
      } else {
        toast.error(result.error || 'Could not add the note.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the note.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor={`customer-note-${customerId}`}>Add a note</Label>
        <Textarea
          id={`customer-note-${customerId}`}
          name="body"
          required
          maxLength={4000}
          placeholder="Preferences, credit terms, follow-ups…"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          Add note
        </Button>
      </div>
    </form>
  );
}

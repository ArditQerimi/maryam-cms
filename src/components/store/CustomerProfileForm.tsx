'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/admin/ui';
import { updateCustomerProfile } from '@/app/cms/actions/customers';

/** Inline profile form (name / email / phone) for a CRM customer. */
export default function CustomerProfileForm({
  customerId,
  initial,
}: {
  customerId: number;
  initial: { name: string; email: string; phone: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await updateCustomerProfile(customerId, formData);
      if (result.ok) {
        toast.success('Customer profile saved.');
        router.refresh();
      } else {
        toast.error(result.error || 'Could not save the profile.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Name" htmlFor="customer-name">
        <Input id="customer-name" name="name" required maxLength={255} defaultValue={initial.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="customer-email">
          <Input
            id="customer-email"
            name="email"
            type="email"
            maxLength={255}
            defaultValue={initial.email}
          />
        </Field>
        <Field label="Phone" htmlFor="customer-phone">
          <Input id="customer-phone" name="phone" maxLength={50} defaultValue={initial.phone} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          Save profile
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input, Textarea } from '@/components/admin/ui';
import { updateCustomerAddress } from '@/app/cms/actions/customers';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/** Inline address form for a CRM customer (POS storefront address column). */
export default function CustomerAddressForm({
  customerId,
  initial,
}: {
  customerId: number;
  initial: {
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await updateCustomerAddress(customerId, formData);
      if (result.ok) {
        toast.success(t('cmsshared.customer.address.success'));
        router.refresh();
      } else {
        toast.error(result.error || t('cmsshared.customer.address.error'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.customer.address.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label={t('cmsshared.field.address')} htmlFor="customer-address">
        <Textarea
          id="customer-address"
          name="address"
          className="min-h-20"
          maxLength={1000}
          defaultValue={initial.address}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('cmsshared.field.city')} htmlFor="customer-city">
          <Input id="customer-city" name="city" maxLength={100} defaultValue={initial.city} />
        </Field>
        <Field label={t('cmsshared.field.region_state')} htmlFor="customer-state">
          <Input id="customer-state" name="state" maxLength={100} defaultValue={initial.state} />
        </Field>
        <Field label={t('cmsshared.field.country')} htmlFor="customer-country">
          <Input id="customer-country" name="country" maxLength={100} defaultValue={initial.country} />
        </Field>
        <Field label={t('cmsshared.field.postal_code')} htmlFor="customer-postal">
          <Input id="customer-postal" name="postalCode" maxLength={30} defaultValue={initial.postalCode} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {t('cmsshared.customer.address.submit')}
        </Button>
      </div>
    </form>
  );
}

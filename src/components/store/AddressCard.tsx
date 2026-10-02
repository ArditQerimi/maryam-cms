'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/admin/ui';
import { updateOrderAddress } from '@/app/cms/actions/orders';
import { useLocale } from '@/lib/i18n/LocaleProvider';

type AddressMode = 'storefront' | 'customer';
type AddressKind = 'billing' | 'shipping';

const STOREFRONT_FIELDS = [
  { name: 'firstName', key: 'cmsshared.field.first_name' },
  { name: 'lastName', key: 'cmsshared.field.last_name' },
  { name: 'company', key: 'cmsshared.field.company' },
  { name: 'address1', key: 'cmsshared.field.address_line_1', required: true },
  { name: 'address2', key: 'cmsshared.field.address_line_2' },
  { name: 'city', key: 'cmsshared.field.city' },
  { name: 'region', key: 'cmsshared.field.region_state' },
  { name: 'postalCode', key: 'cmsshared.field.postal_code' },
  { name: 'country', key: 'cmsshared.field.country' },
] as const;

const CUSTOMER_FIELDS = [
  { name: 'address', key: 'cmsshared.field.address', required: true },
  { name: 'city', key: 'cmsshared.field.city' },
  { name: 'state', key: 'cmsshared.field.region_state' },
  { name: 'country', key: 'cmsshared.field.country' },
  { name: 'postalCode', key: 'cmsshared.field.postal_code' },
] as const;

/**
 * Reads/edits one address of an order. Storefront orders keep their address as
 * a jsonb record in `storefront_order_details`; POS orders edit the linked CRM
 * customer record instead — both go through `updateOrderAddress`.
 */
export default function AddressCard({
  orderId,
  mode,
  kind,
  initial,
}: {
  orderId: number;
  mode: AddressMode;
  kind: AddressKind;
  initial: Record<string, string>;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fields = mode === 'storefront' ? STOREFRONT_FIELDS : CUSTOMER_FIELDS;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const result = await updateOrderAddress(orderId, mode, kind, formData);
      if (result.ok) {
        toast.success(
          kind === 'billing'
            ? t('cmsshared.address.billing_updated')
            : t('cmsshared.address.shipping_updated'),
        );
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error || t('cmsshared.customer.address.error'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.customer.address.error'));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    const lines = fields
      .map((field) => (initial[field.name] || '').trim())
      .filter(Boolean);

    return (
      <div>
        {lines.length ? (
          <address className="text-sm not-italic leading-6 text-zinc-700">
            {mode === 'customer' ? (
              lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))
            ) : (
              <>
                {[initial.firstName, initial.lastName].filter(Boolean).join(' ') ? (
                  <span className="block font-medium text-zinc-900">
                    {[initial.firstName, initial.lastName].filter(Boolean).join(' ')}
                  </span>
                ) : null}
                {initial.company ? <span className="block">{initial.company}</span> : null}
                {initial.address1 ? <span className="block">{initial.address1}</span> : null}
                {initial.address2 ? <span className="block">{initial.address2}</span> : null}
                <span className="block">
                  {[initial.city, initial.region, initial.postalCode]
                    .filter(Boolean)
                    .join(', ')}
                </span>
                {initial.country ? <span className="block">{initial.country}</span> : null}
              </>
            )}
          </address>
        ) : (
          <p className="flex items-center gap-2 text-sm text-zinc-400">
            <MapPin size={14} /> {t('cmsshared.address.empty')}
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 -ml-2"
          onClick={() => setEditing(true)}
        >
          <Pencil size={13} /> {t('cmsshared.address.edit')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.name}
            label={t(field.key)}
            htmlFor={`${kind}-${field.name}`}
            className={field.name === 'address1' || field.name === 'address2' || field.name === 'address' ? 'sm:col-span-2' : undefined}
          >
            <Input
              id={`${kind}-${field.name}`}
              name={field.name}
              required={'required' in field ? field.required : false}
              defaultValue={initial[field.name] || ''}
            />
          </Field>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="md" disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {t('cmsshared.customer.address.submit')}
        </Button>
        <Button type="button" variant="ghost" size="md" disabled={saving} onClick={() => setEditing(false)}>
          {t('cmsshared.action.cancel')}
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        {mode === 'storefront'
          ? t('cmsshared.address.help_storefront')
          : t('cmsshared.address.help_customer')}
      </p>
    </form>
  );
}

export type { AddressMode, AddressKind };

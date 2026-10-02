'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input, Select } from '@/components/admin/ui';
import { createCoupon, updateCoupon } from '@/app/cms/actions/coupons';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export const COUPON_STATUSES = [
  'Active',
  'Inactive',
  'Archived',
  'Pending',
  'Suspended',
] as const;
export const COUPON_DISCOUNT_TYPES = ['Percentage', 'Fixed'] as const;

/** A coupon as handed to the form by the server component. */
export type CouponFormValues = {
  id: number;
  code: string;
  discountType: 'Percentage' | 'Fixed';
  /** "10.00" */
  discountValue: string;
  /** yyyy-mm-dd */
  startDate: string;
  /** yyyy-mm-dd (empty = no end date) */
  endDate: string;
  usageLimit: number;
  status: string;
};

/**
 * Create / edit card for `/cms/coupons`. Without `coupon` it creates, with it
 * it edits (`?edit=<id>` on the same route).
 */
export default function CouponForm({ coupon }: { coupon?: CouponFormValues | null }) {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const editing = Boolean(coupon);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);

    const rawValue = String(formData.get('discountValue') || '').replace(',', '.');
    const value = Number(rawValue);
    if (!rawValue || !Number.isFinite(value) || value <= 0) {
      toast.error(t('cmsshared.coupon.invalid_value'));
      return;
    }

    const start = String(formData.get('startDate') || '');
    const end = String(formData.get('endDate') || '');
    if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
      toast.error(t('cmsshared.coupon.invalid_range'));
      return;
    }

    setBusy(true);
    try {
      const result = coupon
        ? await updateCoupon(coupon.id, formData)
        : await createCoupon(formData);
      if (result.ok) {
        toast.success(editing ? t('cmsshared.coupon.updated') : t('cmsshared.coupon.created'));
        if (editing) router.push('/cms/coupons');
        else {
          form.reset();
          router.refresh();
        }
      } else {
        toast.error(result.error || t('cmsshared.coupon.error'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.coupon.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('cmsshared.coupon.code')} htmlFor="coupon-code" className="sm:col-span-2">
          <Input
            id="coupon-code"
            name="code"
            required
            maxLength={100}
            placeholder="SUMMER10"
            defaultValue={coupon?.code ?? ''}
          />
        </Field>

        <Field label={t('cmsshared.coupon.discount_type')} htmlFor="coupon-type">
          <Select
            id="coupon-type"
            name="discountType"
            defaultValue={coupon?.discountType ?? 'Percentage'}
          >
            {COUPON_DISCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === 'Percentage'
                  ? t('cmsshared.coupon.type_percentage')
                  : t('cmsshared.coupon.type_fixed')}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t('cmsshared.coupon.value')}
          htmlFor="coupon-value"
          hint={t('cmsshared.coupon.value_hint')}
        >
          <Input
            id="coupon-value"
            name="discountValue"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={coupon?.discountValue ?? ''}
          />
        </Field>

        <Field label={t('cmsshared.coupon.start_date')} htmlFor="coupon-start">
          <Input
            id="coupon-start"
            name="startDate"
            type="date"
            defaultValue={coupon?.startDate ?? ''}
          />
        </Field>

        <Field label={t('cmsshared.coupon.end_date')} htmlFor="coupon-end">
          <Input id="coupon-end" name="endDate" type="date" defaultValue={coupon?.endDate ?? ''} />
        </Field>

        <Field label={t('cmsshared.coupon.usage_limit')} htmlFor="coupon-limit" hint={t('cmsshared.coupon.usage_hint')}>
          <Input
            id="coupon-limit"
            name="usageLimit"
            type="number"
            min="0"
            step="1"
            defaultValue={String(coupon?.usageLimit ?? 0)}
          />
        </Field>

        <Field label={t('cmsshared.coupon.status')} htmlFor="coupon-status">
          <Select id="coupon-status" name="status" defaultValue={coupon?.status ?? 'Active'}>
            {COUPON_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2">
        {editing ? (
          <Link
            href="/cms/coupons"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            {t('cmsshared.action.cancel')}
          </Link>
        ) : null}
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : editing ? <Save size={14} /> : <Plus size={14} />}
          {editing ? t('cmsshared.action.save_changes') : t('cmsshared.coupon.create')}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input, Select } from '@/components/admin/ui';
import { createCoupon, updateCoupon } from '@/app/cms/actions/coupons';

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
      toast.error('The discount value must be greater than 0.');
      return;
    }

    const start = String(formData.get('startDate') || '');
    const end = String(formData.get('endDate') || '');
    if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
      toast.error('The end date must be on or after the start date.');
      return;
    }

    setBusy(true);
    try {
      const result = coupon
        ? await updateCoupon(coupon.id, formData)
        : await createCoupon(formData);
      if (result.ok) {
        toast.success(editing ? 'Coupon updated.' : 'Coupon created.');
        if (editing) router.push('/cms/coupons');
        else {
          form.reset();
          router.refresh();
        }
      } else {
        toast.error(result.error || 'Could not save the coupon.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the coupon.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coupon code" htmlFor="coupon-code" className="sm:col-span-2">
          <Input
            id="coupon-code"
            name="code"
            required
            maxLength={100}
            placeholder="SUMMER10"
            defaultValue={coupon?.code ?? ''}
          />
        </Field>

        <Field label="Discount type" htmlFor="coupon-type">
          <Select
            id="coupon-type"
            name="discountType"
            defaultValue={coupon?.discountType ?? 'Percentage'}
          >
            {COUPON_DISCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === 'Percentage' ? 'Percentage (%)' : 'Fixed amount'}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Value"
          htmlFor="coupon-value"
          hint="Must be greater than 0 (max 100 for percentages)."
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

        <Field label="Start date" htmlFor="coupon-start">
          <Input
            id="coupon-start"
            name="startDate"
            type="date"
            defaultValue={coupon?.startDate ?? ''}
          />
        </Field>

        <Field label="End date" htmlFor="coupon-end">
          <Input id="coupon-end" name="endDate" type="date" defaultValue={coupon?.endDate ?? ''} />
        </Field>

        <Field label="Usage limit" htmlFor="coupon-limit" hint="0 = unlimited.">
          <Input
            id="coupon-limit"
            name="usageLimit"
            type="number"
            min="0"
            step="1"
            defaultValue={String(coupon?.usageLimit ?? 0)}
          />
        </Field>

        <Field label="Status" htmlFor="coupon-status">
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
            Cancel
          </Link>
        ) : null}
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : editing ? <Save size={14} /> : <Plus size={14} />}
          {editing ? 'Save changes' : 'Create coupon'}
        </Button>
      </div>
    </form>
  );
}

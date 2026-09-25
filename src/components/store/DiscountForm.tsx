'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input, Select } from '@/components/admin/ui';
import {
  createCategoryDiscount,
  createProductDiscount,
  updateCategoryDiscount,
  updateProductDiscount,
} from '@/app/cms/actions/discounts';

export const DISCOUNT_STATUSES = [
  'Active',
  'Inactive',
  'Archived',
  'Pending',
  'Suspended',
] as const;
export const DISCOUNT_TYPES = ['Percentage', 'Fixed'] as const;

export type DiscountKind = 'product' | 'category';

/** A discount row as handed to the form by the server component. */
export type DiscountFormValues = {
  id: number;
  entityId: number;
  discountType: 'Percentage' | 'Fixed';
  /** "10.00" */
  discountValue: string;
  /** yyyy-mm-dd */
  startDate: string;
  /** yyyy-mm-dd (empty = open ended) */
  endDate: string;
  status: string;
};

type ProductOption = { id: number; name: string; sku: string | null };

/**
 * Create / edit card for `/cms/discounts/{product,category}`.
 * Products are loaded from `GET /api/cms/products?limit=200`; categories are
 * passed in by the server component (they come from the `categories` table).
 */
export default function DiscountForm({
  kind,
  discount,
  categories,
}: {
  kind: DiscountKind;
  discount?: DiscountFormValues | null;
  categories?: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<ProductOption[] | null>(
    kind === 'product' ? null : [],
  );
  const editing = Boolean(discount);
  const entityLabel = kind === 'product' ? 'Product' : 'Category';

  useEffect(() => {
    if (kind !== 'product') return;
    let cancelled = false;
    fetch('/api/cms/products?limit=200')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Request failed'))))
      .then((data: { items?: ProductOption[] }) => {
        if (!cancelled) setProducts(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          toast.error('Could not load the product list.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

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
    if (formData.get('discountType') === 'Percentage' && value > 100) {
      toast.error('A percentage discount cannot be higher than 100%.');
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
      let result;
      if (kind === 'product') {
        result = discount
          ? await updateProductDiscount(discount.id, formData)
          : await createProductDiscount(formData);
      } else {
        result = discount
          ? await updateCategoryDiscount(discount.id, formData)
          : await createCategoryDiscount(formData);
      }

      if (result.ok) {
        toast.success(editing ? 'Discount updated.' : 'Discount created.');
        if (editing) router.push(`/cms/discounts/${kind}`);
        else {
          form.reset();
          router.refresh();
        }
      } else {
        toast.error(result.error || 'Could not save the discount.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the discount.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={entityLabel} htmlFor="discount-entity" className="sm:col-span-2">
          {kind === 'product' ? (
            products === null ? (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                <Loader2 size={14} className="animate-spin text-zinc-400" />
                <span className="text-sm text-zinc-500">Loading products…</span>
              </div>
            ) : (
              <Select
                id="discount-entity"
                name="productId"
                required
                defaultValue={String(discount?.entityId ?? '')}
              >
                <option value="">Pick a product…</option>
                {products.map((product) => (
                  <option key={product.id} value={String(product.id)}>
                    {product.name}
                    {product.sku ? ` (${product.sku})` : ''}
                  </option>
                ))}
              </Select>
            )
          ) : (
            <Select
              id="discount-entity"
              name="categoryId"
              required
              defaultValue={String(discount?.entityId ?? '')}
            >
              <option value="">Pick a category…</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Discount type" htmlFor="discount-type">
          <Select
            id="discount-type"
            name="discountType"
            defaultValue={discount?.discountType ?? 'Percentage'}
          >
            {DISCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === 'Percentage' ? 'Percentage (%)' : 'Fixed amount'}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Value"
          htmlFor="discount-value"
          hint="Must be greater than 0 (max 100 for percentages)."
        >
          <Input
            id="discount-value"
            name="discountValue"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={discount?.discountValue ?? ''}
          />
        </Field>

        <Field label="Start date" htmlFor="discount-start">
          <Input
            id="discount-start"
            name="startDate"
            type="date"
            defaultValue={discount?.startDate ?? ''}
          />
        </Field>

        <Field label="End date" htmlFor="discount-end">
          <Input
            id="discount-end"
            name="endDate"
            type="date"
            defaultValue={discount?.endDate ?? ''}
          />
        </Field>

        <Field label="Status" htmlFor="discount-status">
          <Select id="discount-status" name="status" defaultValue={discount?.status ?? 'Active'}>
            {DISCOUNT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {kind === 'product' && products !== null && products.length === 0 ? (
        <p className="text-sm text-zinc-500">There are no products in the catalogue yet.</p>
      ) : null}
      {kind === 'category' && (categories ?? []).length === 0 ? (
        <p className="text-sm text-zinc-500">There are no categories yet.</p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {editing ? (
          <Link
            href={`/cms/discounts/${kind}`}
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Cancel
          </Link>
        ) : null}
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : editing ? (
            <Save size={14} />
          ) : (
            <Plus size={14} />
          )}
          {editing ? 'Save changes' : 'Create discount'}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Label, Textarea } from '@/components/admin/ui';
import { refundOrder, type RefundItemInput } from '@/app/cms/actions/orders';

export type RefundLine = {
  saleItemId: number;
  quantity: number;
  unitPrice: string;
  productName: string | null;
  variantName: string | null;
};

/**
 * Dialog that records a refund. There is no refunds table in the schema, so the
 * action writes an internal order note with the refunded lines and moves the
 * sale to `Returned`.
 */
export default function RefundDialog({
  orderId,
  reference,
  lines,
}: {
  orderId: number;
  reference: string;
  lines: RefundLine[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');

  function qty(saleItemId: number) {
    return quantities[saleItemId] ?? 0;
  }

  const total = lines.reduce(
    (sum, line) => sum + Number(line.unitPrice || 0) * qty(line.saleItemId),
    0,
  );

  async function submit() {
    if (busy) return;
    const items: RefundItemInput[] = lines
      .filter((line) => qty(line.saleItemId) > 0)
      .map((line) => ({ saleItemId: line.saleItemId, quantity: qty(line.saleItemId) }));
    if (items.length === 0) {
      toast.error('Pick at least one item and quantity to refund.');
      return;
    }

    setBusy(true);
    try {
      const result = await refundOrder(orderId, { reason, items });
      if (result.ok) {
        toast.success(`Refund recorded — ${result.refunded || 'done'}.`, {
          description: `Order ${reference} was moved to Returned.`,
        });
        setOpen(false);
        setQuantities({});
        setReason('');
        router.refresh();
      } else {
        toast.error(result.error || 'Could not record the refund.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not record the refund.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="md"
        className="w-full"
        disabled={lines.length === 0}
        onClick={() => setOpen(true)}
      >
        <Undo2 size={14} /> Record refund
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Refund order ${reference}`}
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-900">
                Refund order {reference}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Select the quantities to refund. The order is marked as Returned and a refund
                note is added to its history.
              </p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {lines.map((line) => {
                  const max = line.quantity;
                  const value = Math.min(qty(line.saleItemId), max);
                  return (
                    <li
                      key={line.saleItemId}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {line.productName || 'Product'}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {line.variantName ? `${line.variantName} · ` : ''}
                          {max} × {Number(line.unitPrice).toFixed(2)}
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={max}
                        value={value}
                        aria-label={`Refund quantity for ${line.productName || 'item'}`}
                        onChange={(event) => {
                          const next = Math.max(
                            0,
                            Math.min(max, Math.floor(Number(event.target.value) || 0)),
                          );
                          setQuantities((prev) => ({ ...prev, [line.saleItemId]: next }));
                        }}
                        className="h-9 w-20 rounded-lg border border-zinc-300 px-2 text-center text-sm outline-none focus:border-[#6d6be8] focus:ring-2 focus:ring-[#6d6be8]/20"
                      />
                    </li>
                  );
                })}
              </ul>

              <div>
                <Label htmlFor={`refund-reason-${orderId}`}>Reason (optional)</Label>
                <Textarea
                  id={`refund-reason-${orderId}`}
                  className="min-h-20"
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Damaged item, customer changed their mind…"
                />
              </div>

              <p className="text-sm text-zinc-700">
                Refund total:{' '}
                <span className="font-semibold text-zinc-900">
                  {total.toLocaleString('en-IE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-4">
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" variant="danger" size="md" disabled={busy} onClick={submit}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                Confirm refund
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

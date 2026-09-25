'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Select } from '@/components/admin/ui';
import { updateOrderStatus } from '@/app/cms/actions/orders';

const STATUSES = ['Pending', 'Completed', 'Cancelled', 'Returned'] as const;

/**
 * Status editor for an order. `sales.status` is the single source of truth for
 * order state (`storefront_order_details` has no status column).
 */
export default function OrderStatusCard({
  orderId,
  status,
}: {
  orderId: number;
  status: string;
}) {
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const dirty = value !== status;

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      const result = await updateOrderStatus(orderId, value);
      if (result.ok) toast.success(`Order marked as ${value}.`);
      else toast.error(result.error || 'Could not update the order status.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the order status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Current status
        </span>
        <span className="text-sm font-medium text-zinc-900">{status}</span>
      </div>
      <Select
        aria-label="Order status"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        {STATUSES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <Button
        variant="primary"
        size="md"
        className="w-full"
        disabled={!dirty || busy}
        onClick={save}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        Save status
      </Button>
      <p className="text-xs text-zinc-500">
        Cancelling or refunding an order keeps its items and totals for reporting; refunded
        orders move to <span className="font-medium">Returned</span>.
      </p>
    </div>
  );
}

/** Quick "Mark as …" shortcut used in the order actions card. */
export function StatusPill({ orderId, status }: { orderId: number; status: string }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await updateOrderStatus(orderId, status);
      if (result.ok) toast.success(`Order marked as ${status}.`);
      else toast.error(result.error || 'Could not update the order status.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the order status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={run}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
    >
      Mark {status}
    </button>
  );
}

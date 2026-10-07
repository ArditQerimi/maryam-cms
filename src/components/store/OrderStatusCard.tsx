'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Select } from '@/components/admin/ui';
import { advanceOrderStage, decideOrder, updateOrderStatus } from '@/app/cms/actions/orders';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const STATUSES = ['Pending', 'Completed', 'Cancelled', 'Returned'] as const;

/**
 * Status editor for an order. `sales.status` is the single source of truth for
 * order state (`storefront_order_details` has no status column).
 */
/** The next step for a confirmed online order, by its current phase. */
const NEXT_STAGE = {
  confirmed: 'preparing',
  preparing: 'shipped',
  shipped: 'completed',
} as const;

export default function OrderStatusCard({
  orderId,
  status,
  phase = 'other',
}: {
  orderId: number;
  status: string;
  /** awaiting | confirmed | preparing | shipped | completed | cancelled | other (see lib/storefront/order-status). */
  phase?: string;
}) {
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const { t } = useLocale();
  const dirty = value !== status;

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      const result = await updateOrderStatus(orderId, value);
      if (result.ok) toast.success(t('cmsshared.order_status.marked', { value }));
      else toast.error(result.error || t('cmsshared.order_status.error'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.order_status.error'));
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: 'confirm' | 'cancel') {
    if (busy) return;
    setBusy(true);
    try {
      const result = await decideOrder(orderId, decision);
      if (result.ok) {
        toast.success(result.message || t('cmsshared.order_status.error'));
        if (decision === 'cancel') setValue('Cancelled');
      } else {
        toast.error(result.error || t('cmsshared.order_status.error'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.order_status.error'));
    } finally {
      setBusy(false);
    }
  }

  async function advance(stage: 'preparing' | 'shipped' | 'completed') {
    if (busy) return;
    setBusy(true);
    try {
      const result = await advanceOrderStage(orderId, stage);
      if (result.ok) toast.success(result.message || t('cmsshared.order_status.error'));
      else toast.error(result.error || t('cmsshared.order_status.error'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.order_status.error'));
    } finally {
      setBusy(false);
    }
  }

  const nextStage = phase in NEXT_STAGE ? NEXT_STAGE[phase as keyof typeof NEXT_STAGE] : null;

  return (
    <div className="space-y-3">
      {nextStage ? (
        <div className="flex gap-2">
          <Button variant="primary" size="md" className="flex-1" disabled={busy} onClick={() => advance(nextStage)}>
            {t(`cmsshared.order_stage.${nextStage}`)}
          </Button>
          <Button variant="secondary" size="md" disabled={busy} onClick={() => decide('cancel')}>
            ❌ {t('cmsshared.order_status.cancel')}
          </Button>
        </div>
      ) : null}
      {phase === 'awaiting' ? (
        <div className="flex gap-2">
          <Button variant="primary" size="md" className="flex-1" disabled={busy} onClick={() => decide('confirm')}>
            ✅ {t('cmsshared.order_status.confirm')}
          </Button>
          <Button variant="secondary" size="md" className="flex-1" disabled={busy} onClick={() => decide('cancel')}>
            ❌ {t('cmsshared.order_status.cancel')}
          </Button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t('cmsshared.order_status.current')}
        </span>
        <span className="text-sm font-medium text-zinc-900">{status}</span>
      </div>
      <Select
        aria-label={t('cmsshared.order_status.aria')}
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
        {t('cmsshared.order_status.save')}
      </Button>
      <p className="text-xs text-zinc-500">
        {t('cmsshared.order_status.help')}{' '}
        <span className="font-medium">Returned</span>.
      </p>
    </div>
  );
}

/** Quick "Mark as …" shortcut used in the order actions card. */
export function StatusPill({ orderId, status }: { orderId: number; status: string }) {
  const [busy, setBusy] = useState(false);
  const { t } = useLocale();

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await updateOrderStatus(orderId, status);
      if (result.ok) toast.success(t('cmsshared.order_status.marked', { value: status }));
      else toast.error(result.error || t('cmsshared.order_status.error'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.order_status.error'));
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
      {t('cmsshared.order_status.mark', { status })}
    </button>
  );
}

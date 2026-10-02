'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, cn } from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';

type ActionResult = { ok: boolean; error?: string };

/**
 * A button that runs a server action with serialisable `args`, optionally asks
 * for confirmation first, and reports the outcome as a toast.
 *
 * The action is passed by reference (bound server action) together with a
 * plain `args` array so the payload stays serialisable.
 */
export default function ConfirmActionButton<Args extends unknown[]>({
  action,
  args,
  confirmMessage,
  successMessage,
  variant = 'ghost',
  size = 'sm',
  className,
  disabled,
  children,
}: {
  action: (...args: Args) => Promise<ActionResult>;
  args: Args;
  confirmMessage?: string;
  successMessage?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const { t } = useLocale();

  async function run() {
    if (busy) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setBusy(true);
    try {
      const result = await action(...args);
      if (result.ok) {
        if (successMessage) toast.success(successMessage);
      } else {
        toast.error(result.error || t('cmsshared.error.something_went_wrong'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.error.something_went_wrong'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || busy}
      onClick={run}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

/** Runs an arbitrary async client handler with pending state + error toasts. */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const { t } = useLocale();

  async function run(handler: () => Promise<ActionResult>, successMessage?: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await handler();
      if (result.ok) {
        if (successMessage) toast.success(successMessage);
      } else {
        toast.error(result.error || t('cmsshared.error.something_went_wrong'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.error.something_went_wrong'));
    } finally {
      setBusy(false);
    }
  }

  return { busy, run };
}

export { cn };

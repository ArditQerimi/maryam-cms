'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, ShieldOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/admin/ui';
import { resetCustomerPassword, setCustomerAccountStatus } from '@/app/cms/actions/customers';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/**
 * Header actions for a customer profile: suspend/activate the account (which
 * also updates the linked storefront user) and reset the storefront password.
 */
export default function CustomerHeaderActions({
  customerId,
  status,
}: {
  customerId: number;
  status: string;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState<'status' | 'password' | null>(null);

  const suspended = status === 'Suspended';

  async function toggleStatus() {
    if (busy) return;
    const next = suspended ? 'Active' : 'Suspended';
    const confirmed = window.confirm(
      next === 'Suspended'
        ? t('cmsshared.customer.status.confirm_suspend')
        : t('cmsshared.customer.status.confirm_activate'),
    );
    if (!confirmed) return;

    setBusy('status');
    try {
      const result = await setCustomerAccountStatus(customerId, next);
      if (result.ok)
        toast.success(
          next === 'Suspended'
            ? t('cmsshared.customer.status.suspended_toast')
            : t('cmsshared.customer.status.reactivated_toast'),
        );
      else toast.error(result.error || t('cmsshared.customer.status.error'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.customer.status.error'));
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword() {
    if (busy) return;
    const confirmed = window.confirm(t('cmsshared.customer.status.confirm_reset'));
    if (!confirmed) return;

    setBusy('password');
    try {
      const result = await resetCustomerPassword(customerId);
      if (result.ok && result.password) {
        toast.success(t('cmsshared.customer.status.reset_success'), {
          description: result.password,
          duration: 20000,
        });
        router.refresh();
      } else {
        toast.error(result.error || t('cmsshared.customer.status.reset_error'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.customer.status.reset_error'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={suspended ? 'primary' : 'outline'}
        size="md"
        disabled={busy !== null}
        onClick={toggleStatus}
      >
        {busy === 'status' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : suspended ? (
          <ShieldCheck size={14} />
        ) : (
          <ShieldOff size={14} />
        )}
        {suspended ? t('cmsshared.customer.status.enable') : t('cmsshared.customer.status.disable')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="md"
        disabled={busy !== null}
        onClick={resetPassword}
      >
        {busy === 'password' ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
        {t('cmsshared.customer.status.reset')}
      </Button>
    </div>
  );
}

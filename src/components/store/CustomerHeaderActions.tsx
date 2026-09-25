'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, ShieldOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/admin/ui';
import { resetCustomerPassword, setCustomerAccountStatus } from '@/app/cms/actions/customers';

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
  const [busy, setBusy] = useState<'status' | 'password' | null>(null);

  const suspended = status === 'Suspended';

  async function toggleStatus() {
    if (busy) return;
    const next = suspended ? 'Active' : 'Suspended';
    const confirmed = window.confirm(
      next === 'Suspended'
        ? 'Suspend this customer? Their storefront account will be signed out and blocked.'
        : 'Reactivate this customer and their storefront account?',
    );
    if (!confirmed) return;

    setBusy('status');
    try {
      const result = await setCustomerAccountStatus(customerId, next);
      if (result.ok) toast.success(`Customer ${next === 'Suspended' ? 'suspended' : 'reactivated'}.`);
      else toast.error(result.error || 'Could not update the account status.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the account status.');
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword() {
    if (busy) return;
    const confirmed = window.confirm(
      'Generate a new temporary password for this customer? The current password stops working immediately.',
    );
    if (!confirmed) return;

    setBusy('password');
    try {
      const result = await resetCustomerPassword(customerId);
      if (result.ok && result.password) {
        toast.success('Temporary password generated — share it with the customer.', {
          description: result.password,
          duration: 20000,
        });
        router.refresh();
      } else {
        toast.error(result.error || 'Could not reset the password.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reset the password.');
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
        {suspended ? 'Enable account' : 'Disable account'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="md"
        disabled={busy !== null}
        onClick={resetPassword}
      >
        {busy === 'password' ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
        Reset password
      </Button>
    </div>
  );
}

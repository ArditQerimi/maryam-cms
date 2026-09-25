'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/admin/ui';
import { saveTracking, sendTrackingEmail } from '@/app/cms/actions/orders';

export type TrackingValues = {
  trackingNumber: string;
  carrier: string;
  trackingUrl: string;
  sentAt: string | null;
};

/**
 * Tracking editor. The customer email is sent through the shared `smtp_*`
 * settings written by /cms/settings/email — when they are missing the action
 * answers with `notConfigured` and we point the operator at that page.
 */
export default function TrackingCard({
  orderId,
  initial,
}: {
  orderId: number;
  initial: TrackingValues | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function onSave(formData: FormData) {
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveTracking(orderId, formData);
      if (result.ok) {
        toast.success('Tracking details saved.');
        router.refresh();
      } else {
        toast.error(result.error || 'Could not save the tracking details.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the tracking details.');
    } finally {
      setSaving(false);
    }
  }

  async function onSend() {
    if (sending) return;
    setSending(true);
    try {
      const result = await sendTrackingEmail(orderId);
      if (result.ok) {
        toast.success('Tracking email sent to the customer.');
        router.refresh();
      } else if (result.notConfigured) {
        toast.error(result.error || 'SMTP is not configured.', {
          description: 'Open Settings → Email (/cms/settings/email) and save your outbound email settings.',
          duration: 8000,
        });
      } else {
        toast.error(result.error || 'Could not send the tracking email.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the tracking email.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form action={onSave} className="space-y-4">
      <Field label="Tracking number" htmlFor={`trackingNumber-${orderId}`}>
        <Input
          id={`trackingNumber-${orderId}`}
          name="trackingNumber"
          defaultValue={initial?.trackingNumber || ''}
          placeholder="e.g. 1Z999AA10123456784"
        />
      </Field>
      <Field label="Carrier" htmlFor={`carrier-${orderId}`}>
        <Input
          id={`carrier-${orderId}`}
          name="carrier"
          defaultValue={initial?.carrier || ''}
          placeholder="e.g. DHL, Posta, UPS"
        />
      </Field>
      <Field
        label="Tracking URL"
        htmlFor={`trackingUrl-${orderId}`}
        hint="Optional link the customer can follow to track the parcel."
      >
        <Input
          id={`trackingUrl-${orderId}`}
          name="trackingUrl"
          type="url"
          defaultValue={initial?.trackingUrl || ''}
          placeholder="https://…"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="md" disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Save tracking
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={sending || !initial?.trackingNumber}
          onClick={onSend}
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Email customer
        </Button>
      </div>

      <p className="text-xs text-zinc-500">
        {initial?.sentAt
          ? `Last tracking email sent ${new Date(initial.sentAt).toLocaleString('en-GB')}.`
          : 'No tracking email has been sent yet.'}
      </p>
    </form>
  );
}

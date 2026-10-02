'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/admin/ui';
import { saveTracking, sendTrackingEmail } from '@/app/cms/actions/orders';
import { useLocale } from '@/lib/i18n/LocaleProvider';

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
  const { t } = useLocale();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function onSave(formData: FormData) {
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveTracking(orderId, formData);
      if (result.ok) {
        toast.success(t('cmsshared.tracking.success'));
        router.refresh();
      } else {
        toast.error(result.error || t('cmsshared.tracking.error'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.tracking.error'));
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
        toast.success(t('cmsshared.tracking.sent'));
        router.refresh();
      } else if (result.notConfigured) {
        toast.error(result.error || t('cmsshared.tracking.smtp_error'), {
          description: t('cmsshared.tracking.smtp_hint'),
          duration: 8000,
        });
      } else {
        toast.error(result.error || t('cmsshared.tracking.send_error'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.tracking.send_error'));
    } finally {
      setSending(false);
    }
  }

  return (
    <form action={onSave} className="space-y-4">
      <Field label={t('cmsshared.tracking.number')} htmlFor={`trackingNumber-${orderId}`}>
        <Input
          id={`trackingNumber-${orderId}`}
          name="trackingNumber"
          defaultValue={initial?.trackingNumber || ''}
          placeholder="e.g. 1Z999AA10123456784"
        />
      </Field>
      <Field label={t('cmsshared.tracking.carrier')} htmlFor={`carrier-${orderId}`}>
        <Input
          id={`carrier-${orderId}`}
          name="carrier"
          defaultValue={initial?.carrier || ''}
          placeholder="e.g. DHL, Posta, UPS"
        />
      </Field>
      <Field
        label={t('cmsshared.tracking.url')}
        htmlFor={`trackingUrl-${orderId}`}
        hint={t('cmsshared.tracking.url_hint')}
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
          {t('cmsshared.tracking.save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={sending || !initial?.trackingNumber}
          onClick={onSend}
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {t('cmsshared.tracking.email')}
        </Button>
      </div>

      <p className="text-xs text-zinc-500">
        {initial?.sentAt
          ? t('cmsshared.tracking.last_sent', {
              date: new Date(initial.sentAt).toLocaleString('en-GB'),
            })
          : t('cmsshared.tracking.never_sent')}
      </p>
    </form>
  );
}

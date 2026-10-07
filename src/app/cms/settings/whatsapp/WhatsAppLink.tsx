'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/admin/ui';
import { getWhatsAppStatus, sendWhatsAppTest, type WhatsAppStatus } from '@/app/cms/actions/whatsapp';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/** Link the shop's WhatsApp account: shows the QR to scan, then the linked state and a test button. */
export default function WhatsAppLink() {
  const { t } = useLocale();
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getWhatsAppStatus());
    } catch {
      setStatus({ state: 'unreachable' });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // The QR rotates every ~20s; poll faster while waiting for the scan.
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function sendTest() {
    setSending(true);
    try {
      const result = await sendWhatsAppTest();
      if (result.ok) toast.success(t('cmssettings.whatsapp.testSent'));
      else toast.error(result.error);
    } finally {
      setSending(false);
    }
  }

  if (!status) return <p className="text-sm text-zinc-500">{t('cmssettings.whatsapp.loading')}</p>;

  if (status.state === 'not-configured') {
    return <p className="text-sm text-zinc-600">{t('cmssettings.whatsapp.notConfigured')}</p>;
  }
  if (status.state === 'unreachable') {
    return <p className="text-sm text-amber-700">{t('cmssettings.whatsapp.unreachable')}</p>;
  }
  if (status.state === 'linked') {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {t('cmssettings.whatsapp.linked', { number: status.number ? `+${status.number}` : '' })}
        </p>
        <p className="text-sm text-zinc-600">
          {t('cmssettings.whatsapp.sendsTo', { number: status.sendTo ? `+${status.sendTo}` : '—' })}
        </p>
        <Button type="button" onClick={sendTest} disabled={sending}>
          {sending ? t('cmssettings.whatsapp.sending') : t('cmssettings.whatsapp.sendTest')}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">{t('cmssettings.whatsapp.scanHelp')}</p>
      {status.qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={status.qr} alt="WhatsApp QR" width={260} height={260} className="rounded-lg border border-zinc-200" />
      ) : (
        <p className="text-sm text-zinc-500">{t('cmssettings.whatsapp.qrLoading')}</p>
      )}
    </div>
  );
}

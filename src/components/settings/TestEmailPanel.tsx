'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/admin/ui';
import { sendTestEmail } from '@/app/cms/actions/settings';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/**
 * "Send test email" — renders inside the SMTP SettingsForm so it sits above
 * the save button. Uses the SAVED settings, so save first, then send.
 */
export default function TestEmailPanel() {
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const { t } = useLocale();

  async function send() {
    if (sending) return;
    const target = recipient.trim();
    if (!target) {
      toast.error(t('cmsshared.settings.test.address_required'));
      return;
    }
    setSending(true);
    try {
      const result = await sendTestEmail(target);
      if (result.ok) {
        toast.success(t('cmsshared.settings.test.sent', { target }));
      } else {
        toast.error(result.error || t('cmsshared.settings.test.send_error'));
      }
    } catch (error) {
      console.error('[cms/settings] test email failed', error);
      toast.error(t('cmsshared.settings.test.send_failed'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label
          htmlFor="smtp-test-recipient"
          className="mb-1.5 block text-sm font-medium text-zinc-700"
        >
          {t('cmsshared.settings.test.label')}
        </label>
        <Input
          id="smtp-test-recipient"
          type="email"
          placeholder="you@example.com"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void send();
            }
          }}
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          {t('cmsshared.settings.test.help')}
        </p>
      </div>
      <Button variant="secondary" onClick={() => void send()} disabled={sending}>
        <Send size={14} />
        {sending ? t('cmsshared.settings.test.sending') : t('cmsshared.settings.test.send')}
      </Button>
    </div>
  );
}

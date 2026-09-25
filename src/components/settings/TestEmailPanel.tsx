'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/admin/ui';
import { sendTestEmail } from '@/app/cms/actions/settings';

/**
 * "Send test email" — renders inside the SMTP SettingsForm so it sits above
 * the save button. Uses the SAVED settings, so save first, then send.
 */
export default function TestEmailPanel() {
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (sending) return;
    const target = recipient.trim();
    if (!target) {
      toast.error('Enter the address that should receive the test email.');
      return;
    }
    setSending(true);
    try {
      const result = await sendTestEmail(target);
      if (result.ok) {
        toast.success(`Test email sent to ${target}.`);
      } else {
        toast.error(result.error || 'Could not send the test email.');
      }
    } catch (error) {
      console.error('[cms/settings] test email failed', error);
      toast.error('Something went wrong while sending. Please try again.');
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
          Send a test email
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
          Uses the saved settings above — save your changes first, then send the test.
        </p>
      </div>
      <Button variant="secondary" onClick={() => void send()} disabled={sending}>
        <Send size={14} />
        {sending ? 'Sending…' : 'Send test email'}
      </Button>
    </div>
  );
}

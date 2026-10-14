'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Field, Input, Textarea } from '@/components/admin/ui';
import {
  getWhatsAppWelcome,
  saveWhatsAppWelcome,
  sendWhatsAppWelcome,
  type CloudActionResult,
} from '@/app/cms/actions/whatsapp-cloud';
import type { WelcomeResult } from '@/lib/whatsapp-welcome';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';

/**
 * Welcome message to the test numbers (or a few customers). Free text reaches only people who wrote
 * in the last 24 hours; everyone else gets the approved template.
 */
export default function WhatsAppWelcome() {
  const { t } = useLocale();
  const [form, setForm] = useState<{ numbers: string; text: string; template: string; language: string } | null>(null);
  const [max, setMax] = useState(20);
  const [known, setKnown] = useState<string[]>([]);
  const [busy, setBusy] = useState<'save' | 'send' | null>(null);
  const [results, setResults] = useState<WelcomeResult[]>([]);

  useEffect(() => {
    void getWhatsAppWelcome().then((saved) => {
      setMax(saved.max);
      setKnown(saved.known);
      // Nothing saved yet: start from the numbers that wrote to the shop (and the owner).
      const numbers = saved.numbers.length > 0 ? saved.numbers : saved.known;
      setForm({ numbers: numbers.map((number) => `+${number}`).join('\n'), text: saved.text, template: saved.template, language: saved.language });
    });
  }, []);

  if (!form) return <p className="text-sm text-zinc-500">{t('cmssettings.whatsapp.loading')}</p>;

  const listed = new Set(form.numbers.split(/[\n,;]+/).map((line) => line.replace(/\D/g, '').replace(/^00/, '')).filter(Boolean));
  const missing = known.filter((number) => !listed.has(number));
  const addKnown = () =>
    setForm((current) =>
      current ? { ...current, numbers: [current.numbers.trim(), ...missing.map((number) => `+${number}`)].filter(Boolean).join('\n') } : current,
    );

  const message = (result: CloudActionResult) => t(`cmssettings.waCloud.msg.${result.code}` as keyof Dictionary, result.params);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => (current ? { ...current, [key]: event.target.value } : current));
  const reason = (error: string | undefined) =>
    error && ['notAllowed', 'badToken', 'noTemplate'].includes(error)
      ? t(`cmssettings.waWelcome.error.${error}` as keyof Dictionary)
      : error ?? '';

  async function save() {
    if (!form) return;
    setBusy('save');
    try {
      const result = await saveWhatsAppWelcome(form);
      if (result.ok) toast.success(message(result));
      else toast.error(message(result));
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!form || !window.confirm(t('cmssettings.waWelcome.confirm'))) return;
    setBusy('send');
    try {
      const result = await sendWhatsAppWelcome(form);
      setResults(result.results ?? []);
      if (result.ok) toast.success(message(result));
      else toast.error(message(result));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">{t('cmssettings.waWelcome.howItWorks')}</p>
      <Field label={t('cmssettings.waWelcome.numbers')} hint={t('cmssettings.waWelcome.numbersHint', { max: String(max) })} htmlFor="wa-welcome-numbers">
        <Textarea id="wa-welcome-numbers" rows={4} value={form.numbers} onChange={set('numbers')} placeholder={'+38344123456\n+38349123456'} className="font-mono text-sm" />
      </Field>
      {missing.length > 0 ? (
        <Button variant="secondary" onClick={addKnown} disabled={busy !== null}>
          {t('cmssettings.waWelcome.addKnown', { count: String(missing.length) })}
        </Button>
      ) : null}
      <Field label={t('cmssettings.waWelcome.text')} hint={t('cmssettings.waWelcome.textHint')} htmlFor="wa-welcome-text">
        <Textarea id="wa-welcome-text" rows={4} maxLength={1000} value={form.text} onChange={set('text')} />
      </Field>
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-600">{t('cmssettings.waWelcome.templateTitle')}</summary>
        <p className="mt-2 text-zinc-600">{t('cmssettings.waWelcome.templateHint')}</p>
        <div className="mt-3 grid max-w-md gap-3 sm:grid-cols-2">
          <Field label={t('cmssettings.waWelcome.template')} htmlFor="wa-welcome-template">
            <Input id="wa-welcome-template" autoComplete="off" value={form.template} onChange={set('template')} placeholder="hello_world" />
          </Field>
          <Field label={t('cmssettings.waWelcome.language')} htmlFor="wa-welcome-language">
            <Input id="wa-welcome-language" autoComplete="off" value={form.language} onChange={set('language')} placeholder="sq" />
          </Field>
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <Button onClick={send} disabled={busy !== null}>
          {busy === 'send' ? t('cmssettings.waWelcome.sending') : t('cmssettings.waWelcome.send')}
        </Button>
        <Button variant="secondary" onClick={save} disabled={busy !== null}>
          {busy === 'save' ? t('cmssettings.waCloud.saving') : t('cmssettings.waCloud.save')}
        </Button>
      </div>
      {results.length > 0 ? (
        <ul className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          {results.map((result) => (
            <li key={result.to} className="flex flex-wrap items-center gap-2">
              <span className="font-mono">+{result.to}</span>
              <Badge tone={result.ok ? 'success' : 'danger'}>
                {result.ok ? t('cmssettings.waWelcome.sent') : t('cmssettings.waWelcome.failed')}
              </Badge>
              <span className="text-zinc-500">
                {result.via === 'text' ? t('cmssettings.waWelcome.viaText') : t('cmssettings.waWelcome.viaTemplate')}
              </span>
              {result.ok ? null : <span className="text-red-700">{reason(result.error)}</span>}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

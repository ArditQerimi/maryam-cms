'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Field, Input } from '@/components/admin/ui';
import {
  disconnectWhatsAppCloud,
  getWhatsAppCloudStatus,
  saveWhatsAppCloud,
  testWhatsAppCloud,
  type CloudActionResult,
  type WhatsAppCloudStatus,
} from '@/app/cms/actions/whatsapp-cloud';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';

/**
 * Official WhatsApp (Meta Cloud API) for this shop, in four steps: create the app at Meta,
 * paste the details, connect the webhook (values to copy are shown here), test.
 */
export default function WhatsAppCloudSetup() {
  const { t, locale } = useLocale();
  const [status, setStatus] = useState<WhatsAppCloudStatus | null>(null);
  const [form, setForm] = useState({ phoneNumberId: '', token: '', appSecret: '', owner: '', template: '', agentEnabled: true });
  const [busy, setBusy] = useState<'save' | 'test' | 'disconnect' | null>(null);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const next = await getWhatsAppCloudStatus();
    setStatus(next);
    setForm((current) => ({
      ...current,
      phoneNumberId: next.phoneNumberId,
      owner: next.owner,
      template: next.template,
      agentEnabled: next.agentEnabled,
      token: '',
      appSecret: '',
    }));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const message = (result: CloudActionResult) =>
    t(`cmssettings.waCloud.msg.${result.code}` as keyof Dictionary, result.params);

  async function run(kind: 'save' | 'test' | 'disconnect', action: () => Promise<CloudActionResult>) {
    setBusy(kind);
    try {
      const result = await action();
      if (result.ok) toast.success(message(result));
      else toast.error(message(result));
      if (result.ok && kind !== 'test') await load();
    } finally {
      setBusy(null);
    }
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value).catch(() => undefined);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1500);
  }

  if (!status) return <p className="text-sm text-zinc-500">{t('cmssettings.whatsapp.loading')}</p>;

  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'sq' ? 'sq-AL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const saved = status.source === 'cms';
  const connected = saved && status.hasToken && status.hasAppSecret && Boolean(status.verifiedAt);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: key === 'agentEnabled' ? event.target.checked : event.target.value }));

  return (
    <div className="space-y-6">
      {/* status */}
      <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <Badge tone={connected ? 'success' : 'neutral'}>
            {connected ? t('cmssettings.waCloud.statusConnected') : t('cmssettings.waCloud.statusNotConnected')}
          </Badge>
        </div>
        {status.source === 'env' ? <p className="text-zinc-600">{t('cmssettings.waCloud.statusEnv')}</p> : null}
        {status.unreadableSecrets ? <p className="text-amber-700">{t('cmssettings.waCloud.statusUnreadable')}</p> : null}
        <p className="text-zinc-600">
          {status.verifiedAt
            ? t('cmssettings.waCloud.webhookVerifiedAt', { date: when(status.verifiedAt) })
            : t('cmssettings.waCloud.webhookNotVerified')}
        </p>
        {status.lastInboundAt ? (
          <p className="text-zinc-600">{t('cmssettings.waCloud.lastInbound', { date: when(status.lastInboundAt) })}</p>
        ) : null}
      </div>

      {/* 1 */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900">{t('cmssettings.waCloud.step1Title')}</h3>
        <p className="text-sm text-zinc-600">{t('cmssettings.waCloud.step1Body')}</p>
        <a
          href="https://developers.facebook.com/apps"
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm font-medium text-emerald-700 hover:underline"
        >
          {t('cmssettings.waCloud.openMeta')} ↗
        </a>
      </section>

      {/* 2 */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900">{t('cmssettings.waCloud.step2Title')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('cmssettings.waCloud.phoneNumberId')} hint={t('cmssettings.waCloud.phoneNumberIdHint')} htmlFor="wa-number-id">
            <Input id="wa-number-id" inputMode="numeric" autoComplete="off" value={form.phoneNumberId} onChange={set('phoneNumberId')} />
          </Field>
          <Field label={t('cmssettings.waCloud.owner')} hint={t('cmssettings.waCloud.ownerHint')} htmlFor="wa-owner">
            <Input id="wa-owner" inputMode="tel" autoComplete="off" value={form.owner} onChange={set('owner')} placeholder="38349123456" />
          </Field>
          <Field label={t('cmssettings.waCloud.token')} hint={t('cmssettings.waCloud.tokenHint')} htmlFor="wa-token">
            <Input
              id="wa-token"
              type="password"
              autoComplete="new-password"
              value={form.token}
              onChange={set('token')}
              placeholder={saved && status.hasToken ? t('cmssettings.waCloud.savedSecret') : ''}
            />
          </Field>
          <Field label={t('cmssettings.waCloud.appSecret')} hint={t('cmssettings.waCloud.appSecretHint')} htmlFor="wa-app-secret">
            <Input
              id="wa-app-secret"
              type="password"
              autoComplete="new-password"
              value={form.appSecret}
              onChange={set('appSecret')}
              placeholder={saved && status.hasAppSecret ? t('cmssettings.waCloud.savedSecret') : ''}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={form.agentEnabled} onChange={set('agentEnabled')} className="h-4 w-4 rounded border-zinc-300" />
          {t('cmssettings.waCloud.agent')}
        </label>
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-600">{t('cmssettings.waCloud.template')}</summary>
          <Field label={t('cmssettings.waCloud.template')} hint={t('cmssettings.waCloud.templateHint')} htmlFor="wa-template" className="mt-3 max-w-sm">
            <Input id="wa-template" autoComplete="off" value={form.template} onChange={set('template')} placeholder="porosi_e_re" />
          </Field>
        </details>
        <Button onClick={() => run('save', () => saveWhatsAppCloud(form))} disabled={busy !== null}>
          {busy === 'save' ? t('cmssettings.waCloud.saving') : t('cmssettings.waCloud.save')}
        </Button>
      </section>

      {/* 3 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900">{t('cmssettings.waCloud.step3Title')}</h3>
        <p className="text-sm text-zinc-600">{t('cmssettings.waCloud.step3Body')}</p>
        {status.verifyToken ? (
          <div className="space-y-3">
            {[
              [t('cmssettings.waCloud.callbackUrl'), status.webhookUrl],
              [t('cmssettings.waCloud.verifyToken'), status.verifyToken],
            ].map(([label, value]) => (
              <Field key={label} label={label}>
                <div className="flex gap-2">
                  <Input readOnly value={value} onFocus={(event) => event.target.select()} className="font-mono text-xs" />
                  <Button variant="secondary" onClick={() => copy(label, value)}>
                    {copied === label ? t('cmssettings.waCloud.copied') : t('cmssettings.waCloud.copy')}
                  </Button>
                </div>
              </Field>
            ))}
          </div>
        ) : (
          <p className="text-sm text-amber-700">{t('cmssettings.waCloud.saveFirstForWebhook')}</p>
        )}
      </section>

      {/* 4 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900">{t('cmssettings.waCloud.step4Title')}</h3>
        <p className="text-sm text-zinc-600">{t('cmssettings.waCloud.step4Body')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => run('test', testWhatsAppCloud)} disabled={busy !== null || !saved && status.source !== 'env'}>
            {busy === 'test' ? t('cmssettings.waCloud.testing') : t('cmssettings.waCloud.test')}
          </Button>
          {saved ? (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(t('cmssettings.waCloud.disconnectConfirm'))) void run('disconnect', disconnectWhatsAppCloud);
              }}
              disabled={busy !== null}
            >
              {t('cmssettings.waCloud.disconnect')}
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

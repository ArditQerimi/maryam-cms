import { lookup } from 'node:dns/promises';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { smtpFromEnv } from './smtp-config';
import type { ReactElement } from 'react';

/**
 * Single outbound-email channel for the whole CMS.
 *
 * Provider priority:
 *   1. **Resend** — when `RESEND_API_KEY` is set in `.env` (optional
 *      `RESEND_FROM` overrides the sender, default `onboarding@resend.dev`
 *      which works out of the box on the free plan).
 *   2. **SMTP** — the `smtp_*` settings saved at `/cms/settings/email`,
 *      passed in by the caller.
 *   3. Neither → `{ ok: false, notConfigured: true }` so the UI can show a
 *      friendly setup hint instead of a crash.
 *
 * Templates are React Email elements, rendered once to HTML and handed to
 * whichever provider is active.
 */

export type SmtpTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
};

export type SendEmailOutcome =
  | { ok: true; provider: 'resend'; detail: string }
  | { ok: true; provider: 'smtp'; detail: string }
  | { ok: true; provider: 'brevo'; detail: string }
  | { ok: false; notConfigured: true }
  | { ok: false; error: string };

/** Sender used by Resend when `RESEND_FROM` is not set (free-plan safe). */
export const RESEND_DEFAULT_FROM = 'onboarding@resend.dev';

/** True when the `.env` file provides a Resend API key. */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Effective Resend "from" address (`RESEND_FROM`, else the default). */
export function resendFromAddress(): string {
  return process.env.RESEND_FROM?.trim() || RESEND_DEFAULT_FROM;
}

async function deliverEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
  /** Optional plain-text alternative body. */
  text?: string;
  /** Saved SMTP settings — used only when Resend is not configured. */
  smtp?: SmtpTransportConfig | null;
}): Promise<SendEmailOutcome> {
  const html = await render(input.react);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: resendFromAddress(),
        to: input.to,
        subject: input.subject,
        html,
        ...(input.text ? { text: input.text } : {}),
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, provider: 'resend', detail: data?.id || 'accepted' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Brevo over HTTPS: for hosts that block outbound SMTP ports (Render).
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  if (brevoKey) {
    try {
      const fallback = smtpFromEnv();
      const senderEmail = (process.env.BREVO_FROM ?? fallback?.from ?? '').trim();
      if (!senderEmail) return { ok: false, error: 'BREVO_FROM (verified sender address) is not set' };
      const senderName = (process.env.BREVO_FROM_NAME ?? fallback?.fromName ?? '').trim();
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: senderEmail, ...(senderName ? { name: senderName } : {}) },
          to: [{ email: input.to }],
          subject: input.subject,
          htmlContent: html,
          ...(input.text ? { textContent: input.text } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json().catch(() => ({}))) as { messageId?: string; message?: string };
      if (!response.ok) return { ok: false, error: `Brevo ${response.status}: ${payload.message ?? 'request failed'}` };
      return { ok: true, provider: 'brevo', detail: payload.messageId || 'accepted' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Saved CMS settings first, then SMTP_* environment variables (e.g. Gmail with an app password).
  const smtp: SmtpTransportConfig | null = input.smtp?.host ? input.smtp : smtpFromEnv();
  if (smtp?.host) {
    try {
      // Hosts such as Render have no outbound IPv6, yet Gmail's AAAA record is tried first
      // (ENETUNREACH): connect to the IPv4 address and keep the real name for TLS.
      let connectHost = smtp.host;
      try {
        connectHost = (await lookup(smtp.host, { family: 4 })).address;
      } catch {
        // No A record / lookup failed: let nodemailer resolve it.
      }
      const transport = nodemailer.createTransport({
        host: connectHost,
        port: smtp.port,
        secure: smtp.secure,
        requireTLS: smtp.requireTLS,
        tls: { servername: smtp.host },
        ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass } } : {}),
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
      });
      const info = await transport.sendMail({
        from: smtp.fromName ? `"${smtp.fromName}" <${smtp.from}>` : smtp.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html,
      });
      return { ok: true, provider: 'smtp', detail: info.response || input.to };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  return { ok: false, notConfigured: true };
}

/**
 * Sends one email and always leaves a trace in the server log (never the password or the
 * message body): callers mostly ignore the outcome, so without this a failed delivery
 * (blocked SMTP port, wrong app password, missing variables) is invisible.
 */
export async function sendEmail(input: Parameters<typeof deliverEmail>[0]): Promise<SendEmailOutcome> {
  const outcome = await deliverEmail(input);
  const domain = input.to.split('@')[1] ?? '?';
  if (outcome.ok) {
    console.info(`[email] sent via ${outcome.provider} to *@${domain}: ${input.subject}`);
  } else if ('notConfigured' in outcome) {
    console.error('[email] NOT SENT: no email provider configured (set SMTP_HOST/SMTP_USER/SMTP_PASS or RESEND_API_KEY)');
  } else {
    console.error(`[email] FAILED to *@${domain}: ${outcome.error}`);
  }
  return outcome;
}

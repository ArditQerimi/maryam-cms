import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { render } from '@react-email/render';
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

export async function sendEmail(input: {
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

  const smtp = input.smtp;
  if (smtp?.host) {
    try {
      const transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        requireTLS: smtp.requireTLS,
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

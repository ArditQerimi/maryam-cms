'use server';

import { revalidatePath } from 'next/cache';
import { desc, eq, like } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { settingsStore, taxRates } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { isResendConfigured, sendEmail } from '@/lib/email/send';
import { testEmailMessage } from '@/lib/email/templates';
import type { SettingsValues, SettingValue } from '@/components/settings/types';
import type { ActionResult } from './theme';

export type { ActionResult };

/* -------------------------------------------------------------------------- */
/* settings_store helpers                                                      */
/* -------------------------------------------------------------------------- */

function parseValue(raw: string): SettingValue | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'string' || typeof parsed === 'boolean') return parsed;
    if (typeof parsed === 'number') return String(parsed);
    return null;
  } catch {
    // Legacy/plain values are stored as-is.
    return raw;
  }
}

async function readSettingsKeys(keys: string[]): Promise<SettingsValues> {
  const db = await getContextDb();
  const rows = await db
    .select({ key: settingsStore.key, value: settingsStore.value })
    .from(settingsStore);

  const wanted = new Set(keys);
  const result: SettingsValues = {};
  for (const row of rows) {
    if (!wanted.has(row.key)) continue;
    const parsed = parseValue(row.value);
    if (parsed !== null) result[row.key] = parsed;
  }
  return result;
}

/** Read every key under a namespace, e.g. `general_` → all `general_*`. */
export async function loadSettingsByPrefix(prefix: string): Promise<SettingsValues> {
  await requireCmsSession();
  const db = await getContextDb();
  const rows = await db
    .select({ key: settingsStore.key, value: settingsStore.value })
    .from(settingsStore)
    .where(like(settingsStore.key, `${prefix}%`));

  const result: SettingsValues = {};
  for (const row of rows) {
    const parsed = parseValue(row.value);
    if (parsed !== null) result[row.key] = parsed;
  }
  return result;
}

/** Read an explicit list of keys (no session guard — used by other actions). */
async function readSettings(keys: string[]): Promise<SettingsValues> {
  return readSettingsKeys(keys);
}

async function upsertSettingRow(key: string, serialized: string): Promise<void> {
  const db = await getContextDb();
  const [existing] = await db
    .select({ id: settingsStore.id })
    .from(settingsStore)
    .where(eq(settingsStore.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(settingsStore)
      .set({ value: serialized, updatedAt: new Date() })
      .where(eq(settingsStore.id, existing.id));
    return;
  }
  await db.insert(settingsStore).values({ key, value: serialized });
}

async function upsertSetting(key: string, value: SettingValue): Promise<void> {
  return upsertSettingRow(key, JSON.stringify(value));
}

/**
 * Persist only the whitelisted keys of a settings form payload.
 * Unknown keys are ignored so a compromised client can never write outside
 * this module's namespace.
 */
async function persist(
  values: SettingsValues,
  allowedKeys: readonly string[],
  paths: string[],
): Promise<ActionResult> {
  await requireCmsSession();
  if (!values || typeof values !== 'object') {
    return { ok: false, error: 'Nothing to save.' };
  }

  const allowed = new Set(allowedKeys);
  let written = 0;
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) continue;
    if (typeof value !== 'string' && typeof value !== 'boolean') continue;
    await upsertSetting(key, typeof value === 'string' ? value.slice(0, 4000) : value);
    written += 1;
  }

  if (!written) return { ok: false, error: 'Nothing to save.' };

  paths.forEach((path) => revalidatePath(path));
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* General                                                                     */
/* -------------------------------------------------------------------------- */

const GENERAL_KEYS = [
  'general_site_title',
  'general_tagline',
  'general_admin_email',
  'general_timezone',
  'general_date_format',
  'general_time_format',
  'general_currency',
  'general_currency_position',
  'general_decimal_separator',
  'general_map_coordinates',
  'general_whatsapp_number',
] as const;

export async function saveGeneralSettings(values: SettingsValues): Promise<ActionResult> {
  const result = await persist(values, GENERAL_KEYS, ['/cms/settings/general', '/home']);
  if (result.ok && typeof values.general_admin_email === 'string') {
    const email = values.general_admin_email.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, error: 'Settings were saved, but the admin email does not look valid.' };
    }
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

const READING_KEYS = [
  'reading_homepage_type',
  'reading_homepage_page_id',
  'reading_posts_per_page',
  'reading_discussion_page_id',
] as const;

export async function saveReadingSettings(values: SettingsValues): Promise<ActionResult> {
  const perPage = Number(values.reading_posts_per_page);
  if (!Number.isFinite(perPage) || perPage < 1 || perPage > 100) {
    return { ok: false, error: 'Posts per page must be between 1 and 100.' };
  }
  return persist(values, READING_KEYS, ['/cms/settings/reading', '/home']);
}

/* -------------------------------------------------------------------------- */
/* Discussion                                                                  */
/* -------------------------------------------------------------------------- */

const DISCUSSION_KEYS = [
  'discussion_allow_comments',
  'discussion_moderate_comments',
  'discussion_require_name_email',
  'discussion_close_after_days',
  'discussion_notify_on_comment',
] as const;

export async function saveDiscussionSettings(values: SettingsValues): Promise<ActionResult> {
  const days = Number(values.discussion_close_after_days);
  if (!Number.isFinite(days) || days < 0 || days > 3650) {
    return { ok: false, error: 'Close comments after must be between 0 and 3650 days.' };
  }
  return persist(values, DISCUSSION_KEYS, ['/cms/settings/discussion', '/home']);
}

/* -------------------------------------------------------------------------- */
/* Media                                                                       */
/* -------------------------------------------------------------------------- */

const MEDIA_KEYS = [
  'media_thumb_width',
  'media_thumb_height',
  'media_medium_width',
  'media_medium_height',
  'media_large_width',
  'media_large_height',
  'media_organise_folders',
] as const;

export async function saveMediaSettings(values: SettingsValues): Promise<ActionResult> {
  for (const key of MEDIA_KEYS) {
    if (key === 'media_organise_folders') continue;
    const size = Number(values[key]);
    if (!Number.isFinite(size) || size < 0 || size > 4000) {
      return { ok: false, error: 'Image sizes must be between 0 and 4000 pixels.' };
    }
  }
  return persist(values, MEDIA_KEYS, ['/cms/settings/media']);
}

/* -------------------------------------------------------------------------- */
/* Permalinks                                                                  */
/* -------------------------------------------------------------------------- */

const PERMALINK_KEYS = ['permalink_structure', 'permalink_custom_mask'] as const;

export async function savePermalinkSettings(values: SettingsValues): Promise<ActionResult> {
  const allowed = new Set(['plain', 'day_name', 'month_name', 'post_name', 'custom']);
  if (!allowed.has(String(values.permalink_structure))) {
    return { ok: false, error: 'Choose a valid permalink structure.' };
  }
  return persist(values, PERMALINK_KEYS, ['/cms/settings/permalinks', '/home']);
}

/* -------------------------------------------------------------------------- */
/* Email (SMTP)                                                                */
/* -------------------------------------------------------------------------- */

const SMTP_KEYS = [
  'smtp_host',
  'smtp_port',
  'smtp_encryption',
  'smtp_username',
  'smtp_password',
  'smtp_from_name',
  'smtp_from_email',
] as const;

export async function saveSmtpSettings(values: SettingsValues): Promise<ActionResult> {
  const port = Number(values.smtp_port);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return { ok: false, error: 'SMTP port must be between 1 and 65535.' };
  }
  return persist(values, SMTP_KEYS, ['/cms/settings/email']);
}

export type TestEmailResult = { ok: boolean; error?: string; delivered?: string };

/**
 * Sends a real test message through the active provider — Resend when
 * `RESEND_API_KEY` is set, otherwise the saved SMTP settings.
 * Never throws — always returns a typed result for the toast.
 */
export async function sendTestEmail(recipient: string): Promise<TestEmailResult> {
  try {
    await requireCmsSession();

    const to = String(recipient || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return { ok: false, error: 'Enter a valid recipient email address.' };
    }

    const values = await readSettings([...SMTP_KEYS]);
    const host = typeof values.smtp_host === 'string' ? values.smtp_host.trim() : '';
    const port = Number(values.smtp_port) || 587;
    const encryption = typeof values.smtp_encryption === 'string' ? values.smtp_encryption : 'tls';
    const username = typeof values.smtp_username === 'string' ? values.smtp_username : '';
    const password = typeof values.smtp_password === 'string' ? values.smtp_password : '';
    const fromName = typeof values.smtp_from_name === 'string' && values.smtp_from_name
      ? values.smtp_from_name
      : 'Maryam CMS';
    const fromEmail = typeof values.smtp_from_email === 'string' ? values.smtp_from_email.trim() : '';

    const resendReady = isResendConfigured();
    if (!resendReady && (!host || !fromEmail)) {
      return {
        ok: false,
        error:
          'No email provider yet — set RESEND_API_KEY in the .env file (Resend), or fill in the SMTP host and "from" address below, save, then try again.',
      };
    }

    const outcome = await sendEmail({
      to,
      subject: 'Test email from your store',
      text: 'This is a test message. If you are reading it, your outbound email channel is configured correctly.',
      react: testEmailMessage(to),
      smtp: resendReady
        ? null
        : {
            host,
            port,
            secure: encryption === 'ssl' || port === 465,
            requireTLS: encryption === 'tls',
            user: username,
            pass: password,
            from: fromEmail,
            fromName,
          },
    });

    if (!outcome.ok) {
      if ('notConfigured' in outcome) {
        return {
          ok: false,
          error:
            'No email provider yet — set RESEND_API_KEY in .env (Resend) or configure and save the SMTP settings below.',
        };
      }
      return { ok: false, error: `Could not send the test email: ${outcome.error}` };
    }

    return {
      ok: true,
      delivered:
        outcome.provider === 'resend' ? `Resend accepted (${outcome.detail})` : outcome.detail,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cms/settings] sendTestEmail failed', error);
    return { ok: false, error: `Could not send the test email: ${message}` };
  }
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                    */
/* -------------------------------------------------------------------------- */

const STRIPE_KEYS = [
  'payment_stripe_enabled',
  'payment_stripe_mode',
  'payment_stripe_publishable_key',
  'payment_stripe_secret_key',
] as const;

const PAYPAL_KEYS = [
  'payment_paypal_enabled',
  'payment_paypal_mode',
  'payment_paypal_client_id',
  'payment_paypal_secret',
] as const;

const COD_KEYS = ['payment_cod_enabled', 'payment_cod_instructions'] as const;

const BANK_KEYS = [
  'payment_bank_enabled',
  'payment_bank_instructions',
  'payment_bank_iban',
] as const;

export async function saveStripeSettings(values: SettingsValues): Promise<ActionResult> {
  return persist(values, STRIPE_KEYS, ['/cms/settings/payments', '/home/checkout']);
}

export async function savePaypalSettings(values: SettingsValues): Promise<ActionResult> {
  return persist(values, PAYPAL_KEYS, ['/cms/settings/payments', '/home/checkout']);
}

export async function saveCodSettings(values: SettingsValues): Promise<ActionResult> {
  return persist(values, COD_KEYS, ['/cms/settings/payments', '/home/checkout']);
}

export async function saveBankSettings(values: SettingsValues): Promise<ActionResult> {
  return persist(values, BANK_KEYS, ['/cms/settings/payments', '/home/checkout']);
}

/* -------------------------------------------------------------------------- */
/* Tax                                                                         */
/* -------------------------------------------------------------------------- */

export type TaxPreferences = {
  pricesIncludeTax: boolean;
  showTotals: 'itemised' | 'single';
};

export async function saveTaxPreferences(values: SettingsValues): Promise<ActionResult> {
  try {
    await requireCmsSession();
    const normalized: TaxPreferences = {
      pricesIncludeTax: values?.tax_prices_include_tax === true,
      showTotals: values?.tax_show_totals === 'single' ? 'single' : 'itemised',
    };
    await upsertSettingRow('tax_preferences', JSON.stringify(normalized));
    revalidatePath('/cms/settings/tax');
    revalidatePath('/home');
    return { ok: true };
  } catch (error) {
    console.error('[cms/settings] saveTaxPreferences failed', error);
    return { ok: false, error: 'Could not save the tax preferences.' };
  }
}

export type TaxRateInput = {
  country: string;
  state: string;
  postcode: string;
  rate: string | number;
  name: string;
  shipping: boolean;
  enabled: boolean;
};

function normalizeTaxRateInput(
  input: TaxRateInput,
): { ok: true; data: Omit<TaxRateInput, 'rate'> & { rate: string } } | { ok: false; error: string } {
  const rate = Number(input?.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { ok: false, error: 'Rate must be a number between 0 and 100.' };
  }
  const name = String(input?.name || '').trim().slice(0, 100) || 'VAT';
  return {
    ok: true,
    data: {
      country: String(input?.country || '').trim().slice(0, 10).toUpperCase(),
      state: String(input?.state || '').trim().slice(0, 10),
      postcode: String(input?.postcode || '').trim().slice(0, 20),
      rate: (Math.round(rate * 10_000) / 10_000).toFixed(4),
      name,
      shipping: input?.shipping === true,
      enabled: input?.enabled !== false,
    },
  };
}

export async function createTaxRate(input: TaxRateInput): Promise<ActionResult> {
  try {
    await requireCmsSession();
    const normalized = normalizeTaxRateInput(input);
    if (!normalized.ok) return { ok: false, error: normalized.error };

    const db = await getContextDb();
    await db.insert(taxRates).values(normalized.data);
    revalidatePath('/cms/settings/tax');
    return { ok: true };
  } catch (error) {
    console.error('[cms/settings] createTaxRate failed', error);
    return { ok: false, error: 'Could not add the tax rate.' };
  }
}

export async function updateTaxRate(id: number, input: TaxRateInput): Promise<ActionResult> {
  try {
    await requireCmsSession();
    const normalized = normalizeTaxRateInput(input);
    if (!normalized.ok) return { ok: false, error: normalized.error };

    const db = await getContextDb();
    const [existing] = await db
      .select({ id: taxRates.id })
      .from(taxRates)
      .where(eq(taxRates.id, id))
      .limit(1);
    if (!existing) return { ok: false, error: 'That tax rate no longer exists.' };

    await db.update(taxRates).set(normalized.data).where(eq(taxRates.id, id));
    revalidatePath('/cms/settings/tax');
    return { ok: true };
  } catch (error) {
    console.error('[cms/settings] updateTaxRate failed', error);
    return { ok: false, error: 'Could not update the tax rate.' };
  }
}

export async function deleteTaxRate(id: number): Promise<ActionResult> {
  try {
    await requireCmsSession();
    const db = await getContextDb();
    const [existing] = await db
      .select({ id: taxRates.id })
      .from(taxRates)
      .where(eq(taxRates.id, id))
      .limit(1);
    if (!existing) return { ok: false, error: 'That tax rate no longer exists.' };

    await db.delete(taxRates).where(eq(taxRates.id, id));
    revalidatePath('/cms/settings/tax');
    return { ok: true };
  } catch (error) {
    console.error('[cms/settings] deleteTaxRate failed', error);
    return { ok: false, error: 'Could not delete the tax rate.' };
  }
}

/** Server-side loader used by the tax page. */
export async function loadTaxRates() {
  await requireCmsSession();
  const db = await getContextDb();
  return db.select().from(taxRates).orderBy(taxRates.priority, desc(taxRates.createdAt));
}

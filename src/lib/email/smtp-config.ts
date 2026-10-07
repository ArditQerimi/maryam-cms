/**
 * Reads the shared `smtp_*` keys written by the settings module
 * (`/cms/settings/email`). Several aliases are accepted so minor naming
 * differences between modules still resolve to the same transport.
 */
export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
};

export function buildSmtpConfig(rows: { key: string; value: string }[]): SmtpConfig | null {
  const map = new Map(rows.map((row) => [row.key.toLowerCase(), row.value.trim()]));

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = map.get(key);
      if (value) return value;
    }
    return '';
  };

  const host = pick('smtp_host', 'smtp_server', 'smtp_hostname');
  const user = pick('smtp_user', 'smtp_username', 'smtp_user_name');
  const pass = pick('smtp_password', 'smtp_pass', 'smtp_pwd');
  const from = pick('smtp_from', 'smtp_from_email', 'smtp_sender', 'smtp_from_address');
  if (!host || !user || !pass || !from) return null;

  const rawPort = Number(pick('smtp_port')) || 587;
  const encryption = pick('smtp_encryption', 'smtp_security', 'smtp_tls_mode').toLowerCase();
  const secureFlag = pick('smtp_secure', 'smtp_ssl').toLowerCase();
  const secure =
    encryption === 'ssl' || secureFlag === '1' || secureFlag === 'true' || secureFlag === 'yes'
      ? true
      : rawPort === 465;

  return {
    host,
    port: Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 587,
    secure,
    user,
    pass,
    from,
    fromName: pick('smtp_from_name', 'smtp_sender_name'),
  };
}

/**
 * SMTP from environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
 * SMTP_FROM_NAME). Used for every store email when no Resend key is set and the CMS has no
 * saved SMTP settings — the password stays in the environment, never in the database.
 * Gmail: smtp.gmail.com, 587, your address, and an "App password".
 */
export function smtpFromEnv(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const host = (env.SMTP_HOST ?? '').trim();
  const user = (env.SMTP_USER ?? '').trim();
  const pass = (env.SMTP_PASS ?? '').replace(/\s+/g, '');
  const from = (env.SMTP_FROM ?? user).trim();
  if (!host || !user || !pass || !from) return null;
  const port = Number(env.SMTP_PORT) || 587;
  return {
    host,
    port,
    secure: String(env.SMTP_SECURE ?? '').toLowerCase() === 'true' || port === 465,
    user,
    pass,
    from,
    fromName: (env.SMTP_FROM_NAME ?? '').trim(),
  };
}

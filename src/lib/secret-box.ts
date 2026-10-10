import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { resolveSessionSecret } from './session-token';

/**
 * Encryption at rest for secrets a business pastes into the CMS (e.g. its WhatsApp access
 * token), so the database never holds them in readable form. AES-256-GCM; the key comes from
 * SETTINGS_ENCRYPTION_KEY, or else the app's SESSION_SECRET. Changing that secret makes stored
 * values unreadable — the CMS then asks for them again.
 */
const PREFIX = 'enc:v1:';

function key() {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || resolveSessionSecret();
  return createHash('sha256').update(`maryam-cms settings v1:${secret}`).digest();
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}

/** The plain value, or null when it cannot be read (wrong key, damaged, not sealed). */
export function openSecret(sealed: string | null | undefined): string | null {
  if (!sealed?.startsWith(PREFIX)) return null;
  try {
    const [iv, tag, data] = sealed.slice(PREFIX.length).split(':').map((part) => Buffer.from(part, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

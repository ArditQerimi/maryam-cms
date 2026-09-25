/**
 * Name of the signed session cookie.
 *
 * The ERP uses `session`. A sibling application can opt into its own
 * independent login/session on the same host by setting
 * `SESSION_COOKIE_NAME` (done via `env` in that app's next.config), while the
 * ERP bundle keeps the default because the variable is not inlined there.
 */
export function getSessionCookieName(): string {
  const configured = process.env.SESSION_COOKIE_NAME;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : 'session';
}

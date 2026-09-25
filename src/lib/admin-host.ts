export function normalizeHostname(host?: string | null) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .split(',')[0]
    .split(':')[0];
}

export function getConfiguredAdminHost() {
  const configuredHost = normalizeHostname(process.env.ADMIN_HOST || '');
  if (configuredHost) {
    return configuredHost;
  }

  const legacyConfiguredHost = normalizeHostname(process.env.SUPER_ADMIN_HOSTS || '').split(',')[0];
  if (legacyConfiguredHost) {
    return legacyConfiguredHost;
  }

  return 'admin.localhost';
}

export function resolveRequestHostname(host?: string | null, forwardedHost?: string | null) {
  return normalizeHostname(forwardedHost || host);
}

export function isAdminHost(host?: string | null) {
  return normalizeHostname(host) === getConfiguredAdminHost();
}

export function getCanonicalAdminHost() {
  return getConfiguredAdminHost();
}
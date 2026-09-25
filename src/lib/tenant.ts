import { headers } from 'next/headers';
import { masterDb } from '@/db/master';
import { companies } from '@/db/schema-master';
import { eq } from 'drizzle-orm';
import { getTenantDb } from '@/db/index';
import {
  extractStorefrontSubdomain,
  getConfiguredStorefrontBaseDomain,
} from '@/lib/storefront/host';

const TENANT_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DEFAULT_DEVELOPMENT_SUBDOMAIN = 'admin';

type TenantDatabaseConfig = {
  url: string;
  schema: string;
};

type CachedTenantDatabase = TenantDatabaseConfig & {
  companyId: number;
};

const connectionCache = new Map<number, CachedTenantDatabase>();

export type TenantResolutionCode =
  | 'invalid-host'
  | 'host-not-configured'
  | 'tenant-host-required'
  | 'tenant-not-found'
  | 'tenant-inactive';

export class TenantResolutionError extends Error {
  readonly code: TenantResolutionCode;

  constructor(code: TenantResolutionCode, message: string) {
    super(message);
    this.name = 'TenantResolutionError';
    this.code = code;
  }
}

type TenantEnvironment = Record<string, string | undefined>;

function getDefaultDevelopmentSubdomain(env: TenantEnvironment) {
  const configured = String(env.DEFAULT_TENANT_SUBDOMAIN || DEFAULT_DEVELOPMENT_SUBDOMAIN)
    .trim()
    .toLowerCase();

  if (!TENANT_LABEL.test(configured)) {
    throw new TenantResolutionError(
      'host-not-configured',
      'DEFAULT_TENANT_SUBDOMAIN must be one valid tenant hostname label.',
    );
  }

  return configured;
}

function normalizeTenantHostname(hostname: string | null | undefined) {
  const candidate = String(hostname || '').split(',')[0].trim();
  if (!candidate || /[/?#@]/.test(candidate)) return null;

  try {
    const url = new URL(`http://${candidate}`);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      return null;
    }
    return url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '') || null;
  } catch {
    return null;
  }
}

function isPrivateDevelopmentIp(hostname: string) {
  if (hostname === '0.0.0.0' || hostname === '::1') return true;
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return false;

  const octets = hostname.split('.').map(Number);
  if (octets.some((octet) => octet > 255)) return false;
  const [first, second] = octets;

  return first === 127 ||
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}

function isLocalDevelopmentHostname(hostname: string) {
  return hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    isPrivateDevelopmentIp(hostname);
}

/**
 * Resolve exactly one tenant label from the request host.
 *
 * Production tenant storefronts require an explicitly configured storefront
 * base domain and a single `<tenant>.<base-domain>` host. An exact configured
 * platform admin host is handled separately for the legacy dashboard layout.
 * The only default-tenant fallback is for explicit local development hosts
 * (bare localhost/private IPs, or a `<tenant>.localhost` host). Unknown
 * production hosts never fall back.
 */
export function resolveTenantSubdomainFromHostname(
  hostname: string | null | undefined,
  env: TenantEnvironment = process.env,
) {
  const normalizedHost = normalizeTenantHostname(hostname);
  if (!normalizedHost) {
    throw new TenantResolutionError('invalid-host', 'A valid tenant hostname is required.');
  }

  const configuredBaseDomain = getConfiguredStorefrontBaseDomain(env);
  if (
    env.NODE_ENV === 'production' &&
    configuredBaseDomain &&
    isLocalDevelopmentHostname(configuredBaseDomain)
  ) {
    throw new TenantResolutionError(
      'host-not-configured',
      'Production storefront host routing cannot use a local development domain.',
    );
  }

  const configuredAdminHost = normalizeTenantHostname(
    env.ADMIN_HOST || env.SUPER_ADMIN_HOSTS?.split(',')[0]
  );
  if (
    env.NODE_ENV === 'production' &&
    configuredAdminHost &&
    isLocalDevelopmentHostname(configuredAdminHost)
  ) {
    throw new TenantResolutionError(
      'host-not-configured',
      'Production platform host routing cannot use a local development domain.',
    );
  }

  const developmentAdminHost = env.NODE_ENV === 'production'
    ? null
    : normalizeTenantHostname('admin.localhost');
  if (normalizedHost === configuredAdminHost || normalizedHost === developmentAdminHost) {
    return 'admin';
  }

  const configuredSubdomain = configuredBaseDomain
    ? extractStorefrontSubdomain(normalizedHost, configuredBaseDomain)
    : null;
  if (configuredSubdomain) return configuredSubdomain;

  if (env.NODE_ENV === 'production') {
    if (!configuredBaseDomain) {
      throw new TenantResolutionError(
        'host-not-configured',
        'Storefront host routing is not configured.',
      );
    }

    throw new TenantResolutionError(
      'tenant-host-required',
      'A tenant storefront subdomain is required.',
    );
  }

  if (normalizedHost === 'localhost' || isPrivateDevelopmentIp(normalizedHost)) {
    return getDefaultDevelopmentSubdomain(env);
  }

  // In local development an explicit <tenant>.localhost host remains isolated
  // from the default tenant. The admin label is reserved for the exact platform
  // host; invalid labels such as www are still rejected.
  const localhostSubdomain = extractStorefrontSubdomain(normalizedHost, 'localhost');
  if (localhostSubdomain) return localhostSubdomain;

  throw new TenantResolutionError(
    'tenant-host-required',
    'Use a configured tenant host or an explicit local development host.',
  );
}

export type HostResolvedCompany = {
  id: number;
  status: string;
};

export async function resolveTenantCompanyForHost<T extends HostResolvedCompany>(
  hostname: string | null | undefined,
  findCompany: (subdomain: string) => Promise<T | null | undefined>,
  env: TenantEnvironment = process.env,
) {
  const subdomain = resolveTenantSubdomainFromHostname(hostname, env);
  const company = await findCompany(subdomain);

  if (!company) {
    throw new TenantResolutionError(
      'tenant-not-found',
      `No company is configured for tenant host: ${subdomain}.`,
    );
  }

  if (company.status !== 'Active') {
    throw new TenantResolutionError(
      'tenant-inactive',
      `The company for tenant host: ${subdomain} is not active.`,
    );
  }

  return company;
}

export async function getContextCompany() {
  const headerList = await headers();
  const rawHost = headerList.get('host') || '';
  const forwarded = headerList.get('x-forwarded-host') || headerList.get('x-forwarded-server') || '';
  const domain = forwarded || rawHost;

  return resolveTenantCompanyForHost(
    domain,
    (subdomain) => masterDb.query.companies.findFirst({
      where: eq(companies.subdomain, subdomain),
      with: { subscription: { with: { package: true } } },
    }),
  );
}

export async function getContextDb() {
  // Resolve and validate the company on every request. The connection cache is
  // only a database-construction optimization and must never select a company.
  let company: Awaited<ReturnType<typeof getContextCompany>>;
  try {
    company = await getContextCompany();
  } catch (error: unknown) {
    const code = (error as { cause?: { code?: string }; code?: string })?.cause?.code ||
      (error as { code?: string })?.code;
    if (code === '42P01') {
      throw new Error(
        'Master database is not initialized (missing companies table). Run `npm run db:init-master` and then `npm run seed` against the master database.'
      );
    }
    throw error;
  }

  const cached = connectionCache.get(company.id);
  const companyConfig: TenantDatabaseConfig = {
    url: company.dbConnectionString,
    schema: company.dbSchema,
  };
  const config = cached &&
    cached.companyId === company.id &&
    cached.url === companyConfig.url &&
    cached.schema === companyConfig.schema
    ? cached
    : companyConfig;

  if (config !== cached) {
    connectionCache.set(company.id, { companyId: company.id, ...config });
  }

  return getTenantDb(config.url, config.schema);
}

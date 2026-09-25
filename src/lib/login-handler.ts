import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import * as tenantSchema from '@/db/schema-tenant';
import { getTenantDb } from '@/db/index';
import {
  getContextCompany,
  resolveTenantCompanyForHost,
  TenantResolutionError,
} from './tenant';
import {
  createCustomerSessionForCompany,
  createSession,
  createTenantSessionForCompany,
} from './session';
import { and, eq } from 'drizzle-orm';
import { compare, hash } from 'bcryptjs';
import {
  getSafeCustomerReturnTo,
  isRoleAllowedForAudience,
  isValidEmail,
  isValidPassword,
  parseLoginAudience,
  type LoginAudience,
} from './auth-validation';
import { isAdminHost } from './admin-host';
import { logError, logInfo } from './app-logger';

type LoginResult = {
  redirectTo: string;
  sessionToken?: string;
};

type LoginCompany = {
  id: number;
  status: string;
  dbConnectionString: string;
  dbSchema: string;
};

type LoginErrorCode =
  | 'missing-fields'
  | 'invalid-email'
  | 'password-too-short'
  | 'account-suspended'
  | 'tenant-domain-required'
  | 'company-not-found'
  | 'database-error'
  | 'invalid-credentials';

function resolveHostname(host?: string | null) {
  return String(host || '').split(',')[0].trim().toLowerCase();
}

function getErrorRedirect(
  audience: LoginAudience,
  returnTo: string,
  error: LoginErrorCode,
) {
  if (audience === 'staff') {
    return `/login?error=${encodeURIComponent(error)}`;
  }

  const params = new URLSearchParams({
    error,
    returnTo: getSafeCustomerReturnTo(returnTo),
  });
  return `/shop/login?${params.toString()}`;
}

async function hashPasswordLegacySha256(password: string) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function resolveLoginCompany(requestHost: string): Promise<LoginCompany> {
  if (!requestHost) {
    return getContextCompany();
  }

  return resolveTenantCompanyForHost(
    requestHost,
    (subdomain) => masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.subdomain, subdomain),
    }),
  );
}

async function verifyPassword(password: string, passwordHash: string) {
  const bcryptMatches = await compare(password, passwordHash).catch(() => false);
  if (bcryptMatches) return { isValid: true, isLegacy: false };

  const legacySha = await hashPasswordLegacySha256(password);
  return {
    isValid: passwordHash === legacySha,
    isLegacy: passwordHash === legacySha,
  };
}

async function upgradeLegacyPassword(
  db: ReturnType<typeof getTenantDb>,
  userId: number,
  password: string,
) {
  const upgradedHash = await hash(password, 10);
  await db
    .update(tenantSchema.users)
    .set({ passwordHash: upgradedHash })
    .where(eq(tenantSchema.users.id, userId));
}

export async function authenticateLogin(
  formData: FormData,
  requestHost?: string,
): Promise<LoginResult> {
  const audience = parseLoginAudience(formData.get('audience'));
  const rawEmail = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const email = rawEmail.trim().toLowerCase();
  const normalizedRequestHost = resolveHostname(requestHost);
  const adminHost = isAdminHost(normalizedRequestHost);
  const returnTo = audience === 'customer'
    ? getSafeCustomerReturnTo(formData.get('returnTo'))
    : '/customer/orders';

  if (!audience) {
    return { redirectTo: '/login?error=invalid-credentials' };
  }

  const fail = (error: LoginErrorCode): LoginResult => ({
    redirectTo: getErrorRedirect(audience, returnTo, error),
  });

  try {
    if (!email || !password) return fail('missing-fields');
    if (!isValidEmail(email)) return fail('invalid-email');
    if (!isValidPassword(password)) return fail('password-too-short');

    await logInfo('Login Attempt', {
      host: normalizedRequestHost || null,
      audience,
      adminHost,
    });

    if (adminHost) {
      if (audience === 'customer') {
        await logInfo('Login Failure', {
          flow: 'platform',
          audience,
          reason: 'customer-audience-not-allowed',
        });
        return fail('tenant-domain-required');
      }

      const platformUser = await masterDb.query.platformUsers.findFirst({
        where: and(
          eq(masterSchema.platformUsers.email, email),
          eq(masterSchema.platformUsers.status, 'Active')
        ),
      });
      if (!platformUser) {
        await logInfo('Login Failure', { flow: 'platform', reason: 'invalid-credentials' });
        return fail('invalid-credentials');
      }

      const passwordResult = await verifyPassword(password, platformUser.passwordHash);
      if (!passwordResult.isValid) {
        await logInfo('Login Failure', { flow: 'platform', reason: 'invalid-credentials' });
        return fail('invalid-credentials');
      }

      if (passwordResult.isLegacy) {
        const upgradedHash = await hash(password, 10);
        await masterDb
          .update(masterSchema.platformUsers)
          .set({ passwordHash: upgradedHash })
          .where(eq(masterSchema.platformUsers.id, platformUser.id));
      }

      const sessionToken = await createSession(platformUser.id, true);
      if (!sessionToken) return fail('invalid-credentials');

      await logInfo('Login Success', {
        flow: 'platform',
        audience,
        userId: platformUser.id,
      });
      return { redirectTo: '/', sessionToken };
    }

    let company: LoginCompany;
    try {
      // The submitted email is never used to select a tenant. Only the exact
      // active company represented by the current request host is considered.
      company = await resolveLoginCompany(normalizedRequestHost);
    } catch (error) {
      if (error instanceof TenantResolutionError) {
        const reason = error.code === 'tenant-inactive' ? 'account-suspended' : 'company-not-found';
        await logInfo('Login Failure', {
          flow: audience,
          reason,
          tenantError: error.code,
        });
        return fail(reason);
      }
      throw error;
    }

    const db = getTenantDb(company.dbConnectionString, company.dbSchema);
    const [user] = await db
      .select({
        id: tenantSchema.users.id,
        passwordHash: tenantSchema.users.passwordHash,
        status: tenantSchema.users.status,
        roleName: tenantSchema.tenantRoles.name,
      })
      .from(tenantSchema.users)
      .leftJoin(
        tenantSchema.tenantRoles,
        eq(tenantSchema.tenantRoles.id, tenantSchema.users.tenantRoleId)
      )
      .where(eq(tenantSchema.users.email, email))
      .limit(1);

    if (!user) {
      await logInfo('Login Failure', { flow: audience, reason: 'invalid-credentials' });
      return fail('invalid-credentials');
    }

    const passwordResult = await verifyPassword(password, user.passwordHash);
    if (!passwordResult.isValid) {
      await logInfo('Login Failure', { flow: audience, reason: 'invalid-credentials' });
      return fail('invalid-credentials');
    }

    if (user.status !== 'Active' || !isRoleAllowedForAudience(user.roleName, audience)) {
      await logInfo('Login Failure', {
        flow: audience,
        reason: 'inactive-user-or-role-mismatch',
        companyId: company.id,
        userId: user.id,
      });
      return fail('invalid-credentials');
    }

    if (passwordResult.isLegacy) {
      await upgradeLegacyPassword(db, user.id, password);
    }

    const sessionToken = audience === 'customer'
      ? await createCustomerSessionForCompany(user.id, company)
      : await createTenantSessionForCompany(user.id, company);
    if (!sessionToken) return fail('invalid-credentials');

    await logInfo('Login Success', {
      flow: audience,
      audience,
      companyId: company.id,
      userId: user.id,
    });

    return {
      redirectTo: audience === 'customer' ? returnTo : '/',
      sessionToken,
    };
  } catch (error) {
    await logError('Login Error', {
      host: normalizedRequestHost || null,
      adminHost,
      audience,
      error,
    });
    return fail('database-error');
  }
}

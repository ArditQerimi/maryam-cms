import { NextRequest } from 'next/server';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { eq } from 'drizzle-orm';
import { requireDevelopmentPlatformSuperAdmin } from '@/lib/api-security/auth';
import { apiError, apiInternalError, apiJson } from '@/lib/api-security/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(request: NextRequest) {
  const access = await requireDevelopmentPlatformSuperAdmin();
  if (!access.ok) return access.response;

  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase() || '';
  if (!isValidEmail(email)) {
    return apiError('A valid email parameter is required');
  }

  try {
    const company = await masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.email, email),
      with: {
        subscription: {
          with: {
            package: true,
          },
        },
      },
    });

    if (!company) {
      return apiError('Company not found', 404);
    }

    let activeFeatureFlags: Record<string, boolean> = {};
    const activeSubscription = company.subscription &&
      company.subscription.status === 'Active' &&
      new Date(company.subscription.expiryDate) > new Date()
      ? company.subscription
      : undefined;

    if (activeSubscription?.package) {
      const { getPackageFeatureFlags } = await import('@/lib/package-policy');
      activeFeatureFlags = await getPackageFeatureFlags(activeSubscription.package.id);
    }

    return apiJson({
      company: {
        id: company.id,
        email: company.email,
        name: company.name,
        subdomain: company.subdomain,
        status: company.status,
      },
      subscriptions: company.subscription ? [{
        id: company.subscription.id,
        status: company.subscription.status,
        packageId: company.subscription.packageId,
        packageName: company.subscription.package?.name,
        startDate: company.subscription.startDate,
        expiryDate: company.subscription.expiryDate,
        createdAt: company.subscription.createdAt,
      }] : [],
      activeSubscription: activeSubscription ? {
        id: activeSubscription.id,
        packageName: activeSubscription.package?.name,
        status: activeSubscription.status,
      } : null,
      activeFeatureFlags,
    });
  } catch {
    return apiInternalError('Unable to load subscription status');
  }
}

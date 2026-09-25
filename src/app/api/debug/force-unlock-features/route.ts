import { NextRequest } from 'next/server';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { eq } from 'drizzle-orm';
import { requireDevelopmentPlatformSuperAdmin } from '@/lib/api-security/auth';
import { apiError, apiInternalError, apiJson, isPlainObject, positiveSafeInteger } from '@/lib/api-security/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await requireDevelopmentPlatformSuperAdmin();
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body');
  }

  if (!isPlainObject(body)) {
    return apiError('Invalid request body');
  }

  const companyId = positiveSafeInteger(body.companyId);
  if (!companyId) {
    return apiError('A valid company ID is required');
  }

  try {
    const company = await masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.id, companyId),
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

    if (!company.subscription) {
      return apiError('No subscription found for this company', 404);
    }

    const { getCompanyPlanFeatureFlags } = await import('@/lib/package-policy');
    const featureFlags = await getCompanyPlanFeatureFlags(companyId);

    return apiJson({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        email: company.email,
        status: company.status,
      },
      subscription: {
        id: company.subscription.id,
        status: company.subscription.status,
        packageName: company.subscription.package?.name,
        startDate: company.subscription.startDate,
        expiryDate: company.subscription.expiryDate,
      },
      featureFlags,
      enabledFeatures: Object.entries(featureFlags)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature),
    });
  } catch {
    return apiInternalError('Unable to load feature flags');
  }
}

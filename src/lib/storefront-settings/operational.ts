import 'server-only';

import { loadCheckoutRuntimeConfig } from '@/lib/storefront/checkout-config';
import type { CompanyDisplayStatus, StorefrontOperationalStatus } from './contracts';
import {
  buildStorefrontOperationalStatus,
  projectCheckoutRuntimeConfig,
  unavailableCheckoutOperationalStatus,
} from './operational-contract';

export function getEcommerceStorefrontOperationalStatus(
  company: CompanyDisplayStatus,
  env: Record<string, string | undefined> = process.env,
): StorefrontOperationalStatus {
  let checkout = unavailableCheckoutOperationalStatus();
  try {
    const config = loadCheckoutRuntimeConfig(env, company.subdomain);
    checkout = projectCheckoutRuntimeConfig(config);
  } catch {
    // Configuration is intentionally reported as unavailable. No environment
    // value or secret is copied into the settings DTO.
  }

  return buildStorefrontOperationalStatus({ company, checkout });
}

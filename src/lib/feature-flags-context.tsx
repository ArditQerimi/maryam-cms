'use client';

/**
 * FeatureFlagsContext — feature flags të kompanisë të disponueshme për
 * çdo client component nën DashboardShell.
 *
 * Përdorim tipik:
 *   const { isEnabled } = useFeatureFlags();
 *   if (!isEnabled('receipt_printing')) return null;
 *   const canFiscal = isEnabled('fiscalization');
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

type FlagRecord = Record<string, boolean>;

type ContextValue = {
  flags: FlagRecord;
  isEnabled: (key: string) => boolean;
};

const FeatureFlagsContext = createContext<ContextValue>({
  flags: {},
  isEnabled: () => true, // Default konservator: nëse s'ka context, konsidero të ndezur
});

export function FeatureFlagsProvider({ flags, children }: { flags: FlagRecord; children: ReactNode }) {
  const value = useMemo<ContextValue>(() => ({
    flags,
    // Konvencion: një flag konsiderohet i ndezur nëse s'është `false` në mënyrë eksplicite.
    // Kjo bën që flag-e që nuk ekzistojnë të kthehen si të ndezur (backwards-compatible).
    isEnabled: (key: string) => flags[key] !== false,
  }), [flags]);

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): ContextValue {
  return useContext(FeatureFlagsContext);
}

/** Shkurtore për një flag të vetëm. */
export function useFeature(key: string): boolean {
  return useFeatureFlags().isEnabled(key);
}

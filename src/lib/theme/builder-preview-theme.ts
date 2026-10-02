import { getContextCompany } from '@/lib/tenant';
import { getCompanyCustomizations } from '@/lib/theme/apply-theme';
import { fontStack } from '@/lib/theme/fonts';

/**
 * The `--cms-*` custom properties the storefront sets on `.shopWrapper`.
 * The builder canvas needs them too, otherwise blocks preview with the admin
 * palette (a purple button, a sans-serif heading) instead of the real theme.
 */
export type BuilderPreviewTheme = Record<string, string>;

export async function getBuilderPreviewTheme(): Promise<BuilderPreviewTheme> {
  try {
    const company = await getContextCompany();
    const { colors, fonts } = await getCompanyCustomizations(company.id);
    return {
      '--cms-primary': colors.primary,
      '--cms-secondary': colors.secondary,
      '--cms-background': colors.background,
      '--cms-surface': colors.surface,
      '--cms-text': colors.text,
      '--cms-accent': colors.accent,
      '--cms-heading-font': fontStack(fonts.heading),
      '--cms-body-font': fontStack(fonts.body),
    };
  } catch (error) {
    console.error('[cms/builder] could not resolve the preview theme', error);
    return {};
  }
}

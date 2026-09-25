/**
 * Shared, browser-safe types for the /cms/settings pages.
 * (Kept out of the `actions` module so client forms never touch server code.)
 */

export type SettingValue = string | boolean;
export type SettingsValues = Record<string, SettingValue>;

export type SettingOption = { value: string; label: string };

export type PermalinkOption = SettingOption & { example: string };

export type SettingField =
  | {
      kind: 'text';
      key: string;
      label: string;
      hint?: string;
      placeholder?: string;
      disabled?: boolean;
      inputType?: 'text' | 'url' | 'email';
    }
  | { kind: 'password'; key: string; label: string; hint?: string; placeholder?: string }
  | {
      kind: 'number';
      key: string;
      label: string;
      hint?: string;
      min?: number;
      max?: number;
      step?: number;
      suffix?: string;
    }
  | { kind: 'select'; key: string; label: string; hint?: string; options: SettingOption[] }
  | { kind: 'toggle'; key: string; label: string; hint?: string }
  | { kind: 'radio'; key: string; label: string; hint?: string; options: SettingOption[] }
  | {
      kind: 'textarea';
      key: string;
      label: string;
      hint?: string;
      placeholder?: string;
      rows?: number;
    }
  | {
      kind: 'permalink';
      key: string;
      customKey: string;
      label: string;
      options: PermalinkOption[];
    };

/** Merge server-loaded values over the page's defaults (loaded wins). */
export function withDefaults(
  defaults: SettingsValues,
  loaded: SettingsValues,
): SettingsValues {
  return { ...defaults, ...loaded };
}

export function asString(value: SettingValue | undefined, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? '1' : '0';
  return fallback;
}

export function asBool(value: SettingValue | undefined, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return fallback;
}

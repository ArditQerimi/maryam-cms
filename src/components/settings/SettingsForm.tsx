'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Label, Select, Textarea, cn, inputClass } from '@/components/admin/ui';
import type { SettingField, SettingsValues, SettingValue } from './types';

type ActionLikeResult = { ok: boolean; error?: string };

const PERMALINK_SAMPLES: Record<string, string> = {
  '%year%': '2026',
  '%monthnum%': '09',
  '%month%': '09',
  '%day%': '25',
  '%hour%': '14',
  '%minute%': '32',
  '%second%': '08',
  '%post_id%': '123',
  '%postname%': 'sample-post',
  '%category%': 'uncategorized',
  '%author%': 'admin',
};

function buildPermalinkExample(mask: string): string {
  const withTokens = mask.replace(/%[a-z_]+%/gi, (token) => PERMALINK_SAMPLES[token.toLowerCase()] ?? token);
  return withTokens.startsWith('/') ? withTokens : `/${withTokens}`;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none h-5 w-9 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#6d6be8]/40',
          checked ? 'bg-[#6d6be8]' : 'bg-zinc-300',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute h-4 w-4 rounded-full bg-white shadow transition',
          checked ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </span>
  );
}

/**
 * The shared settings form: renders a field list, keeps one values object and
 * hands it to the page's server action on save. Reused by all eight
 * /cms/settings pages (and by the per-gateway cards on /cms/settings/payments).
 */
export default function SettingsForm({
  fields,
  initialValues,
  onSubmit,
  saveLabel = 'Save changes',
  columns = 2,
  children,
}: {
  fields: SettingField[];
  initialValues: SettingsValues;
  onSubmit: (values: SettingsValues) => Promise<ActionLikeResult>;
  saveLabel?: string;
  columns?: 1 | 2;
  children?: React.ReactNode;
}) {
  const [values, setValues] = useState<SettingsValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  function setValue(key: string, next: SettingValue) {
    setValues((previous) => ({ ...previous, [key]: next }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await onSubmit(values);
      if (result?.ok) {
        toast.success('Settings saved.');
      } else {
        toast.error(result?.error || 'Could not save the settings.');
      }
    } catch (error) {
      console.error('[cms/settings] save failed', error);
      toast.error('Something went wrong while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: SettingField) {
    const wide =
      field.kind === 'toggle' ||
      field.kind === 'radio' ||
      field.kind === 'textarea' ||
      field.kind === 'permalink';

    const wrapperClass = wide ? 'sm:col-span-2' : undefined;

    switch (field.kind) {
      case 'text':
        return (
          <div key={field.key} className={wrapperClass}>
            <Label htmlFor={field.key}>{field.label}</Label>
            <Input
              id={field.key}
              name={field.key}
              type={field.inputType || 'text'}
              value={typeof values[field.key] === 'string' ? (values[field.key] as string) : ''}
              placeholder={field.placeholder}
              disabled={field.disabled}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
            {field.hint ? <p className="mt-1.5 text-xs text-zinc-500">{field.hint}</p> : null}
          </div>
        );

      case 'password': {
        const visible = showSecrets[field.key] === true;
        return (
          <div key={field.key} className={wrapperClass}>
            <Label htmlFor={field.key}>{field.label}</Label>
            <div className="relative">
              <Input
                id={field.key}
                name={field.key}
                type={visible ? 'text' : 'password'}
                className="pr-10"
                autoComplete="new-password"
                value={typeof values[field.key] === 'string' ? (values[field.key] as string) : ''}
                placeholder={field.placeholder}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
              <button
                type="button"
                aria-label={visible ? 'Hide value' : 'Show value'}
                onClick={() =>
                  setShowSecrets((previous) => ({ ...previous, [field.key]: !previous[field.key] }))
                }
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 transition hover:text-zinc-700"
              >
                {visible ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {field.hint ? <p className="mt-1.5 text-xs text-zinc-500">{field.hint}</p> : null}
          </div>
        );
      }

      case 'number':
        return (
          <div key={field.key} className={wrapperClass}>
            <Label htmlFor={field.key}>{field.label}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={field.key}
                name={field.key}
                type="number"
                inputMode="numeric"
                min={field.min}
                max={field.max}
                step={field.step}
                value={typeof values[field.key] === 'string' ? (values[field.key] as string) : ''}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
              {field.suffix ? (
                <span className="shrink-0 text-xs text-zinc-500">{field.suffix}</span>
              ) : null}
            </div>
            {field.hint ? <p className="mt-1.5 text-xs text-zinc-500">{field.hint}</p> : null}
          </div>
        );

      case 'select':
        return (
          <div key={field.key} className={wrapperClass}>
            <Label htmlFor={field.key}>{field.label}</Label>
            <Select
              id={field.key}
              name={field.key}
              value={typeof values[field.key] === 'string' ? (values[field.key] as string) : ''}
              onChange={(event) => setValue(field.key, event.target.value)}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {field.hint ? <p className="mt-1.5 text-xs text-zinc-500">{field.hint}</p> : null}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.key} className={wrapperClass}>
            <Label htmlFor={field.key}>{field.label}</Label>
            <Textarea
              id={field.key}
              name={field.key}
              rows={field.rows || 3}
              placeholder={field.placeholder}
              value={typeof values[field.key] === 'string' ? (values[field.key] as string) : ''}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
            {field.hint ? <p className="mt-1.5 text-xs text-zinc-500">{field.hint}</p> : null}
          </div>
        );

      case 'toggle':
        return (
          <div
            key={field.key}
            className={cn(
              wrapperClass,
              'flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3.5 py-3',
            )}
          >
            <span>
              <span className="block text-sm font-medium text-zinc-700">{field.label}</span>
              {field.hint ? <span className="mt-0.5 block text-xs text-zinc-500">{field.hint}</span> : null}
            </span>
            <Toggle
              label={field.label}
              checked={values[field.key] === true}
              onChange={(next) => setValue(field.key, next)}
            />
          </div>
        );

      case 'radio':
        return (
          <fieldset key={field.key} className={wrapperClass}>
            <legend className="mb-1.5 text-sm font-medium text-zinc-700">{field.label}</legend>
            <div className="space-y-2">
              {field.options.map((option) => {
                const checked = String(values[field.key] ?? '') === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition',
                      checked
                        ? 'border-[#6d6be8] bg-[#6d6be8]/5 text-zinc-900'
                        : 'border-zinc-200 text-zinc-600 hover:border-zinc-300',
                    )}
                  >
                    <input
                      type="radio"
                      name={field.key}
                      className="accent-[#6d6be8]"
                      checked={checked}
                      onChange={() => setValue(field.key, option.value)}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
            {field.hint ? <p className="mt-1.5 text-xs text-zinc-500">{field.hint}</p> : null}
          </fieldset>
        );

      case 'permalink': {
        const selected = String(values[field.key] ?? 'post_name');
        const example =
          selected === 'custom'
            ? buildPermalinkExample(String(values[field.customKey] ?? ''))
            : field.options.find((option) => option.value === selected)?.example || '';
        return (
          <div key={field.key} className={wrapperClass}>
            <span className="mb-1.5 block text-sm font-medium text-zinc-700">{field.label}</span>
            <div className="space-y-2">
              {field.options.map((option) => {
                const checked = selected === option.value;
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 transition',
                      checked
                        ? 'border-[#6d6be8] bg-[#6d6be8]/5'
                        : 'border-zinc-200 hover:border-zinc-300',
                    )}
                  >
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700">
                      <input
                        type="radio"
                        name={field.key}
                        className="accent-[#6d6be8]"
                        checked={checked}
                        onChange={() => setValue(field.key, option.value)}
                      />
                      {option.label}
                    </label>
                    {checked && option.value === 'custom' ? (
                      <input
                        aria-label="Custom permalink mask"
                        className={cn(inputClass, 'mt-2 py-1.5 text-xs')}
                        placeholder="/%year%/%monthnum%/%postname%/"
                        value={
                          typeof values[field.customKey] === 'string'
                            ? (values[field.customKey] as string)
                            : ''
                        }
                        onChange={(event) => setValue(field.customKey, event.target.value)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Example URL
              </p>
              <p className="mt-0.5 break-all font-mono text-xs text-zinc-700">
                {example || '—'}
              </p>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className={cn('grid gap-4', columns === 2 && 'sm:grid-cols-2')}>
        {fields.map((field) => renderField(field))}
      </div>

      {children ? <div className="border-t border-zinc-100 pt-4">{children}</div> : null}

      <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </form>
  );
}

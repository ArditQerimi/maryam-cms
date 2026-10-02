'use client';

import { useMemo, useState } from 'react';
import { Globe, MapPin, Plus, X } from 'lucide-react';
import { Input, cn } from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { CountryOption, LocationChoice, StateOption } from './types';

type LocationPickerProps = {
  countries: CountryOption[];
  states: StateOption[];
  selected: LocationChoice[];
  onChange: (next: LocationChoice[]) => void;
  compact?: boolean;
};

function choiceKey(choice: LocationChoice): string {
  return `${choice.type}:${choice.code}`;
}

const MAX_VISIBLE = 120;

/**
 * Searchable multi-select for zone locations: countries (from `cms_countries`
 * plus a "Kosovo (XK)" entry) and optional states (from `cms_states`).
 */
export default function LocationPicker({
  countries,
  states,
  selected,
  onChange,
  compact = false,
}: LocationPickerProps) {
  const [tab, setTab] = useState<'country' | 'state'>('country');
  const [query, setQuery] = useState('');
  const { t } = useLocale();

  const selectedKeys = useMemo(
    () => new Set(selected.map(choiceKey)),
    [selected],
  );

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (tab === 'country') {
      return countries
        .filter((country) => (
          !needle
          || country.name.toLowerCase().includes(needle)
          || country.code.toLowerCase() === needle
          || country.code.toLowerCase().startsWith(needle)
        ))
        .slice(0, MAX_VISIBLE)
        .map((country) => ({
          key: `country:${country.code}`,
          label: `${country.name} (${country.code})`,
          choice: {
            type: 'country' as const,
            code: country.code,
            label: `${country.name} (${country.code})`,
          },
        }));
    }

    return states
      .filter((state) => (
        !needle
        || state.name.toLowerCase().includes(needle)
        || state.countryName.toLowerCase().includes(needle)
      ))
      .slice(0, MAX_VISIBLE)
      .map((state) => ({
        key: `state:${state.code}`,
        label: `${state.name} — ${state.countryName}`,
        choice: {
          type: 'state' as const,
          code: state.code,
          label: `${state.name} — ${state.countryName}`,
        },
      }));
  }, [countries, states, tab, query]);

  const toggle = (choice: LocationChoice) => {
    const key = choiceKey(choice);
    const exists = selectedKeys.has(key);
    const next = exists
      ? selected.filter((entry) => choiceKey(entry) !== key)
      : [...selected, choice];
    onChange(next);
  };

  const remove = (choice: LocationChoice) => {
    onChange(selected.filter((entry) => choiceKey(entry) !== choiceKey(choice)));
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
        <button
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
            tab === 'country'
              ? 'bg-[#6d6be8]/10 text-[#4f4dd6]'
              : 'text-zinc-500 hover:bg-zinc-100',
          )}
          onClick={() => setTab('country')}
          type="button"
        >
          <Globe size={14} />
          {t('cmsshared.shipping.location_picker.tab_countries')}
        </button>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
            tab === 'state'
              ? 'bg-[#6d6be8]/10 text-[#4f4dd6]'
              : 'text-zinc-500 hover:bg-zinc-100',
          )}
          onClick={() => setTab('state')}
          type="button"
        >
          <MapPin size={14} />
          {t('cmsshared.shipping.location_picker.tab_states')}
        </button>
        <div className="ml-auto w-full max-w-xs sm:w-56">
          <Input
            aria-label={t('cmsshared.shipping.location_picker.search_aria')}
            className="h-8 py-1.5 text-xs"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === 'country'
                ? t('cmsshared.shipping.location_picker.search_countries')
                : t('cmsshared.shipping.location_picker.search_states')
            }
            value={query}
          />
        </div>
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 px-3 py-2.5">
          {selected.map((choice) => (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[#6d6be8]/10 px-2.5 py-1 text-xs font-medium text-[#4f4dd6] ring-1 ring-inset ring-[#6d6be8]/30"
              key={choiceKey(choice)}
            >
              {choice.label}
              <button
                aria-label={t('cmsshared.shipping.location_picker.remove_aria', {
                  label: choice.label,
                })}
                className="rounded-full text-[#4f4dd6]/70 transition hover:bg-[#6d6be8]/20 hover:text-[#3b39b5]"
                onClick={() => remove(choice)}
                type="button"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className={cn('overflow-y-auto px-1.5 py-1.5', compact ? 'max-h-48' : 'max-h-64')}>
        {options.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-zinc-500">
            {tab === 'country'
              ? t('cmsshared.shipping.location_picker.no_countries', { query })
              : t('cmsshared.shipping.location_picker.no_states', { query })}
          </p>
        ) : (
          <ul>
            {options.map((option) => {
              const isSelected = selectedKeys.has(option.key);
              return (
                <li key={option.key}>
                  <button
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition',
                      isSelected
                        ? 'bg-[#6d6be8]/10 text-[#3b39b5]'
                        : 'text-zinc-700 hover:bg-zinc-50',
                    )}
                    onClick={() => toggle(option.choice)}
                    type="button"
                  >
                    <span className="truncate">{option.label}</span>
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded border text-white transition',
                        isSelected
                          ? 'border-[#6d6be8] bg-[#6d6be8]'
                          : 'border-zinc-300 bg-white',
                      )}
                    >
                      {isSelected ? <Plus className="rotate-45" size={12} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500">
        {selected.length === 0
          ? t('cmsshared.shipping.location_picker.none_selected')
          : selected.length === 1
            ? t('cmsshared.shipping.location_picker.selected_one', { count: selected.length })
            : t('cmsshared.shipping.location_picker.selected_many', { count: selected.length })}
      </div>
    </div>
  );
}

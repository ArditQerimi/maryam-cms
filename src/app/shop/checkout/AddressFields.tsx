'use client';

import type { CheckoutAddress } from './checkout-contract';
import styles from './checkout.module.css';

export type AddressPrefix = 'shippingAddress' | 'billingAddress';
export type AddressErrors = Partial<Record<keyof CheckoutAddress, string>>;

type AddressFieldConfig = {
  key: keyof CheckoutAddress;
  label: string;
  autoComplete: string;
  optional?: boolean;
  wide?: boolean;
  type?: 'text' | 'tel';
  inputMode?: 'text' | 'numeric' | 'tel';
};

type AddressFieldsProps = {
  prefix: AddressPrefix;
  value: CheckoutAddress;
  errors?: AddressErrors;
  disabled?: boolean;
  onFieldChange: (key: keyof CheckoutAddress, value: string) => void;
};

const FIELD_CONFIG: readonly AddressFieldConfig[] = [
  { key: 'firstName', label: 'First name', autoComplete: 'given-name' },
  { key: 'lastName', label: 'Last name', autoComplete: 'family-name' },
  { key: 'company', label: 'Company', autoComplete: 'organization', optional: true, wide: true },
  { key: 'address1', label: 'Address', autoComplete: 'address-line1', wide: true },
  { key: 'address2', label: 'Apartment, suite, etc.', autoComplete: 'address-line2', optional: true, wide: true },
  { key: 'country', label: 'Country / region', autoComplete: 'country' },
  { key: 'city', label: 'City', autoComplete: 'address-level2' },
  { key: 'region', label: 'State / province', autoComplete: 'address-level1' },
  { key: 'postalCode', label: 'Postal code', autoComplete: 'postal-code', inputMode: 'text' },
];

const COUNTRIES = [
  ['AL', 'Albania'],
  ['AT', 'Austria'],
  ['BE', 'Belgium'],
  ['FR', 'France'],
  ['DE', 'Germany'],
  ['IT', 'Italy'],
  ['XK', 'Kosovo'],
  ['NL', 'Netherlands'],
  ['ES', 'Spain'],
  ['GB', 'United Kingdom'],
  ['US', 'United States'],
] as const;

export function addressInputId(prefix: AddressPrefix, key: keyof CheckoutAddress) {
  return `${prefix}-${key}`;
}

export default function AddressFields({
  prefix,
  value,
  errors = {},
  disabled = false,
  onFieldChange,
}: AddressFieldsProps) {
  return (
    <div className={styles.addressGrid}>
      {FIELD_CONFIG.map((field) => {
        const id = addressInputId(prefix, field.key);
        const error = errors[field.key];
        const describedBy = error ? `${id}-error` : undefined;
        const className = [
          styles.field,
          field.wide ? styles.fieldWide : '',
          error ? styles.fieldInvalid : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div className={className} key={field.key}>
            <label className={styles.label} htmlFor={id}>
              {field.label}
              {field.optional ? (
                <span className={styles.optional}>Optional</span>
              ) : (
                <span className={styles.requiredMark} aria-hidden="true">*</span>
              )}
            </label>

            {field.key === 'country' ? (
              <select
                aria-describedby={describedBy}
                aria-invalid={error ? true : undefined}
                autoComplete={field.autoComplete}
                className={styles.control}
                disabled={disabled}
                id={id}
                name={`${prefix}.${field.key}`}
                onChange={(event) => onFieldChange(field.key, event.target.value)}
                required
                value={value[field.key]}
              >
                <option value="">Select a country</option>
                {COUNTRIES.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            ) : (
              <input
                aria-describedby={describedBy}
                aria-invalid={error ? true : undefined}
                autoCapitalize={field.key === 'address1' || field.key === 'address2' ? 'sentences' : 'words'}
                autoComplete={field.autoComplete}
                className={styles.control}
                disabled={disabled}
                id={id}
                inputMode={field.inputMode}
                name={`${prefix}.${field.key}`}
                onChange={(event) => onFieldChange(field.key, event.target.value)}
                required={!field.optional}
                spellCheck={field.key === 'company' ? false : true}
                type={field.type ?? 'text'}
                value={value[field.key]}
              />
            )}

            {error ? <p className={styles.fieldError} id={`${id}-error`}>{error}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

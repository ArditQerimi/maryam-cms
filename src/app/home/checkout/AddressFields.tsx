'use client';

import { useLocale, type Translator } from '@/lib/i18n/LocaleProvider';
import type { CheckoutAddress } from './checkout-contract';
import styles from './checkout.module.css';

export type AddressPrefix = 'shippingAddress' | 'billingAddress';
export type AddressErrors = Partial<Record<keyof CheckoutAddress, string>>;

type AddressFieldConfig = {
  key: keyof CheckoutAddress;
  label: Parameters<Translator>[0];
  autoComplete: string;
  optional?: boolean;
  wide?: boolean;
  type?: 'text' | 'tel';
  inputMode?: 'text' | 'numeric' | 'tel';
  placeholder?: Parameters<Translator>[0];
};

type AddressFieldsProps = {
  prefix: AddressPrefix;
  value: CheckoutAddress;
  errors?: AddressErrors;
  disabled?: boolean;
  onFieldChange: (key: keyof CheckoutAddress, value: string) => void;
};

/* WooCommerce billing order: name pair, company, country, street, town, region, ZIP. */
const FIELD_CONFIG: readonly AddressFieldConfig[] = [
  { key: 'firstName', label: 'checkout.address.firstName', autoComplete: 'given-name' },
  { key: 'lastName', label: 'checkout.address.lastName', autoComplete: 'family-name' },
  { key: 'company', label: 'checkout.address.company', autoComplete: 'organization', optional: true, wide: true },
  { key: 'country', label: 'checkout.address.country', autoComplete: 'country-name', wide: true },
  { key: 'address1', label: 'checkout.address.address1', autoComplete: 'address-line1', wide: true, placeholder: 'checkout.address.address1Placeholder' },
  { key: 'address2', label: 'checkout.address.address2', autoComplete: 'address-line2', optional: true, wide: true },
  { key: 'city', label: 'checkout.address.city', autoComplete: 'address-level2', wide: true },
  { key: 'region', label: 'checkout.address.region', autoComplete: 'address-level1' },
  { key: 'postalCode', label: 'checkout.address.postalCode', autoComplete: 'postal-code', inputMode: 'text' },
];

/** ISO code → dictionary key; the visible label translates, the value never does. */
const COUNTRIES: ReadonlyArray<readonly [string, Parameters<Translator>[0]]> = [
  ['AL', 'checkout.country.AL'],
  ['AT', 'checkout.country.AT'],
  ['BE', 'checkout.country.BE'],
  ['FR', 'checkout.country.FR'],
  ['DE', 'checkout.country.DE'],
  ['IT', 'checkout.country.IT'],
  ['XK', 'checkout.country.XK'],
  ['NL', 'checkout.country.NL'],
  ['ES', 'checkout.country.ES'],
  ['GB', 'checkout.country.GB'],
  ['US', 'checkout.country.US'],
];

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
  const { t } = useLocale();

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
              {t(field.label)}
              {field.optional ? (
                <span className={styles.optional}>{t('checkout.address.optional')}</span>
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
                <option value="">{t('checkout.address.selectCountry')}</option>
                {COUNTRIES.map(([code, label]) => (
                  <option key={code} value={code}>{t(label)}</option>
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
                placeholder={field.placeholder ? t(field.placeholder) : undefined}
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

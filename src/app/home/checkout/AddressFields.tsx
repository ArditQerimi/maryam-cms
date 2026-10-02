'use client';

import { SelectField, TextField } from '@/app/home/components/FormField';
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
  hideLabel?: boolean;
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
  { key: 'address2', label: 'checkout.address.address2', autoComplete: 'address-line2', optional: true, wide: true, hideLabel: true },
  { key: 'city', label: 'checkout.address.city', autoComplete: 'address-level2', wide: true },
  { key: 'region', label: 'checkout.address.region', autoComplete: 'address-level1', wide: true },
  { key: 'postalCode', label: 'checkout.address.postalCode', autoComplete: 'postal-code', inputMode: 'text', wide: true },
];

/** ISO code → dictionary key; the visible label translates, the value never does. */
export const COUNTRIES: ReadonlyArray<readonly [string, Parameters<Translator>[0]]> = [
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
  const optionalText = t('checkout.address.optional');

  return (
    <div className={styles.addressGrid}>
      {FIELD_CONFIG.map((field) => {
        const id = addressInputId(prefix, field.key);
        const common = {
          id,
          name: `${prefix}.${field.key}`,
          label: t(field.label),
          required: !field.optional,
          suffix: field.optional && !field.hideLabel ? optionalText : undefined,
          hideLabel: field.hideLabel,
          error: errors[field.key],
          className: [field.wide ? styles.fieldWide : '', field.key === 'address2' ? styles.fieldTight : ''].filter(Boolean).join(' ') || undefined,
          disabled,
          autoComplete: field.autoComplete,
        };

        if (field.key === 'country') {
          return (
            <SelectField
              key={field.key}
              {...common}
              onChange={(event) => onFieldChange(field.key, event.target.value)}
              value={value[field.key]}
            >
              <option value="">{t('checkout.address.selectCountry')}</option>
              {COUNTRIES.map(([code, label]) => (
                <option key={code} value={code}>{t(label)}</option>
              ))}
            </SelectField>
          );
        }

        return (
          <TextField
            key={field.key}
            {...common}
            autoCapitalize={field.key === 'address1' || field.key === 'address2' ? 'sentences' : 'words'}
            inputMode={field.inputMode}
            onChange={(event) => onFieldChange(field.key, event.target.value)}
            placeholder={
              field.placeholder
                ? t(field.placeholder)
                : field.hideLabel
                  ? `${t(field.label)} (${optionalText.toLowerCase()})`
                  : undefined
            }
            spellCheck={field.key === 'company' ? false : true}
            type={field.type ?? 'text'}
            value={value[field.key]}
          />
        );
      })}
    </div>
  );
}

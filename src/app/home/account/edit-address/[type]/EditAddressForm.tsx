'use client';

import { useActionState } from 'react';
import { COUNTRIES } from '@/app/home/checkout/AddressFields';
import { SelectField, TextField } from '@/app/home/components/FormField';
import {
  saveAccountAddress,
  type AddressActionState,
  type AddressKind,
} from '@/lib/account/address-actions';
import { useLocale, type Translator } from '@/lib/i18n/LocaleProvider';
import styles from '../../account.module.css';

type FieldKey =
  | 'firstName' | 'lastName' | 'company' | 'country' | 'address1' | 'address2'
  | 'city' | 'region' | 'postalCode' | 'phone' | 'email';

type FieldConfig = {
  key: FieldKey;
  label: Parameters<Translator>[0];
  autoComplete: string;
  optional?: boolean;
  half?: boolean;
  type?: 'text' | 'tel' | 'email';
  placeholder?: Parameters<Translator>[0];
  billingOnly?: boolean;
  hideLabel?: boolean;
};

const FIELDS: readonly FieldConfig[] = [
  { key: 'firstName', label: 'checkout.address.firstName', autoComplete: 'given-name', half: true },
  { key: 'lastName', label: 'checkout.address.lastName', autoComplete: 'family-name', half: true },
  { key: 'company', label: 'checkout.address.company', autoComplete: 'organization', optional: true },
  { key: 'country', label: 'checkout.address.country', autoComplete: 'country' },
  { key: 'address1', label: 'checkout.address.address1', autoComplete: 'address-line1', placeholder: 'checkout.address.address1Placeholder' },
  { key: 'address2', label: 'checkout.address.address2', autoComplete: 'address-line2', optional: true, hideLabel: true },
  { key: 'city', label: 'checkout.address.city', autoComplete: 'address-level2' },
  { key: 'region', label: 'checkout.address.region', autoComplete: 'address-level1' },
  { key: 'postalCode', label: 'checkout.address.postalCode', autoComplete: 'postal-code' },
  { key: 'phone', label: 'account.form.phone', autoComplete: 'tel', type: 'tel', billingOnly: true },
  { key: 'email', label: 'account.form.email', autoComplete: 'email', type: 'email', billingOnly: true },
];

const INITIAL: AddressActionState = { status: 'idle' };

export default function EditAddressForm({
  kind,
  initial,
}: {
  kind: AddressKind;
  initial: Record<string, string>;
}) {
  const { t } = useLocale();
  const [state, action, pending] = useActionState(
    saveAccountAddress.bind(null, kind),
    INITIAL,
  );
  const fields = FIELDS.filter((field) => !field.billingOnly || kind === 'billing');
  const optionalText = t('checkout.address.optional');

  return (
    <form action={action} className={styles.addressForm} aria-busy={pending}>
      {state.message ? (
        <div
          className={styles.formMessage}
          data-tone={state.status === 'error' ? 'error' : 'success'}
          role="status"
        >
          {state.message}
        </div>
      ) : null}

      <div className={styles.addressFormGrid}>
        {fields.map((field) => {
          const common = {
            id: `${kind}-${field.key}`,
            name: field.key,
            label: t(field.label),
            required: !field.optional,
            suffix: field.optional && !field.hideLabel ? optionalText : undefined,
            hideLabel: field.hideLabel,
            autoComplete: field.autoComplete,
            defaultValue: initial[field.key] ?? '',
            className: field.half ? styles.addressFieldHalf : styles.addressFieldFull,
          };

          if (field.key === 'country') {
            return (
              <SelectField key={field.key} {...common}>
                <option value="">{t('checkout.address.selectCountry')}</option>
                {COUNTRIES.map(([code, countryLabel]) => (
                  <option key={code} value={code}>{t(countryLabel)}</option>
                ))}
              </SelectField>
            );
          }

          return (
            <TextField
              key={field.key}
              {...common}
              type={field.type ?? 'text'}
              maxLength={254}
              placeholder={
                field.placeholder
                  ? t(field.placeholder)
                  : field.hideLabel
                    ? `${t(field.label)} (${optionalText.toLowerCase()})`
                    : undefined
              }
            />
          );
        })}
      </div>

      <button type="submit" className={styles.saveButton} disabled={pending}>
        {pending ? t('account.form.saving') : t('account.addresses.save')}
      </button>
    </form>
  );
}

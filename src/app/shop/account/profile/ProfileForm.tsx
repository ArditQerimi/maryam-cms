'use client';

import Form from 'next/form';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Save } from 'lucide-react';
import {
  updateAccountProfile,
  type ProfileActionState,
} from '@/lib/account/actions';
import styles from '../account.module.css';

const INITIAL_STATE: ProfileActionState = { status: 'idle' };

type ProfileFormProps = {
  initialName: string;
  initialPhone: string | null;
};

export default function ProfileForm({ initialName, initialPhone }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateAccountProfile, INITIAL_STATE);

  const nameError = state.status === 'error' && state.field === 'name' ? state.message : undefined;
  const phoneError = state.status === 'error' && state.field === 'phone' ? state.message : undefined;
  const formError = state.status === 'error' && (!state.field || state.field === 'form')
    ? state.message
    : undefined;

  return (
    <Form
      key={state.completion || 0}
      action={formAction}
      className={styles.form}
      aria-busy={pending}
    >
      <div className={styles.formIntro}>
        <p className={styles.cardKicker}>Personal details</p>
        <h3>Edit your profile</h3>
        <p>Changes apply only to your customer record for this store.</p>
      </div>

      {formError ? (
        <div className={styles.formAlert} data-tone="error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      {state.status === 'success' && !pending ? (
        <div className={styles.formAlert} data-tone="success" role="status" aria-live="polite">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <div className={styles.formFields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="account-name">Full name</label>
          <input
            className={styles.input}
            id="account-name"
            name="name"
            type="text"
            defaultValue={initialName}
            autoComplete="name"
            maxLength={100}
            required
            disabled={pending}
            aria-invalid={Boolean(nameError) || undefined}
            aria-describedby={nameError ? 'account-name-error' : 'account-name-hint'}
          />
          <p className={styles.fieldHint} id="account-name-hint">
            Up to 100 characters. International names are supported.
          </p>
          {nameError ? <p className={styles.fieldError} id="account-name-error">{nameError}</p> : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="account-phone">Phone number</label>
          <input
            className={styles.input}
            id="account-phone"
            name="phone"
            type="tel"
            defaultValue={initialPhone || ''}
            inputMode="tel"
            autoComplete="tel"
            maxLength={50}
            disabled={pending}
            aria-invalid={Boolean(phoneError) || undefined}
            aria-describedby={phoneError ? 'account-phone-error' : 'account-phone-hint'}
          />
          <p className={styles.fieldHint} id="account-phone-hint">
            Optional. Use digits and standard +, -, (), or space characters.
          </p>
          {phoneError ? <p className={styles.fieldError} id="account-phone-error">{phoneError}</p> : null}
        </div>
      </div>

      <div className={styles.formFooter}>
        <p>Email and account permissions are not editable from this form.</p>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? (
            <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
          ) : (
            <Save size={18} aria-hidden="true" />
          )}
          <span>{pending ? 'Saving…' : 'Save changes'}</span>
        </button>
      </div>
      <span className={styles.srOnly} aria-live="polite">
        {pending ? 'Saving your profile' : ''}
      </span>
    </Form>
  );
}

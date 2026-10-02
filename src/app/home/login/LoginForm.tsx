'use client';

import Form from 'next/form';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { login } from '@/lib/auth';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { getSafeReturnTo } from './safe-return-to';
import styles from './login.module.css';

export type LoginFeedback = {
  message: string;
  field?: 'email' | 'password';
} | null;

type LoginFormProps = {
  error: LoginFeedback;
  registerHref: string;
  forgotPasswordHref: string;
};

function CustomerReturnToField() {
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'));

  return <input type="hidden" name="returnTo" value={returnTo} />;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useLocale();

  return (
    <button
      type="submit"
      className={styles.submitButton}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
      ) : null}
      <span>{pending ? t('auth.login.form.submitPending') : t('auth.login.form.submit')}</span>
      <span className={styles.statusText} aria-live="polite">
        {pending ? t('auth.login.form.submitStatus') : ''}
      </span>
    </button>
  );
}

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  /** Localized accessibility labels for the visibility toggle. */
  showLabel: string;
  hideLabel: string;
  autoComplete: 'current-password' | 'new-password';
  visible: boolean;
  onVisibilityChange: () => void;
  describedBy: string;
  invalid: boolean;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
};

function PasswordField({
  id,
  name,
  label,
  showLabel,
  hideLabel,
  autoComplete,
  visible,
  onVisibilityChange,
  describedBy,
  invalid,
  placeholder,
  minLength,
  required = true,
}: PasswordFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label} <span className={styles.required} aria-hidden="true">*</span>
      </label>
      <div className={styles.passwordControl}>
        <input
          className={`${styles.input} ${styles.passwordInput}`}
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={onVisibilityChange}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? hideLabel : showLabel}
        >
          {visible ? (
            <EyeOff size={19} aria-hidden="true" />
          ) : (
            <Eye size={19} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function LoginForm({
  error,
  registerHref,
  forgotPasswordHref,
}: LoginFormProps) {
  const { t } = useLocale();
  const [showPassword, setShowPassword] = useState(false);
  const emailInvalid = error?.field === 'email';
  const passwordInvalid = error?.field === 'password';
  const errorDescription = passwordInvalid ? ' login-form-error' : '';

  return (
    <>
      <Form action={login} className={styles.form} aria-label={t('auth.login.form.aria')}>
        <input type="hidden" name="audience" value="customer" />
        <Suspense fallback={<input type="hidden" name="returnTo" value="/customer/orders" />}>
          <CustomerReturnToField />
        </Suspense>

        {error ? (
          <div className={styles.alert} id="login-form-error" role="alert">
            <AlertCircle size={19} aria-hidden="true" />
            <span>{error.message}</span>
          </div>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-email">
            {t('auth.login.form.emailLabel')}{' '}
            <span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            className={styles.input}
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            required
            aria-invalid={emailInvalid || undefined}
            aria-describedby={emailInvalid ? 'login-form-error' : undefined}
          />
        </div>

        <PasswordField
          id="login-password"
          name="password"
          label={t('auth.login.form.passwordLabel')}
          showLabel={t('auth.login.form.showPassword')}
          hideLabel={t('auth.login.form.hidePassword')}
          autoComplete="current-password"
          visible={showPassword}
          onVisibilityChange={() => setShowPassword((current) => !current)}
          describedBy={`login-password-hint${errorDescription}`}
          invalid={passwordInvalid}
          placeholder={t('auth.login.form.passwordPlaceholder')}
          minLength={8}
        />
        <p className={styles.fieldHint} id="login-password-hint">
          {t('auth.login.form.passwordHint')}
        </p>

        <div className={styles.formUtilities}>
          <Link className={styles.forgotLink} href={forgotPasswordHref}>
            {t('auth.login.form.forgot')}
          </Link>
        </div>

        <SubmitButton />
      </Form>

      <div className={styles.separator} aria-hidden="true">
        <span />
        <em>{t('auth.login.form.separator', { brand: 'Noor POS' })}</em>
        <span />
      </div>

      <Link className={styles.accountLink} href={registerHref}>
        {t('auth.login.form.createAccount')}
        <ArrowRight size={17} aria-hidden="true" />
      </Link>

      <p className={styles.legalCopy}>
        {t('auth.login.form.legal.prefix')}{' '}
        <Link href="/home/terms-conditions">{t('auth.login.form.legal.terms')}</Link>{' '}
        {t('auth.login.form.legal.and')}{' '}
        <Link href="/home/privacy-policy">{t('auth.login.form.legal.privacy')}</Link>.
      </p>
    </>
  );
}

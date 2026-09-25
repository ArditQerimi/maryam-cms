'use client';

import Form from 'next/form';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { login } from '@/lib/auth';
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
      <span>{pending ? 'Signing in…' : 'Sign in'}</span>
      <span className={styles.statusText} aria-live="polite">
        {pending ? 'Signing in' : ''}
      </span>
    </button>
  );
}

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
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
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
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
  const [showPassword, setShowPassword] = useState(false);
  const emailInvalid = error?.field === 'email';
  const passwordInvalid = error?.field === 'password';
  const errorDescription = passwordInvalid ? ' login-form-error' : '';

  return (
    <>
      <Form action={login} className={styles.form} aria-label="Customer sign in">
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
            Email address <span className={styles.required} aria-hidden="true">*</span>
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
          label="Password"
          autoComplete="current-password"
          visible={showPassword}
          onVisibilityChange={() => setShowPassword((current) => !current)}
          describedBy={`login-password-hint${errorDescription}`}
          invalid={passwordInvalid}
          placeholder="Enter your password"
          minLength={8}
        />
        <p className={styles.fieldHint} id="login-password-hint">
          Passwords must contain at least 8 characters.
        </p>

        <div className={styles.formUtilities}>
          <Link className={styles.forgotLink} href={forgotPasswordHref}>
            Forgot your password?
          </Link>
        </div>

        <SubmitButton />
      </Form>

      <div className={styles.separator} aria-hidden="true">
        <span />
        <em>New to Noor POS?</em>
        <span />
      </div>

      <Link className={styles.accountLink} href={registerHref}>
        Create an account
        <ArrowRight size={17} aria-hidden="true" />
      </Link>

      <p className={styles.legalCopy}>
        By signing in, you agree to our{' '}
        <Link href="/shop/terms-conditions">Terms of Service</Link> and{' '}
        <Link href="/shop/privacy-policy">Privacy Policy</Link>.
      </p>
    </>
  );
}

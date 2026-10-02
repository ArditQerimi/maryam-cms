'use client';

import Form from 'next/form';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
} from 'lucide-react';
import { registerCustomer, type RegisterActionState, type RegisterField } from './actions';
import styles from './register.module.css';

type Feedback = {
  message: string;
  field?: RegisterField;
};

const ERROR_MESSAGES: Record<string, Feedback> = {
  'missing-first-name': {
    message: 'Enter your first name.',
    field: 'firstName',
  },
  'missing-email': {
    message: 'Enter your email address.',
    field: 'email',
  },
  'missing-password': {
    message: 'Choose a password.',
    field: 'password',
  },
  'missing-confirm-password': {
    message: 'Enter your password again.',
    field: 'confirmPassword',
  },
  'name-too-short': {
    message: 'Names must contain at least 2 characters.',
  },
  'invalid-email': {
    message: 'Enter a valid email address.',
    field: 'email',
  },
  'password-too-short': {
    message: 'Use a password with at least 8 characters.',
    field: 'password',
  },
  'password-mismatch': {
    message: 'The passwords do not match.',
    field: 'confirmPassword',
  },
  'terms-required': {
    message: 'Agree to the Terms of Service and Privacy Policy to continue.',
    field: 'terms',
  },
  'email-taken': {
    message: 'An account already exists for this email. Try signing in instead.',
    field: 'email',
  },
  'account-suspended': {
    message: 'This store is suspended, so new accounts cannot be created.',
  },
  'registration-unavailable': {
    message: 'We could not create your account right now. Please try again shortly.',
  },
  'session-unavailable': {
    message: 'Your account was created, but we could not sign you in automatically. Use the sign-in link below.',
  },
};

const FALLBACK_ERROR: Feedback = {
  message: 'We could not create your account. Check your details and try again.',
};

type RegisterFormProps = {
  initialErrorCode?: string;
  returnTo: string;
  loginHref: string;
};

type PasswordFieldProps = {
  id: 'register-password' | 'register-confirm-password';
  name: 'password' | 'confirmPassword';
  label: string;
  placeholder: string;
  visible: boolean;
  onVisibilityChange: () => void;
  hintId: string;
  errorId?: string;
  error?: string;
  invalid: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

function PasswordField({
  id,
  name,
  label,
  placeholder,
  visible,
  onVisibilityChange,
  hintId,
  errorId,
  error,
  invalid,
  value,
  onChange,
  onBlur,
}: PasswordFieldProps) {
  const describedBy = errorId ? `${hintId} ${errorId}` : hintId;

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
          autoComplete="new-password"
          placeholder={placeholder}
          minLength={8}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
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
      <p className={styles.hint} id={hintId}>
        Use at least 8 characters.
      </p>
      {error ? (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getFeedback(errorCode?: string): Feedback | null {
  if (!errorCode) return null;
  return ERROR_MESSAGES[errorCode] || FALLBACK_ERROR;
}

export default function RegisterForm({
  initialErrorCode,
  returnTo,
  loginHref,
}: RegisterFormProps) {
  const initialState: RegisterActionState = { error: initialErrorCode };
  const [state, formAction, pending] = useActionState(registerCustomer, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);

  const feedbackState = getFeedback(state.error);
  const feedback = feedbackState && state.field
    ? { ...feedbackState, field: state.field }
    : feedbackState;
  const fieldError = (field: RegisterField) =>
    feedback?.field === field ? feedback.message : undefined;
  const liveMismatch =
    confirmTouched && confirmPassword.length > 0 && password !== confirmPassword;
  const confirmError = liveMismatch
    ? 'The passwords do not match.'
    : fieldError('confirmPassword');

  return (
    <>
      <Form action={formAction} className={styles.form} aria-busy={pending} aria-label="Create customer account">
        <input type="hidden" name="returnTo" value={returnTo} />

        {feedback ? (
          <div className={styles.alert} id="register-form-error" role="alert">
            <AlertCircle size={19} aria-hidden="true" />
            <span>{feedback.message}</span>
          </div>
        ) : null}

        <div className={styles.nameRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-first-name">
              First name <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              className={styles.input}
              id="register-first-name"
              name="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="First name"
              minLength={2}
              required
              aria-invalid={feedback?.field === 'firstName' || undefined}
              aria-describedby={feedback?.field === 'firstName' ? 'first-name-error' : undefined}
            />
            {feedback?.field === 'firstName' ? (
              <p className={styles.fieldError} id="first-name-error">
                {feedback.message}
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-last-name">
              Last name <span className={styles.optional}>(optional)</span>
            </label>
            <input
              className={styles.input}
              id="register-last-name"
              name="lastName"
              type="text"
              autoComplete="family-name"
              placeholder="Last name"
              minLength={2}
              aria-invalid={feedback?.field === 'lastName' || undefined}
              aria-describedby={feedback?.field === 'lastName' ? 'last-name-error' : undefined}
            />
            {feedback?.field === 'lastName' ? (
              <p className={styles.fieldError} id="last-name-error">
                {feedback.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-email">
            Email address <span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            className={styles.input}
            id="register-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            required
            aria-invalid={feedback?.field === 'email' || undefined}
            aria-describedby={feedback?.field === 'email' ? 'email-error' : undefined}
          />
          {feedback?.field === 'email' ? (
            <p className={styles.fieldError} id="email-error">
              {feedback.message}
            </p>
          ) : null}
        </div>

        <PasswordField
          id="register-password"
          name="password"
          label="Password"
          placeholder="Create a password"
          visible={showPassword}
          onVisibilityChange={() => setShowPassword((current) => !current)}
          hintId="password-hint"
          errorId={fieldError('password') ? 'password-error' : undefined}
          error={fieldError('password')}
          invalid={feedback?.field === 'password'}
          value={password}
          onChange={setPassword}
        />

        <PasswordField
          id="register-confirm-password"
          name="confirmPassword"
          label="Confirm password"
          placeholder="Enter it again"
          visible={showConfirmation}
          onVisibilityChange={() => setShowConfirmation((current) => !current)}
          hintId="confirm-password-hint"
          errorId={confirmError ? 'confirm-password-error' : undefined}
          error={confirmError}
          invalid={Boolean(confirmError)}
          value={confirmPassword}
          onChange={setConfirmPassword}
          onBlur={() => setConfirmTouched(true)}
        />

        <div className={styles.termsGroup}>
          <div className={styles.checkboxControl}>
            <input
              id="register-terms"
              name="terms"
              type="checkbox"
              required
              aria-invalid={feedback?.field === 'terms' || undefined}
              aria-describedby={feedback?.field === 'terms' ? 'terms-error' : undefined}
            />
            <label htmlFor="register-terms">I agree to the account terms and privacy notice.</label>
          </div>
          <p className={styles.policyLinks}>
            Read our{' '}
            <Link href="/shop/terms-conditions">Terms of Service</Link> and{' '}
            <Link href="/shop/privacy-policy">Privacy Policy</Link>.
          </p>
          {feedback?.field === 'terms' ? (
            <p className={styles.fieldError} id="terms-error">
              {feedback.message}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? (
            <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
          ) : null}
          <span>{pending ? 'Creating account…' : 'Create account'}</span>
          <span className={styles.statusText} aria-live="polite">
            {pending ? 'Creating your account' : ''}
          </span>
        </button>
      </Form>

      <div className={styles.separator} aria-hidden="true">
        <span />
        <em>Already have an account?</em>
        <span />
      </div>

      <Link className={styles.loginLink} href={loginHref}>
        Sign in instead
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </>
  );
}

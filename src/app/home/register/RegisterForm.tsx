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
import { useLocale, type Translator } from '@/lib/i18n/LocaleProvider';
import styles from './register.module.css';

type Feedback = {
  message: string;
  field?: RegisterField;
};

/** Dictionary keys (not literal copy) so sq and en stay in sync. */
type FeedbackEntry = { key: Parameters<Translator>[0]; field?: RegisterField };

const ERROR_MESSAGES: Record<string, FeedbackEntry> = {
  'missing-first-name': {
    key: 'auth.register.error.missing-first-name',
    field: 'firstName',
  },
  'missing-email': {
    key: 'auth.register.error.missing-email',
    field: 'email',
  },
  'missing-password': {
    key: 'auth.register.error.missing-password',
    field: 'password',
  },
  'missing-confirm-password': {
    key: 'auth.register.error.missing-confirm-password',
    field: 'confirmPassword',
  },
  'name-too-short': {
    key: 'auth.register.error.name-too-short',
  },
  'invalid-email': {
    key: 'auth.register.error.invalid-email',
    field: 'email',
  },
  'password-too-short': {
    key: 'auth.register.error.password-too-short',
    field: 'password',
  },
  'password-mismatch': {
    key: 'auth.register.error.password-mismatch',
    field: 'confirmPassword',
  },
  'terms-required': {
    key: 'auth.register.error.terms-required',
    field: 'terms',
  },
  'email-taken': {
    key: 'auth.register.error.email-taken',
    field: 'email',
  },
  'account-suspended': {
    key: 'auth.register.error.account-suspended',
  },
  'registration-unavailable': {
    key: 'auth.register.error.registration-unavailable',
  },
  'session-unavailable': {
    key: 'auth.register.error.session-unavailable',
  },
};

const FALLBACK_ERROR: FeedbackEntry = {
  key: 'auth.register.error.fallback',
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
  /** Localized accessibility labels for the visibility toggle. */
  showLabel: string;
  hideLabel: string;
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
  showLabel,
  hideLabel,
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
  const { t } = useLocale();
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
      <p className={styles.hint} id={hintId}>
        {t('auth.register.form.passwordHint')}
      </p>
      {error ? (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getFeedback(errorCode?: string): FeedbackEntry | null {
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
  const { t } = useLocale();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);

  const feedbackState = getFeedback(state.error);
  const feedback: Feedback | null = feedbackState
    ? state.field
      ? { message: t(feedbackState.key), field: state.field }
      : feedbackState.field
        ? { message: t(feedbackState.key), field: feedbackState.field }
        : { message: t(feedbackState.key) }
    : null;
  const fieldError = (field: RegisterField) =>
    feedback?.field === field ? feedback.message : undefined;
  const liveMismatch =
    confirmTouched && confirmPassword.length > 0 && password !== confirmPassword;
  const confirmError = liveMismatch
    ? t('auth.register.error.password-mismatch')
    : fieldError('confirmPassword');

  return (
    <>
      <Form action={formAction} className={styles.form} aria-busy={pending} aria-label={t('auth.register.form.aria')}>
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
              {t('auth.register.form.firstName')}{' '}
              <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              className={styles.input}
              id="register-first-name"
              name="firstName"
              type="text"
              autoComplete="given-name"
              placeholder={t('auth.register.form.firstName')}
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
              {t('auth.register.form.lastName')}{' '}
              <span className={styles.optional}>{t('auth.register.form.optional')}</span>
            </label>
            <input
              className={styles.input}
              id="register-last-name"
              name="lastName"
              type="text"
              autoComplete="family-name"
              placeholder={t('auth.register.form.lastName')}
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
            {t('auth.register.form.email')}{' '}
            <span className={styles.required} aria-hidden="true">*</span>
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
          label={t('auth.register.form.password')}
          showLabel={t('auth.register.form.showPassword')}
          hideLabel={t('auth.register.form.hidePassword')}
          placeholder={t('auth.register.form.passwordPlaceholder')}
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
          label={t('auth.register.form.confirmPassword')}
          showLabel={t('auth.register.form.showConfirm')}
          hideLabel={t('auth.register.form.hideConfirm')}
          placeholder={t('auth.register.form.confirmPlaceholder')}
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
            <label htmlFor="register-terms">{t('auth.register.form.terms')}</label>
          </div>
          <p className={styles.policyLinks}>
            {t('auth.register.form.policy.prefix')}{' '}
            <Link href="/home/terms-conditions">{t('auth.register.form.policy.terms')}</Link>{' '}
            {t('auth.register.form.policy.and')}{' '}
            <Link href="/home/privacy-policy">{t('auth.register.form.policy.privacy')}</Link>.
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
          <span>
            {pending ? t('auth.register.form.submitPending') : t('auth.register.form.submit')}
          </span>
          <span className={styles.statusText} aria-live="polite">
            {pending ? t('auth.register.form.submitStatus') : ''}
          </span>
        </button>
      </Form>

      <div className={styles.separator} aria-hidden="true">
        <span />
        <em>{t('auth.register.form.separator')}</em>
        <span />
      </div>

      <Link className={styles.loginLink} href={loginHref}>
        {t('auth.register.form.signInInstead')}
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </>
  );
}

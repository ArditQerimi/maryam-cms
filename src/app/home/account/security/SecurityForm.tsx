'use client';

import Form from 'next/form';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  changeAccountPassword,
  type PasswordActionState,
} from '@/lib/account/actions';
import { getPasswordStrength } from '@/lib/account/validation';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from '../account.module.css';

const INITIAL_STATE: PasswordActionState = { status: 'idle' };

/** `getPasswordStrength` returns fixed English labels (asserted by unit tests) → map them to dictionary keys here. */
const STRENGTH_LABEL_KEYS = {
  'Too short': 'account.strength.too_short',
  Weak: 'account.strength.weak',
  Fair: 'account.strength.fair',
  Good: 'account.strength.good',
  Strong: 'account.strength.strong',
} as const;

type PasswordFieldName = 'currentPassword' | 'newPassword' | 'confirmPassword';

type PasswordInputProps = {
  id: PasswordFieldName;
  label: string;
  value: string;
  visible: boolean;
  autoComplete: 'current-password' | 'new-password';
  minLength: number;
  error?: string;
  hint: string;
  showAria: string;
  hideAria: string;
  pending: boolean;
  onValueChange: (value: string) => void;
  onVisibilityChange: () => void;
};

function PasswordSubmit() {
  const { pending } = useFormStatus();
  const { t } = useLocale();

  return (
    <button
      type="submit"
      className={styles.primaryButton}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
      ) : (
        <KeyRound size={18} aria-hidden="true" />
      )}
      <span>{pending ? t('account.securityForm.updating') : t('account.securityForm.submit')}</span>
    </button>
  );
}

function PasswordInput({
  id,
  label,
  value,
  visible,
  autoComplete,
  minLength,
  error,
  hint,
  showAria,
  hideAria,
  pending,
  onValueChange,
  onVisibilityChange,
}: PasswordInputProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${hintId} ${errorId}` : hintId;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={styles.passwordControl}>
        <input
          className={`${styles.input} ${styles.passwordInput}`}
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={72}
          required
          disabled={pending}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={onVisibilityChange}
          disabled={pending}
          aria-label={visible ? hideAria : showAria}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      <p className={styles.fieldHint} id={hintId}>{hint}</p>
      {error ? <p className={styles.fieldError} id={errorId}>{error}</p> : null}
    </div>
  );
}

type PasswordFieldsProps = {
  pending: boolean;
  currentPasswordError?: string;
  newPasswordError?: string;
  confirmPasswordError?: string;
};

function PasswordFields({
  pending,
  currentPasswordError,
  newPasswordError,
  confirmPasswordError,
}: PasswordFieldsProps) {
  const { t } = useLocale();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState<Record<PasswordFieldName, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const strength = getPasswordStrength(newPassword);

  const toggleVisibility = (field: PasswordFieldName) => {
    setVisible((current) => ({ ...current, [field]: !current[field] }));
  };

  return (
    <div className={styles.formFields}>
      <PasswordInput
        id="currentPassword"
        label={t('account.securityForm.currentPassword')}
        value={currentPassword}
        visible={visible.currentPassword}
        autoComplete="current-password"
        minLength={1}
        error={currentPasswordError}
        hint={t('account.securityForm.currentHint')}
        showAria={t('account.securityForm.showCurrent')}
        hideAria={t('account.securityForm.hideCurrent')}
        pending={pending}
        onValueChange={setCurrentPassword}
        onVisibilityChange={() => toggleVisibility('currentPassword')}
      />

      <PasswordInput
        id="newPassword"
        label={t('account.securityForm.newPassword')}
        value={newPassword}
        visible={visible.newPassword}
        autoComplete="new-password"
        minLength={12}
        error={newPasswordError}
        hint={t('account.securityForm.newHint')}
        showAria={t('account.securityForm.showNew')}
        hideAria={t('account.securityForm.hideNew')}
        pending={pending}
        onValueChange={setNewPassword}
        onVisibilityChange={() => toggleVisibility('newPassword')}
      />

      {newPassword ? (
        <div className={styles.strengthPanel} aria-live="polite">
          <div className={styles.strengthHeader}>
            <span>{t('account.securityForm.strengthLabel')}</span>
            <strong>{t(STRENGTH_LABEL_KEYS[strength.label])}</strong>
          </div>
          <div className={styles.strengthTrack} aria-hidden="true">
            <span data-score={strength.score} />
          </div>
        </div>
      ) : null}

      <PasswordInput
        id="confirmPassword"
        label={t('account.securityForm.confirmPassword')}
        value={confirmPassword}
        visible={visible.confirmPassword}
        autoComplete="new-password"
        minLength={12}
        error={confirmPasswordError}
        hint={t('account.securityForm.confirmHint')}
        showAria={t('account.securityForm.showConfirm')}
        hideAria={t('account.securityForm.hideConfirm')}
        pending={pending}
        onValueChange={setConfirmPassword}
        onVisibilityChange={() => toggleVisibility('confirmPassword')}
      />
    </div>
  );
}

export default function SecurityForm() {
  const [state, formAction, pending] = useActionState(changeAccountPassword, INITIAL_STATE);
  const { t } = useLocale();
  const fieldError = (field: PasswordFieldName) =>
    state.status === 'error' && state.field === field ? state.message : undefined;
  const formError = state.status === 'error' && (!state.field || state.field === 'form')
    ? state.message
    : undefined;

  return (
    <Form action={formAction} className={styles.form} aria-busy={pending}>
      <div className={styles.formIntro}>
        <p className={styles.cardKicker}>{t('account.securityForm.kicker')}</p>
        <h3>{t('account.securityForm.title')}</h3>
        <p>{t('account.securityForm.intro')}</p>
      </div>

      <div className={styles.securityNote} role="note">
        <ShieldCheck size={19} aria-hidden="true" />
        <span>{t('account.securityForm.serverNote')}</span>
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

      <PasswordFields
        key={state.completion || 0}
        pending={pending}
        currentPasswordError={fieldError('currentPassword')}
        newPasswordError={fieldError('newPassword')}
        confirmPasswordError={fieldError('confirmPassword')}
      />

      <div className={styles.formFooter}>
        <p>{t('account.securityForm.footer')}</p>
        <PasswordSubmit />
      </div>
      <span className={styles.srOnly} aria-live="polite">
        {pending ? t('account.securityForm.changeStatus') : ''}
      </span>
    </Form>
  );
}

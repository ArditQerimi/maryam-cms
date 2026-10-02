'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { TextField } from '@/app/home/components/FormField';
import { changeAccountPassword, updateAccountProfile } from '@/lib/account/actions';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from '../account.module.css';

type ProfileFormProps = {
  initialName: string;
  initialPhone: string | null;
  initialEmail: string;
};

type PasswordFieldName = 'currentPassword' | 'newPassword' | 'confirmPassword';

type FormMessage = { tone: 'success' | 'error'; text: string };

/** The account stores one `name`; the form edits it as first + last. */
function splitName(full: string) {
  const parts = full.trim().split(/\s+/u).filter(Boolean);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

export default function ProfileForm({ initialName, initialPhone, initialEmail }: ProfileFormProps) {
  const { t } = useLocale();
  const initial = splitName(initialName);
  const [firstName, setFirstName] = useState(initial.first);
  const [lastName, setLastName] = useState(initial.last);
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [passwords, setPasswords] = useState<Record<PasswordFieldName, string>>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [visible, setVisible] = useState<Record<PasswordFieldName, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [message, setMessage] = useState<FormMessage | null>(null);
  const [pending, startTransition] = useTransition();

  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const setPassword = (field: PasswordFieldName, value: string) =>
    setPasswords((current) => ({ ...current, [field]: value }));
  const toggleVisible = (field: PasswordFieldName) =>
    setVisible((current) => ({ ...current, [field]: !current[field] }));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    startTransition(async () => {
      setMessage(null);

      const profileData = new FormData();
      profileData.set('name', displayName);
      profileData.set('phone', phone);
      const profile = await updateAccountProfile({ status: 'idle' }, profileData);
      if (profile.status === 'error') {
        setMessage({ tone: 'error', text: profile.message ?? '' });
        return;
      }

      // The password section is optional — blank means "leave unchanged".
      const wantsPasswordChange = Object.values(passwords).some((value) => value.length > 0);
      if (wantsPasswordChange) {
        const passwordData = new FormData();
        passwordData.set('currentPassword', passwords.currentPassword);
        passwordData.set('newPassword', passwords.newPassword);
        passwordData.set('confirmPassword', passwords.confirmPassword);
        // A successful change rotates the session; the action redirects to sign-in when needed.
        const result = await changeAccountPassword({ status: 'idle' }, passwordData);
        if (result.status === 'error') {
          setMessage({ tone: 'error', text: result.message ?? '' });
          return;
        }
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setMessage({ tone: 'success', text: result.message ?? profile.message ?? '' });
        return;
      }

      setMessage({ tone: 'success', text: profile.message ?? '' });
    });
  }

  const passwordFields: Array<{ name: PasswordFieldName; label: string; autoComplete: string }> = [
    { name: 'currentPassword', label: t('account.form.currentPassword'), autoComplete: 'current-password' },
    { name: 'newPassword', label: t('account.form.newPassword'), autoComplete: 'new-password' },
    { name: 'confirmPassword', label: t('account.form.confirmPassword'), autoComplete: 'new-password' },
  ];

  return (
    <form className={styles.detailsForm} onSubmit={onSubmit} aria-busy={pending}>
      {message ? (
        <div className={styles.formMessage} data-tone={message.tone} role="status" aria-live="polite">
          {message.text}
        </div>
      ) : null}

      <div className={styles.fieldRow}>
        <TextField
          id="account-first-name"
          label={t('account.form.firstName')}
          required
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          maxLength={60}
        />
        <TextField
          id="account-last-name"
          label={t('account.form.lastName')}
          required
          autoComplete="family-name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          maxLength={60}
        />
      </div>

      <TextField
        id="account-display-name"
        label={t('account.form.displayName')}
        required
        value={displayName}
        readOnly
        hint={t('account.form.displayNameHint')}
      />

      <TextField
        id="account-email"
        label={t('account.form.email')}
        required
        type="email"
        value={initialEmail}
        readOnly
      />

      <TextField
        id="account-phone"
        label={t('account.form.phone')}
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        maxLength={50}
      />

      <fieldset className={styles.passwordFieldset}>
        <legend>{t('account.form.passwordChange')}</legend>
        {passwordFields.map((field) => (
          <TextField
            key={field.name}
            id={`account-${field.name}`}
            label={field.label}
            type={visible[field.name] ? 'text' : 'password'}
            autoComplete={field.autoComplete}
            value={passwords[field.name]}
            onChange={(event) => setPassword(field.name, event.target.value)}
            maxLength={72}
            adornment={
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => toggleVisible(field.name)}
                aria-label={
                  visible[field.name] ? t('account.form.hidePassword') : t('account.form.showPassword')
                }
                aria-pressed={visible[field.name]}
                aria-controls={`account-${field.name}`}
              >
                {visible[field.name] ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            }
          />
        ))}
      </fieldset>

      <button type="submit" className={styles.saveButton} disabled={pending}>
        {pending ? t('account.form.saving') : t('account.form.save')}
      </button>
    </form>
  );
}

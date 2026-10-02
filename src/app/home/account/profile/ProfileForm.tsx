'use client';

import Form from 'next/form';
import { Save } from 'lucide-react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from '../account.module.css';

type ProfileFormProps = {
  initialName: string;
  initialPhone: string | null;
  initialEmail: string;
};

export default function ProfileForm({ initialName, initialPhone, initialEmail }: ProfileFormProps) {
  const { t } = useLocale();

  return (
    <Form className={styles.accountDetailsForm} action="#">
      <div className={styles.profileFormIntroBlock}>
        <h2>{t('account.profileForm.kicker')}</h2>
        <p>{t('account.profileForm.intro')}</p>
      </div>

      <div className={styles.formFieldStack}>
        <label className={styles.inlineLabel} htmlFor="account-name">
          {t('account.profileForm.nameLabel')}
        </label>
        <input id="account-name" name="name" type="text" defaultValue={initialName} className={styles.accountInput} />
        <small className={styles.helpText}>{t('account.profileForm.nameHint')}</small>
      </div>

      <div className={styles.formFieldStack}>
        <label className={styles.inlineLabel} htmlFor="account-phone">
          {t('account.profileForm.phoneLabel')}
        </label>
        <input id="account-phone" name="phone" type="tel" defaultValue={initialPhone ?? ''} className={styles.accountInput} />
        <small className={styles.helpText}>{t('account.profileForm.phoneHint')}</small>
      </div>

      <p className={styles.profileFooterText}>{t('account.profileForm.footer')}</p>

      <button type="submit" className={styles.saveButton}>
        <Save size={18} aria-hidden="true" />
        <span>{t('account.profileForm.save')}</span>
      </button>
    </Form>
  );
}

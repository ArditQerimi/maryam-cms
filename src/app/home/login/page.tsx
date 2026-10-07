import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import LoginForm, { type LoginFeedback } from './LoginForm';
import RegisterForm from '../register/RegisterForm';
import ShopPageHeader from '../components/ShopPageHeader';
import { getSafeReturnTo, withSafeReturnTo } from './safe-return-to';
import { getContextCompany } from '@/lib/tenant';
import { getT, type Dictionary } from '@/lib/i18n/server';
import styles from './account-auth.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const storeName = (await getContextCompany().catch(() => null))?.name?.trim() || 'the store';
  return {
    title: 'Customer Sign In',
    description: `Sign in to your ${storeName} customer account to view orders and manage your account.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

// Dictionary keys (not literal copy) so sq and en stay in sync — `t()` resolves
// them against the active locale. Only the `?error=` code crosses the network.
type LoginErrorEntry = { key: keyof Dictionary; field?: 'email' | 'password' };

const ERROR_MESSAGES: Record<string, LoginErrorEntry> = {
  'missing-fields': {
    key: 'auth.login.error.missing-fields',
  },
  'invalid-email': {
    key: 'auth.login.error.invalid-email',
    field: 'email',
  },
  'password-too-short': {
    key: 'auth.login.error.password-too-short',
    field: 'password',
  },
  'invalid-credentials': {
    key: 'auth.login.error.invalid-credentials',
  },
  'account-suspended': {
    key: 'auth.login.error.account-suspended',
  },
  'tenant-domain-required': {
    key: 'auth.login.error.tenant-domain-required',
  },
  'wrong-audience': {
    key: 'auth.login.error.wrong-audience',
  },
  'company-not-found': {
    key: 'auth.login.error.company-not-found',
  },
  'tenant-not-found': {
    key: 'auth.login.error.tenant-not-found',
  },
  'database-error': {
    key: 'auth.login.error.database-error',
  },
  'server-error': {
    key: 'auth.login.error.server-error',
  },
};

type SearchParamValue = string | string[] | undefined;

type LoginPageProps = {
  searchParams?: Promise<{
    error?: SearchParamValue;
    returnTo?: SearchParamValue;
    notice?: SearchParamValue;
  }>;
};

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShopLoginPage({ searchParams }: LoginPageProps) {
  const [params, t] = await Promise.all([searchParams, getT()]);
  const errorCode = firstValue(params?.error);
  const notice = firstValue(params?.notice);
  const requestedReturnTo = getSafeReturnTo(firstValue(params?.returnTo));
  const errorEntry = errorCode ? ERROR_MESSAGES[errorCode] : undefined;
  const error: LoginFeedback = errorCode
    ? {
        message: t(errorEntry ? errorEntry.key : 'auth.login.error.fallback'),
        field: errorEntry?.field,
      }
    : null;

  return (
    <div className={styles.page}>
      <ShopPageHeader
        title={t('auth.crumb.myAccount')}
        crumbs={[{ label: t('auth.crumb.myAccount') }]}
      />

      <div className={styles.main}>
        <div className={styles.columns}>
          <section aria-labelledby="login-card-title">
            <h2 className={styles.panelTitle} id="login-card-title">{t('auth.login.card.title')}</h2>
            <div className={styles.panel}>
              {notice === 'password-reset' ? (
                <p role="status">
                  <Check size={17} aria-hidden="true" />
                  {t('auth.login.notice.passwordReset')}
                </p>
              ) : null}

              <LoginForm
                error={error}
                registerHref={withSafeReturnTo('/home/register', requestedReturnTo)}
                forgotPasswordHref="/home/forgot-password"
              />
            </div>
          </section>

          <section aria-labelledby="register-card-title">
            <h2 className={styles.panelTitle} id="register-card-title">{t('auth.register.card.title')}</h2>
            <div className={styles.panel}>
              <RegisterForm
                returnTo={requestedReturnTo}
                loginHref={withSafeReturnTo('/home/login', requestedReturnTo)}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

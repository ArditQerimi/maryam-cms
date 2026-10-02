import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Check,
  History,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import LoginForm, { type LoginFeedback } from './LoginForm';
import { getSafeReturnTo, withSafeReturnTo } from './safe-return-to';
import { getContextCompany } from '@/lib/tenant';
import { getT, type Dictionary } from '@/lib/i18n/server';
import styles from './login.module.css';

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
  const [params, company, t] = await Promise.all([
    searchParams,
    getContextCompany().catch(() => null),
    getT(),
  ]);
  const storeName = company?.name?.trim() || t('auth.store.unnamed');
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
      <div className={styles.breadcrumbBar}>
        <nav className={styles.breadcrumbNav} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/home">{t('auth.crumb.home')}</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{t('auth.crumb.myAccount')}</li>
          </ol>
        </nav>
      </div>

      <div className={styles.main}>
        <div className={styles.layout}>
          <section className={styles.intro} aria-labelledby="login-page-title">
            <p className={styles.eyebrow}>{t('auth.login.eyebrow', { store: storeName })}</p>
            <h1 id="login-page-title">{t('auth.login.title')}</h1>
            <p className={styles.introCopy}>{t('auth.login.intro')}</p>

            <ul className={styles.benefitList} aria-label={t('auth.login.benefits.aria')}>
              <li>
                <span className={styles.benefitIcon}>
                  <History size={19} aria-hidden="true" />
                </span>
                <span>
                  <strong>{t('auth.login.benefit.history.title')}</strong>
                  <small>{t('auth.login.benefit.history.text')}</small>
                </span>
              </li>
              <li>
                <span className={styles.benefitIcon}>
                  <ShoppingBag size={19} aria-hidden="true" />
                </span>
                <span>
                  <strong>{t('auth.login.benefit.quick.title')}</strong>
                  <small>{t('auth.login.benefit.quick.text')}</small>
                </span>
              </li>
              <li>
                <span className={styles.benefitIcon}>
                  <PackageCheck size={19} aria-hidden="true" />
                </span>
                <span>
                  <strong>{t('auth.login.benefit.secure.title')}</strong>
                  <small>{t('auth.login.benefit.secure.text')}</small>
                </span>
              </li>
            </ul>

            <div className={styles.trustNote}>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>{t('auth.login.trust')}</span>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="login-card-title">
            <div className={styles.cardHeader}>
              <p className={styles.cardKicker}>{t('auth.login.card.kicker')}</p>
              <h2 id="login-card-title">{t('auth.login.card.title')}</h2>
              <p>{t('auth.login.card.copy')}</p>
            </div>

            {notice === 'password-reset' ? (
              <p className={styles.successAlert} role="status">
                <Check size={17} aria-hidden="true" />
                {t('auth.login.notice.passwordReset')}
              </p>
            ) : null}

            <LoginForm
              error={error}
              registerHref={withSafeReturnTo('/home/register', requestedReturnTo)}
              forgotPasswordHref="/home/forgot-password"
            />
          </section>
        </div>
      </div>
    </div>
  );
}

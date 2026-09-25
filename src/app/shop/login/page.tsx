import type { Metadata } from 'next';
import Link from 'next/link';
import {
  History,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import LoginForm, { type LoginFeedback } from './LoginForm';
import { getSafeReturnTo, withSafeReturnTo } from './safe-return-to';
import { getContextCompany } from '@/lib/tenant';
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

const ERROR_MESSAGES: Record<string, Exclude<LoginFeedback, null>> = {
  'missing-fields': {
    message: 'Enter both your email address and password to continue.',
  },
  'invalid-email': {
    message: 'Enter a valid email address.',
    field: 'email',
  },
  'password-too-short': {
    message: 'Your password must contain at least 8 characters.',
    field: 'password',
  },
  'invalid-credentials': {
    message: 'We could not sign you in. Check your email and password, then try again.',
  },
  'account-suspended': {
    message: 'This store account is suspended. Please contact the store for help.',
  },
  'tenant-domain-required': {
    message: 'This account belongs to a store. Sign in through that store’s website.',
  },
  'company-not-found': {
    message: 'We could not find a store for this account. Check the address or contact support.',
  },
  'tenant-not-found': {
    message: 'The store for this account could not be found. Please try again later.',
  },
  'database-error': {
    message: 'We could not reach your store right now. Please try again shortly.',
  },
  'server-error': {
    message: 'Something went wrong while signing in. Please try again.',
  },
};

type SearchParamValue = string | string[] | undefined;

type LoginPageProps = {
  searchParams?: Promise<{
    error?: SearchParamValue;
    returnTo?: SearchParamValue;
  }>;
};

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShopLoginPage({ searchParams }: LoginPageProps) {
  const [params, company] = await Promise.all([
    searchParams,
    getContextCompany().catch(() => null),
  ]);
  const storeName = company?.name?.trim() || 'the store';
  const errorCode = firstValue(params?.error);
  const requestedReturnTo = getSafeReturnTo(firstValue(params?.returnTo));
  const error: LoginFeedback = errorCode
    ? ERROR_MESSAGES[errorCode] || {
        message: 'We could not sign you in. Check your details and try again.',
      }
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbBar}>
        <nav className={styles.breadcrumbNav} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/shop">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">My account</li>
          </ol>
        </nav>
      </div>

      <div className={styles.main}>
        <div className={styles.layout}>
          <section className={styles.intro} aria-labelledby="login-page-title">
            <p className={styles.eyebrow}>Your {storeName} account</p>
            <h1 id="login-page-title">Welcome back.</h1>
            <p className={styles.introCopy}>
              Sign in for a clear view of your orders and customer account,
              without entering your credentials every time.
            </p>

            <ul className={styles.benefitList} aria-label="Account benefits">
              <li>
                <span className={styles.benefitIcon}>
                  <History size={19} aria-hidden="true" />
                </span>
                <span>
                  <strong>Order history</strong>
                  <small>Keep every purchase close at hand</small>
                </span>
              </li>
              <li>
                <span className={styles.benefitIcon}>
                  <ShoppingBag size={19} aria-hidden="true" />
                </span>
                <span>
                  <strong>Quick access</strong>
                  <small>Return without re-entering your credentials</small>
                </span>
              </li>
              <li>
                <span className={styles.benefitIcon}>
                  <PackageCheck size={19} aria-hidden="true" />
                </span>
                <span>
                  <strong>One secure place</strong>
                  <small>Manage your storefront profile</small>
                </span>
              </li>
            </ul>

            <div className={styles.trustNote}>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>Your credentials are sent securely to the store’s authentication service.</span>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="login-card-title">
            <div className={styles.cardHeader}>
              <p className={styles.cardKicker}>Customer sign in</p>
              <h2 id="login-card-title">Sign in to your account</h2>
              <p>Enter the email and password associated with your customer account.</p>
            </div>

            <LoginForm
              error={error}
              registerHref={withSafeReturnTo('/shop/register', requestedReturnTo)}
              forgotPasswordHref={withSafeReturnTo('/forgot-password', requestedReturnTo)}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

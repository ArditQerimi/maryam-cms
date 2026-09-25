import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Heart,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getSession } from '@/lib/session';
import { getContextCompany } from '@/lib/tenant';
import { getSafeReturnTo, withSafeReturnTo } from '../login/safe-return-to';
import RegisterForm from './RegisterForm';
import styles from './register.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const storeName = (await getContextCompany().catch(() => null))?.name?.trim() || 'the store';
  return {
    title: 'Create Customer Account',
    description: `Create a ${storeName} customer account to access order history and manage your account.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

type SearchParamValue = string | string[] | undefined;

type RegisterPageProps = {
  searchParams?: Promise<{
    error?: SearchParamValue;
    returnTo?: SearchParamValue;
    success?: SearchParamValue;
  }>;
};

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShopRegisterPage({ searchParams }: RegisterPageProps) {
  const [params, company] = await Promise.all([
    searchParams,
    getContextCompany().catch(() => null),
  ]);
  const storeName = company?.name?.trim() || 'the store';
  const errorCode = firstValue(params?.error);
  const returnTo = getSafeReturnTo(firstValue(params?.returnTo));
  const successRequested = firstValue(params?.success) === 'account-created';
  let accountCreated = false;

  if (successRequested) {
    try {
      const session = await getSession();
      accountCreated = session?.platformRole === 'customer';
    } catch {
      accountCreated = false;
    }
  }

  const loginHref = withSafeReturnTo('/shop/login', returnTo);
  const primarySuccessLabel =
    returnTo === '/customer/orders' ? 'View your orders' : 'Continue shopping';

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbBar}>
        <nav className={styles.breadcrumbNav} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/shop">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Create account</li>
          </ol>
        </nav>
      </div>

      <div className={styles.main}>
        <div className={styles.layout}>
          {accountCreated ? (
            <section className={styles.successCard} aria-labelledby="registration-success-title">
              <span className={styles.successIcon} aria-hidden="true">
                <Check size={30} strokeWidth={2.2} />
              </span>
              <p className={styles.eyebrow}>Account created</p>
              <h1 id="registration-success-title">You&apos;re all set.</h1>
              <p className={styles.successCopy}>
                Your customer account has been created and you are now signed in.
              </p>

              <div className={styles.successActions}>
                <Link className={styles.successPrimary} href={returnTo}>
                  {primarySuccessLabel}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                {returnTo !== '/customer/orders' ? (
                  <Link className={styles.successSecondary} href="/customer/orders">
                    View your orders
                  </Link>
                ) : null}
              </div>

              <p className={styles.successNote}>
                <ShieldCheck size={17} aria-hidden="true" />
                Your session is secured with an HTTP-only cookie.
              </p>
            </section>
          ) : (
            <>
              <section className={styles.intro} aria-labelledby="register-page-title">
                <p className={styles.eyebrow}>Join {storeName}</p>
                <h1 id="register-page-title">A faster way to shop.</h1>
                <p className={styles.introCopy}>
                  Create your customer account for secure access to order history
                  and your account whenever you return to the store.
                </p>

                <ul className={styles.benefitList} aria-label="Shopping account benefits">
                  <li>
                    <span className={styles.benefitIcon}>
                      <Sparkles size={19} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>Quick access</strong>
                      <small>Return to your account in a few steps</small>
                    </span>
                  </li>
                  <li>
                    <span className={styles.benefitIcon}>
                      <PackageCheck size={19} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>Purchase history</strong>
                      <small>Review previous orders in one place</small>
                    </span>
                  </li>
                  <li>
                    <span className={styles.benefitIcon}>
                      <Heart size={19} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>One customer account</strong>
                      <small>Use the same credentials for future visits</small>
                    </span>
                  </li>
                </ul>

                <div className={styles.assuranceNote}>
                  <ShieldCheck size={19} aria-hidden="true" />
                  <span>
                    Your account is created against this store only. Passwords are hashed
                    before they are stored.
                  </span>
                </div>
              </section>

              <section className={styles.card} aria-labelledby="register-card-title">
                <div className={styles.cardHeader}>
                  <p className={styles.cardKicker}>Customer registration</p>
                  <h2 id="register-card-title">Create your account</h2>
                  <p>All fields marked with an asterisk are required.</p>
                </div>

                <RegisterForm
                  initialErrorCode={errorCode}
                  returnTo={returnTo}
                  loginHref={loginHref}
                />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

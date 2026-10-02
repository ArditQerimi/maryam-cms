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
import { getT } from '@/lib/i18n/server';
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
  const [params, company, t] = await Promise.all([
    searchParams,
    getContextCompany().catch(() => null),
    getT(),
  ]);
  const storeName = company?.name?.trim() || t('auth.store.unnamed');
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

  const loginHref = withSafeReturnTo('/home/login', returnTo);
  const primarySuccessLabel =
    returnTo === '/customer/orders'
      ? t('auth.register.success.viewOrders')
      : t('auth.register.success.continue');

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbBar}>
        <nav className={styles.breadcrumbNav} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/home">{t('auth.crumb.home')}</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{t('auth.crumb.createAccount')}</li>
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
              <p className={styles.eyebrow}>{t('auth.register.success.eyebrow')}</p>
              <h1 id="registration-success-title">{t('auth.register.success.title')}</h1>
              <p className={styles.successCopy}>{t('auth.register.success.copy')}</p>

              <div className={styles.successActions}>
                <Link className={styles.successPrimary} href={returnTo}>
                  {primarySuccessLabel}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                {returnTo !== '/customer/orders' ? (
                  <Link className={styles.successSecondary} href="/customer/orders">
                    {t('auth.register.success.viewOrders')}
                  </Link>
                ) : null}
              </div>

              <p className={styles.successNote}>
                <ShieldCheck size={17} aria-hidden="true" />
                {t('auth.register.success.note')}
              </p>
            </section>
          ) : (
            <>
              <section className={styles.intro} aria-labelledby="register-page-title">
                <p className={styles.eyebrow}>
                  {t('auth.register.eyebrow.join', { store: storeName })}
                </p>
                <h1 id="register-page-title">{t('auth.register.title')}</h1>
                <p className={styles.introCopy}>{t('auth.register.intro')}</p>

                <ul className={styles.benefitList} aria-label={t('auth.register.benefits.aria')}>
                  <li>
                    <span className={styles.benefitIcon}>
                      <Sparkles size={19} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{t('auth.register.benefit.quick.title')}</strong>
                      <small>{t('auth.register.benefit.quick.text')}</small>
                    </span>
                  </li>
                  <li>
                    <span className={styles.benefitIcon}>
                      <PackageCheck size={19} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{t('auth.register.benefit.history.title')}</strong>
                      <small>{t('auth.register.benefit.history.text')}</small>
                    </span>
                  </li>
                  <li>
                    <span className={styles.benefitIcon}>
                      <Heart size={19} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{t('auth.register.benefit.account.title')}</strong>
                      <small>{t('auth.register.benefit.account.text')}</small>
                    </span>
                  </li>
                </ul>

                <div className={styles.assuranceNote}>
                  <ShieldCheck size={19} aria-hidden="true" />
                  <span>{t('auth.register.assurance')}</span>
                </div>
              </section>

              <section className={styles.card} aria-labelledby="register-card-title">
                <div className={styles.cardHeader}>
                  <p className={styles.cardKicker}>{t('auth.register.card.kicker')}</p>
                  <h2 id="register-card-title">{t('auth.register.card.title')}</h2>
                  <p>{t('auth.register.card.copy')}</p>
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

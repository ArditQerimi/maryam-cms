import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, MailCheck, TriangleAlert } from 'lucide-react';
import { getContextCompany } from '@/lib/tenant';
import { getT, type Dictionary } from '@/lib/i18n/server';
import { resendVerificationEmail, verifyEmailAddress } from './actions';
import reg from '../register/register.module.css';
import flow from '../components/auth-flow.module.css';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Confirm Your Email',
    description: 'Confirm the email address of your customer account.',
    robots: { index: false, follow: false },
  };
}

type SearchParamValue = string | string[] | undefined;

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    token?: SearchParamValue;
    verified?: SearchParamValue;
    sent?: SearchParamValue;
    error?: SearchParamValue;
  }>;
};

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

// Dictionary keys (not literal copy) so sq and en stay in sync — `t()` below
// resolves them against the active locale. Only the `?error=` code is in the URL.
const ERROR_MESSAGES: Record<string, keyof Dictionary> = {
  invalid: 'auth.verify.error.invalid',
  failed: 'auth.verify.error.failed',
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const [params, company, t] = await Promise.all([
    searchParams,
    getContextCompany().catch(() => null),
    getT(),
  ]);
  const storeName = company?.name?.trim() || t('auth.store.unnamed');
  const token = firstValue(params?.token) || '';
  const verified = firstValue(params?.verified) === '1';
  const sent = firstValue(params?.sent) === '1';
  const errorCode = firstValue(params?.error);
  const errorKey = errorCode ? ERROR_MESSAGES[errorCode] : undefined;
  const errorMessage = errorKey ? t(errorKey) : undefined;
  const hasToken = /^[0-9a-f]{64}$/.test(token);

  return (
    <div className={reg.page}>
      <div className={reg.breadcrumbBar}>
        <nav className={reg.breadcrumbNav} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/home">{t('auth.crumb.home')}</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/home/login">{t('auth.crumb.signIn')}</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{t('auth.crumb.confirmEmail')}</li>
          </ol>
        </nav>
      </div>

      <div className={reg.main}>
        <div className={flow.singleColumn}>
          <div className={flow.column}>
            {verified ? (
              <section className={reg.successCard} aria-labelledby="verify-done-title">
                <span className={reg.successIcon} aria-hidden="true">
                  <BadgeCheck size={30} strokeWidth={2.2} />
                </span>
                <p className={reg.eyebrow}>{t('auth.verify.verified.eyebrow')}</p>
                <h1 id="verify-done-title">{t('auth.verify.verified.title')}</h1>
                <p className={reg.successCopy}>
                  {t('auth.verify.verified.copy', { store: storeName })}
                </p>

                <div className={reg.successActions}>
                  <Link className={reg.successPrimary} href="/home/account">
                    {t('auth.verify.verified.action')}
                  </Link>
                </div>
              </section>
            ) : sent ? (
              <section className={reg.successCard} aria-labelledby="verify-sent-title">
                <span className={reg.successIcon} aria-hidden="true">
                  <MailCheck size={30} strokeWidth={2.2} />
                </span>
                <p className={reg.eyebrow}>{t('auth.verify.sent.eyebrow')}</p>
                <h1 id="verify-sent-title">{t('auth.verify.sent.title')}</h1>
                <p className={reg.successCopy}>{t('auth.verify.sent.copy')}</p>

                <div className={reg.successActions}>
                  <Link className={reg.successPrimary} href="/home/login">
                    {t('auth.verify.sent.action')}
                  </Link>
                </div>
              </section>
            ) : (
              <section className={reg.card} aria-labelledby="verify-title">
                <div className={reg.cardHeader}>
                  <p className={reg.cardKicker}>{t('auth.verify.kicker')}</p>
                  <h1 id="verify-title" className={flow.heading}>
                    {t('auth.verify.title')}
                  </h1>
                  <p>
                    {hasToken
                      ? t('auth.verify.copy.token', { store: storeName })
                      : t('auth.verify.copy.noToken')}
                  </p>
                </div>

                {errorMessage ? (
                  <p className={reg.alert} role="alert">
                    <TriangleAlert size={17} aria-hidden="true" />
                    {errorMessage}
                  </p>
                ) : null}

                {hasToken ? (
                  <form className={reg.form} action={verifyEmailAddress}>
                    <input type="hidden" name="token" value={token} />
                    <button className={reg.submitButton} type="submit">
                      <BadgeCheck size={16} aria-hidden="true" />
                      {t('auth.verify.confirm')}
                    </button>
                  </form>
                ) : null}

                <div className={reg.separator}>{t('auth.verify.resendSeparator')}</div>

                <form className={reg.form} action={resendVerificationEmail}>
                  <div className={reg.field}>
                    <label className={reg.label} htmlFor="verify-email-input">
                      {t('auth.verify.emailLabel')} <span className={reg.required}>*</span>
                    </label>
                    <input
                      className={reg.input}
                      id="verify-email-input"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                    />
                  </div>
                  <button className={reg.submitButton} type="submit">
                    {t('auth.verify.resend')}
                  </button>
                </form>

                <p className={flow.footNote}>
                  {t('auth.verify.footnote.prefix')}{' '}
                  <Link className={flow.textLink} href="/home/login">
                    {t('auth.verify.footnote.link')}
                  </Link>
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { getContextCompany } from '@/lib/tenant';
import { getT } from '@/lib/i18n/server';
import { requestPasswordReset } from './actions';
import reg from '../register/register.module.css';
import flow from '../components/auth-flow.module.css';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Reset Password',
    description: 'Request a link to reset the password of your customer account.',
    robots: { index: false, follow: false },
  };
}

type SearchParamValue = string | string[] | undefined;

type ForgotPasswordPageProps = {
  searchParams?: Promise<{ sent?: SearchParamValue }>;
};

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const [params, company, t] = await Promise.all([
    searchParams,
    getContextCompany().catch(() => null),
    getT(),
  ]);
  const storeName = company?.name?.trim() || t('auth.store.unnamed');
  const sent = firstValue(params?.sent) === '1';

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
            <li aria-current="page">{t('auth.crumb.resetPassword')}</li>
          </ol>
        </nav>
      </div>

      <div className={reg.main}>
        <div className={flow.singleColumn}>
          <div className={flow.column}>
            {sent ? (
              <section className={reg.successCard} aria-labelledby="forgot-sent-title">
                <span className={reg.successIcon} aria-hidden="true">
                  <MailCheck size={30} strokeWidth={2.2} />
                </span>
                <p className={reg.eyebrow}>{t('auth.forgot.success.eyebrow')}</p>
                <h1 id="forgot-sent-title">{t('auth.forgot.success.title')}</h1>
                <p className={reg.successCopy}>{t('auth.forgot.success.copy')}</p>

                <div className={reg.successActions}>
                  <Link className={reg.successPrimary} href="/home/login">
                    {t('auth.forgot.success.back')}
                  </Link>
                </div>
              </section>
            ) : (
              <section className={reg.card} aria-labelledby="forgot-title">
                <div className={reg.cardHeader}>
                  <p className={reg.cardKicker}>{t('auth.forgot.kicker')}</p>
                  <h1 id="forgot-title" className={flow.heading}>
                    {t('auth.forgot.title')}
                  </h1>
                  <p>{t('auth.forgot.copy', { store: storeName })}</p>
                </div>

                <form className={reg.form} action={requestPasswordReset}>
                  <div className={reg.field}>
                    <label className={reg.label} htmlFor="forgot-email">
                      {t('auth.forgot.emailLabel')} <span className={reg.required}>*</span>
                    </label>
                    <input
                      className={reg.input}
                      id="forgot-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                    />
                  </div>
                  <button className={reg.submitButton} type="submit">
                    {t('auth.forgot.submit')}
                  </button>
                </form>

                <p className={flow.footNote}>
                  {t('auth.forgot.footnote.prefix')}{' '}
                  <Link className={flow.textLink} href="/home/login">
                    {t('auth.forgot.footnote.link')}
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

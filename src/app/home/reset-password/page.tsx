import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, TriangleAlert } from 'lucide-react';
import { getContextCompany } from '@/lib/tenant';
import { getT, type Dictionary } from '@/lib/i18n/server';
import { resetPasswordWithToken } from './actions';
import reg from '../register/register.module.css';
import flow from '../components/auth-flow.module.css';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Choose a New Password',
    description: 'Set a new password for your customer account.',
    robots: { index: false, follow: false },
  };
}

type SearchParamValue = string | string[] | undefined;

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: SearchParamValue;
    error?: SearchParamValue;
  }>;
};

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

// Dictionary keys (not literal copy) so sq and en stay in sync — `t()` below
// resolves them against the active locale. Only the `?error=` code is in the URL.
const ERROR_MESSAGES: Record<string, keyof Dictionary> = {
  weak: 'auth.reset.error.weak',
  mismatch: 'auth.reset.error.mismatch',
  invalid: 'auth.reset.error.invalid',
  failed: 'auth.reset.error.failed',
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const [params, company, t] = await Promise.all([
    searchParams,
    getContextCompany().catch(() => null),
    getT(),
  ]);
  const storeName = company?.name?.trim() || t('auth.store.unnamed');
  const token = firstValue(params?.token) || '';
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
            <li aria-current="page">{t('auth.crumb.newPassword')}</li>
          </ol>
        </nav>
      </div>

      <div className={reg.main}>
        <div className={flow.singleColumn}>
          <div className={flow.column}>
            <section className={reg.card} aria-labelledby="reset-title">
              <div className={reg.cardHeader}>
                <p className={reg.cardKicker}>{t('auth.reset.kicker')}</p>
                <h1 id="reset-title" className={flow.heading}>
                  {t('auth.reset.title')}
                </h1>
                <p>
                  {hasToken
                    ? t('auth.reset.copy.token', { store: storeName })
                    : t('auth.reset.copy.noToken')}
                </p>
              </div>

              {errorMessage ? (
                <p className={reg.alert} role="alert">
                  <TriangleAlert size={17} aria-hidden="true" />
                  {errorMessage}
                </p>
              ) : null}

              {hasToken ? (
                <form className={reg.form} action={resetPasswordWithToken}>
                  <input type="hidden" name="token" value={token} />
                  <div className={reg.field}>
                    <label className={reg.label} htmlFor="reset-password">
                      {t('auth.reset.passwordLabel')} <span className={reg.required}>*</span>
                    </label>
                    <input
                      className={reg.input}
                      id="reset-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder={t('auth.reset.passwordPlaceholder')}
                    />
                    <p className={reg.hint}>{t('auth.reset.passwordHint')}</p>
                  </div>
                  <div className={reg.field}>
                    <label className={reg.label} htmlFor="reset-confirm">
                      {t('auth.reset.confirmLabel')} <span className={reg.required}>*</span>
                    </label>
                    <input
                      className={reg.input}
                      id="reset-confirm"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder={t('auth.reset.confirmPlaceholder')}
                    />
                  </div>
                  <button className={reg.submitButton} type="submit">
                    <KeyRound size={16} aria-hidden="true" />
                    {t('auth.reset.submit')}
                  </button>
                </form>
              ) : !errorMessage ? (
                <p className={reg.alert} role="alert">
                  <TriangleAlert size={17} aria-hidden="true" />
                  {t('auth.reset.invalidLink')}
                </p>
              ) : null}

              <p className={flow.footNote}>
                {t('auth.reset.footnote.prefix')}{' '}
                <Link className={flow.textLink} href="/home/forgot-password">
                  {t('auth.reset.footnote.link')}
                </Link>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Suspense } from 'react';
import LoginForm from './LoginForm';
import { getDictionary, getLocale } from '@/lib/i18n/server';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  // The login page sits outside both layout providers — bring its own so the
  // form (and the SQ/EN switcher) follow the shared locale cookie.
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <LocaleProvider locale={locale} dict={dict}>
      <Suspense>
        <LoginForm returnTo={params.returnTo} errorCode={params.error} />
      </Suspense>
    </LocaleProvider>
  );
}

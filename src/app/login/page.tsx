import { Suspense } from 'react';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense>
      <LoginForm returnTo={params.returnTo} errorCode={params.error} />
    </Suspense>
  );
}

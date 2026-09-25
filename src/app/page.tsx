import { redirect } from 'next/navigation';

/**
 * Root route. The proxy already sends anonymous visitors to /login, so this
 * only needs to point authenticated staff at the CMS dashboard.
 */
export default function Home() {
  redirect('/cms/dashboard');
}

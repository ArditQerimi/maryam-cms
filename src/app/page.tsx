import { redirect } from 'next/navigation';

/**
 * Root route. The proxy already sends `/` to the storefront home (/home) for
 * visitors and customers, and to the CMS dashboard for signed-in staff, so
 * this component only acts as a fallback for requests that bypass it.
 */
export default function RootPage() {
  redirect('/home');
}

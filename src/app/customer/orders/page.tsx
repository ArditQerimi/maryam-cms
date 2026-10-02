import { redirect } from 'next/navigation';

/**
 * Legacy customer destination used by login/register/checkout returnTo values
 * and account links. The real screen is the account order history; keeping
 * this route alive prevents 404s from those deep links.
 */
export default function CustomerOrdersRedirect() {
  redirect('/home/account/orders');
}

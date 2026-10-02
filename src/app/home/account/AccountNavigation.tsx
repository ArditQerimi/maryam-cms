'use client';

import Form from 'next/form';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { logoutCustomer } from '@/lib/account/actions';
import { useLocale, type Translator } from '@/lib/i18n/LocaleProvider';
import styles from './account.module.css';

type AccountNavKey = Parameters<Translator>[0];

const ACCOUNT_LINKS = [
  { href: '/home/account', labelKey: 'account.nav.dashboard', exact: true },
  { href: '/home/account/orders', labelKey: 'account.nav.orders', exact: false },
  { href: '/home/account/downloads', labelKey: 'account.nav.downloads', exact: false },
  { href: '/home/account/addresses', labelKey: 'account.nav.addresses', exact: false },
  { href: '/home/account/profile', labelKey: 'account.nav.profile', exact: false },
  { href: '/home/account/compare', labelKey: 'account.nav.compare', exact: false },
  { href: '/home/account/wishlist', labelKey: 'account.nav.wishlist', exact: false },
] satisfies ReadonlyArray<{
  href: string;
  labelKey: AccountNavKey;
  exact: boolean;
}>;

function LogoutSubmit() {
  const { pending } = useFormStatus();
  const { t } = useLocale();

  return (
    <button
      type="submit"
      className={styles.accountNavLink}
      disabled={pending}
      aria-busy={pending}
    >
      <span>{pending ? t('account.nav.signingOut') : t('account.nav.logOut')}</span>
    </button>
  );
}

export default function AccountNavigation() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav className={styles.accountNav} aria-label={t('account.nav.aria')}>
      <ul className={styles.accountNavList}>
        {ACCOUNT_LINKS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={styles.accountNavLink}
                data-active={active || undefined}
                aria-current={active ? 'page' : undefined}
              >
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Form action={logoutCustomer} aria-label={t('account.nav.signOutAria')}>
            <LogoutSubmit />
          </Form>
        </li>
      </ul>
    </nav>
  );
}

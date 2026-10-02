'use client';

import Form from 'next/form';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  PackageSearch,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';
import { logoutCustomer } from '@/lib/account/actions';
import { useLocale, type Translator } from '@/lib/i18n/LocaleProvider';
import styles from './account.module.css';

type AccountNavKey = Parameters<Translator>[0];

const ACCOUNT_LINKS = [
  { href: '/home/account', labelKey: 'account.nav.overview', icon: LayoutDashboard, exact: true },
  { href: '/home/account/orders', labelKey: 'account.nav.orders', icon: PackageSearch, exact: false },
  { href: '/home/account/wishlist', labelKey: 'account.nav.wishlist', icon: Heart, exact: false },
  { href: '/home/account/profile', labelKey: 'account.nav.profile', icon: UserRound, exact: false },
  { href: '/home/account/security', labelKey: 'account.nav.security', icon: ShieldCheck, exact: false },
  { href: '/home/account/addresses', labelKey: 'account.nav.addresses', icon: MapPin, exact: false },
] satisfies ReadonlyArray<{
  href: string;
  labelKey: AccountNavKey;
  icon: typeof LayoutDashboard;
  exact: boolean;
}>;

function LogoutSubmit() {
  const { pending } = useFormStatus();
  const { t } = useLocale();

  return (
    <button
      type="submit"
      className={styles.logoutButton}
      disabled={pending}
      aria-busy={pending}
    >
      <LogOut size={17} aria-hidden="true" />
      <span>{pending ? t('account.nav.signingOut') : t('account.nav.signOut')}</span>
    </button>
  );
}

export default function AccountNavigation({ storeName }: { storeName: string }) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <div className={styles.sidebarCard}>
      <div className={styles.sidebarIdentity}>
        <span className={styles.sidebarMonogram} aria-hidden="true">
          {storeName.trim().slice(0, 1).toLocaleUpperCase()}
        </span>
        <div>
          <span className={styles.sidebarLabel}>{t('account.nav.identityLabel')}</span>
          <strong>{storeName}</strong>
        </div>
      </div>

      <nav className={styles.accountNav} aria-label={t('account.nav.aria')}>
        <ul className={styles.accountNavList}>
          {ACCOUNT_LINKS.map((item) => {
            const Icon = item.icon;
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
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.sidebarActions}>
        <Link href="/home" className={styles.returnLink}>
          <Store size={17} aria-hidden="true" />
          <span>{t('account.nav.returnToStore')}</span>
        </Link>
        <Form action={logoutCustomer} aria-label={t('account.nav.signOutAria')}>
          <LogoutSubmit />
        </Form>
      </div>
    </div>
  );
}

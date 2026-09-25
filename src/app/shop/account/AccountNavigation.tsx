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
import styles from './account.module.css';

const ACCOUNT_LINKS = [
  { href: '/shop/account', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/shop/account/orders', label: 'Orders', icon: PackageSearch, exact: false },
  { href: '/shop/account/wishlist', label: 'Wishlist', icon: Heart, exact: false },
  { href: '/shop/account/profile', label: 'Profile', icon: UserRound, exact: false },
  { href: '/shop/account/security', label: 'Security', icon: ShieldCheck, exact: false },
  { href: '/shop/account/addresses', label: 'Addresses', icon: MapPin, exact: false },
] as const;

function LogoutSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={styles.logoutButton}
      disabled={pending}
      aria-busy={pending}
    >
      <LogOut size={17} aria-hidden="true" />
      <span>{pending ? 'Signing out…' : 'Sign out'}</span>
    </button>
  );
}

export default function AccountNavigation({ storeName }: { storeName: string }) {
  const pathname = usePathname();

  return (
    <div className={styles.sidebarCard}>
      <div className={styles.sidebarIdentity}>
        <span className={styles.sidebarMonogram} aria-hidden="true">
          {storeName.trim().slice(0, 1).toLocaleUpperCase()}
        </span>
        <div>
          <span className={styles.sidebarLabel}>Customer account</span>
          <strong>{storeName}</strong>
        </div>
      </div>

      <nav className={styles.accountNav} aria-label="Customer account">
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
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.sidebarActions}>
        <Link href="/shop" className={styles.returnLink}>
          <Store size={17} aria-hidden="true" />
          <span>Return to store</span>
        </Link>
        <Form action={logoutCustomer} aria-label="Sign out of customer account">
          <LogoutSubmit />
        </Form>
      </div>
    </div>
  );
}

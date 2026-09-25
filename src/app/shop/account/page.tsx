import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Heart,
  KeyRound,
  MapPin,
  PackageSearch,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';
import { requireAccountCustomer } from '@/lib/account/data';
import styles from './account.module.css';

export const metadata: Metadata = {
  title: 'Overview',
  robots: {
    index: false,
    follow: false,
  },
};

function formatMemberSince(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/u)[0] || name;
}

export default async function AccountOverviewPage() {
  const customer = await requireAccountCustomer('/shop/account');
  const firstName = getFirstName(customer.name);

  return (
    <div className={styles.pageStack}>
      <section className={styles.welcomeCard} aria-labelledby="account-welcome-title">
        <div>
          <p className={styles.eyebrow}>Account overview</p>
          <h2 id="account-welcome-title">Good to see you, {firstName}.</h2>
          <p>
            Review your details or continue to the store services already connected to your
            customer session.
          </p>
        </div>
        <div className={styles.welcomeMonogram} aria-hidden="true">
          {getFirstName(customer.name).slice(0, 1).toLocaleUpperCase()}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="account-details-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Your details</p>
            <h2 id="account-details-title">Customer profile</h2>
          </div>
          <Link href="/shop/account/profile" className={styles.textLink}>
            Edit profile <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <dl className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <dt>Name</dt>
            <dd>{customer.name}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Sign-in email</dt>
            <dd>{customer.email}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Phone</dt>
            <dd>{customer.phone || 'Not provided'}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Member since</dt>
            <dd>{formatMemberSince(customer.memberSince)}</dd>
          </div>
        </dl>
        <p className={styles.dataNote}>
          The current sign-in flow does not record verified-email state, so this address is not
          labelled as verified.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="account-services-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Account services</p>
            <h2 id="account-services-title">Where would you like to go?</h2>
          </div>
        </div>

        <div className={styles.serviceGrid}>
          <article className={styles.serviceCard}>
            <span className={styles.serviceIcon} aria-hidden="true"><PackageSearch size={21} /></span>
            <div>
              <h3>Orders</h3>
              <p>Open the existing order-history screen for this store.</p>
            </div>
            <Link href="/shop/account/orders" className={styles.cardLink}>
              View order account <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>

          <article className={styles.serviceCard}>
            <span className={styles.serviceIcon} aria-hidden="true"><Heart size={21} /></span>
            <div>
              <h3>Wishlist</h3>
              <p>Return to products saved by the current wishlist experience.</p>
            </div>
            <Link href="/shop/account/wishlist" className={styles.cardLink}>
              Open wishlist <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>

          <article className={styles.serviceCard}>
            <span className={styles.serviceIcon} aria-hidden="true"><UserRound size={21} /></span>
            <div>
              <h3>Profile</h3>
              <p>Update the name and phone number attached to this customer account.</p>
            </div>
            <Link href="/shop/account/profile" className={styles.cardLink}>
              Edit profile <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>

          <article className={styles.serviceCard}>
            <span className={styles.serviceIcon} aria-hidden="true"><ShieldCheck size={21} /></span>
            <div>
              <h3>Security</h3>
              <p>Change your password with current-password verification.</p>
            </div>
            <Link href="/shop/account/security" className={styles.cardLink}>
              Open security <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>

          <article className={styles.serviceCard} data-state="unavailable">
            <span className={styles.serviceIcon} aria-hidden="true"><MapPin size={21} /></span>
            <div>
              <h3>Addresses</h3>
              <p>Address persistence is not connected yet, so no saved address is shown.</p>
            </div>
            <Link href="/shop/account/addresses" className={styles.cardLink}>
              See availability <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>

          <article className={styles.serviceCard}>
            <span className={styles.serviceIcon} aria-hidden="true"><Store size={21} /></span>
            <div>
              <h3>Store</h3>
              <p>Continue browsing the catalog without leaving your account area.</p>
            </div>
            <Link href="/shop" className={styles.cardLink}>
              Return to store <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      <aside className={styles.securityBanner} aria-label="Account security reminder">
        <KeyRound size={20} aria-hidden="true" />
        <div>
          <strong>Keep sign-in details private</strong>
          <p>Use the sign-out control in account navigation when you finish on a shared device.</p>
        </div>
      </aside>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { headers } from 'next/headers';
import {
  getStorefrontOrderConfirmation,
  requestForOrderConfirmation,
  type StorefrontOrderConfirmation,
} from '@/lib/storefront/checkout-order-confirmation';
import { formatPersistedCheckoutMoney } from '@/lib/storefront/checkout-money';
import styles from './order-confirmation.module.css';

export const metadata: Metadata = {
  title: 'Order confirmation',
  description: 'Protected storefront order confirmation.',
  robots: {
    index: false,
    follow: false,
  },
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
  }).format(value);
}

function formatCapability(value: string) {
  return value.replace(/_/g, ' ');
}

async function ConfirmationUnavailable() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/home">Home</Link>
            <span>/</span>
            <span>Checkout</span>
          </nav>
          <h1 className={styles.title}>Checkout</h1>
        </header>
        <div className={styles.noticeCard}>
          <p>There was a problem loading your order confirmation.</p>
          <Link href="/home/checkout" className={styles.primaryLink}>Return to checkout</Link>
        </div>
      </div>
    </div>
  );
}

async function ConfirmationDetails({ order }: { order: StorefrontOrderConfirmation }) {
  const lineItems = [
    { name: 'Bob golf book', qty: 1, total: 103 },
    { name: 'Luna and friend', qty: 1, total: 90 },
  ];
  const subtotal = 193;
  const shipping = 'Flat rate';
  const paymentMethod = formatCapability(order.paymentMethodId);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/home">Home</Link>
            <span>/</span>
            <span>Checkout</span>
          </nav>
          <h1 className={styles.title}>Checkout</h1>
        </header>

        <div className={styles.confirmationWrap}>
          <p className={styles.successText}>Thank you. Your order has been received.</p>

          <dl className={styles.metaGrid}>
            <div>
              <dt>Order number:</dt>
              <dd>{order.orderNumber}</dd>
            </div>
            <div>
              <dt>Date:</dt>
              <dd>{formatDate(order.createdAt)}</dd>
            </div>
            <div>
              <dt>Email:</dt>
              <dd>{order.contactEmail}</dd>
            </div>
            <div>
              <dt>Total:</dt>
              <dd>{formatPersistedCheckoutMoney(order.total, order.currency)}</dd>
            </div>
            <div>
              <dt>Payment method:</dt>
              <dd>{paymentMethod}</dd>
            </div>
          </dl>

          <p className={styles.payInfo}>Pay with cash upon delivery.</p>

          <section className={styles.orderSummary} aria-labelledby="order-details-title">
            <h2 id="order-details-title">Order details</h2>
            <div className={styles.summaryTable}>
              <div className={styles.summaryHead}>
                <span>Product</span>
                <span>Total</span>
              </div>

              {lineItems.map((item) => (
                <div key={item.name} className={styles.summaryRow}>
                  <span>{item.name} × {item.qty}</span>
                  <span>{formatPersistedCheckoutMoney(String(item.total), order.currency)}</span>
                </div>
              ))}

              <div className={styles.summaryRow}>
                <span>Subtotal:</span>
                <span>{formatPersistedCheckoutMoney(String(subtotal), order.currency)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Shipping:</span>
                <span>{shipping}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Payment method:</span>
                <span>{paymentMethod}</span>
              </div>
              <div className={styles.summaryRowTotal}>
                <span>Total:</span>
                <span>{formatPersistedCheckoutMoney(order.total, order.currency)}</span>
              </div>
            </div>
          </section>

          <div className={styles.addressGrid}>
            <section className={styles.addressCard}>
              <h3>Billing address</h3>
              <div className={styles.addressBody}>
                <p>ardit qerimi</p>
                <p>Kosova</p>
                <p>Kosova, CA 10000</p>
                <p>049494949</p>
                <p>admin@arditi.com</p>
              </div>
            </section>

            <section className={styles.addressCard}>
              <h3>Shipping address</h3>
              <div className={styles.addressBody}>
                <p>ardit qerimi</p>
                <p>Kosova</p>
                <p>Kosova, CA 10000</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function StorefrontOrderConfirmationPage() {
  await connection();
  const requestHeaders = await headers();
  const request = requestForOrderConfirmation(requestHeaders);
  let order: StorefrontOrderConfirmation | null = null;

  if (request) {
    try {
      order = await getStorefrontOrderConfirmation(request);
    } catch {
      order = null;
    }
  }

  return order ? <ConfirmationDetails order={order} /> : <ConfirmationUnavailable />;
}

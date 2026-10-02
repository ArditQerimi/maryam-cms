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
    timeStyle: 'short',
  }).format(value);
}

function formatCapability(value: string) {
  return value.replace(/_/g, ' ');
}

function ConfirmationUnavailable() {
  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="confirmation-unavailable-title">
        <p className={styles.eyebrow}>Order confirmation</p>
        <h1 id="confirmation-unavailable-title">Confirmation unavailable</h1>
        <p>
          This confirmation is unavailable, expired, or belongs to a different session.
          No order details can be shown without the original authenticated purchaser or
          guest order capability.
        </p>
        <Link className={styles.primaryLink} href="/shop/checkout">
          Return to checkout
        </Link>
      </section>
    </div>
  );
}

function GuestCapabilityNotice() {
  return (
    <p className={styles.notice}>
      This private confirmation is available only while the host-only confirmation
      capability remains valid on this device.
    </p>
  );
}

function ConfirmationDetails({ order }: { order: StorefrontOrderConfirmation }) {
  const orderHistoryLink = order.access === 'customer'
    ? (
        <Link className={styles.primaryLink} href="/shop/account/orders">
          View order history
        </Link>
      )
    : null;

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="confirmation-title">
        <p className={styles.eyebrow}>Order received</p>
        <h1 id="confirmation-title">Thank you for your order</h1>
        <p className={styles.lead}>
          A confirmed order is recorded. Keep the order reference for merchant support.
        </p>

        <dl className={styles.details}>
          <div>
            <dt>Order reference</dt>
            <dd>{order.orderNumber}</dd>
          </div>
          <div>
            <dt>Confirmation email</dt>
            <dd>{order.contactEmail}</dd>
          </div>
          <div>
            <dt>Placed</dt>
            <dd>{formatDate(order.createdAt)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{order.status}</dd>
          </div>
          <div>
            <dt>Order total</dt>
            <dd>{formatPersistedCheckoutMoney(order.total, order.currency)}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{order.currency}</dd>
          </div>
          <div>
            <dt>Delivery method</dt>
            <dd>{formatCapability(order.deliveryMethodId)}</dd>
          </div>
          <div>
            <dt>Payment method</dt>
            <dd>{formatCapability(order.paymentMethodId)}</dd>
          </div>
        </dl>

        {order.access === 'guest' ? <GuestCapabilityNotice /> : null}

        <div className={styles.actions}>
          {orderHistoryLink}
          <Link className={styles.secondaryLink} href="/shop/products">
            Continue shopping
          </Link>
        </div>
      </section>
    </div>
  );
}

export default async function StorefrontOrderConfirmationPage() {
  // Next.js 16 uses connection() for request-time, non-cacheable rendering.
  // The resulting dynamic response receives private/no-store cache headers.
  await connection();
  const requestHeaders = await headers();
  const request = requestForOrderConfirmation(requestHeaders);
  let order: StorefrontOrderConfirmation | null = null;

  if (request) {
    try {
      order = await getStorefrontOrderConfirmation(request);
    } catch (error) {
      // Host/session/database failures intentionally reveal no order details.
      const diagnosticCode = (error as { code?: unknown } | null)?.code;
      console.error('[Storefront order confirmation] Request failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        code: typeof diagnosticCode === 'string' ? diagnosticCode : undefined,
      });
    }
  }

  return order ? <ConfirmationDetails order={order} /> : <ConfirmationUnavailable />;
}

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
import { addressLines } from '@/lib/account/addresses';
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
  const paymentMethod = formatCapability(order.paymentMethodId);
  const money = (value: string | number) => formatPersistedCheckoutMoney(String(value), order.currency);
  // Shipping is what remains of the grand total after merchandise, coupon and tax.
  const shippingCost =
    Number(order.total) - Number(order.subtotal) + Number(order.discount) - Number(order.tax);
  const billing = addressLines(order.billingAddress);
  const shipping = addressLines(order.shippingAddress);

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
              <dd>{money(order.total)}</dd>
            </div>
            <div>
              <dt>Payment method:</dt>
              <dd>{paymentMethod}</dd>
            </div>
          </dl>

          {order.paymentMethodId === 'cash_on_delivery' ? (
            <p className={styles.payInfo}>Pay with cash upon delivery.</p>
          ) : null}

          <section className={styles.orderSummary} aria-labelledby="order-details-title">
            <h2 id="order-details-title">Order details</h2>
            <div className={styles.summaryTable}>
              <div className={styles.summaryHead}>
                <span>Product</span>
                <span>Total</span>
              </div>

              {order.lines.map((line, index) => (
                <div key={`${line.name}-${index}`} className={styles.summaryRow}>
                  <span>
                    {line.name}
                    {line.variant ? ` — ${line.variant}` : ''} × {line.quantity}
                  </span>
                  <span>{money(line.total)}</span>
                </div>
              ))}

              <div className={styles.summaryRow}>
                <span>Subtotal:</span>
                <span>{money(order.subtotal)}</span>
              </div>
              {Number(order.discount) > 0 ? (
                <div className={styles.summaryRow}>
                  <span>Discount:</span>
                  <span>-{money(order.discount)}</span>
                </div>
              ) : null}
              <div className={styles.summaryRow}>
                <span>Shipping:</span>
                <span>
                  {formatCapability(order.deliveryMethodId)}
                  {shippingCost > 0.004 ? ` (${money(shippingCost.toFixed(2))})` : ''}
                </span>
              </div>
              {Number(order.tax) > 0 ? (
                <div className={styles.summaryRow}>
                  <span>Tax:</span>
                  <span>{money(order.tax)}</span>
                </div>
              ) : null}
              <div className={styles.summaryRow}>
                <span>Payment method:</span>
                <span>{paymentMethod}</span>
              </div>
              <div className={styles.summaryRowTotal}>
                <span>Total:</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
          </section>

          <div className={styles.addressGrid}>
            <section className={styles.addressCard}>
              <h3>Billing address</h3>
              <div className={styles.addressBody}>
                {billing.map((line, index) => (
                  <p key={`b-${index}`}>{line}</p>
                ))}
                {order.contactPhone ? <p>{order.contactPhone}</p> : null}
                <p>{order.contactEmail}</p>
              </div>
            </section>

            <section className={styles.addressCard}>
              <h3>Shipping address</h3>
              <div className={styles.addressBody}>
                {shipping.map((line, index) => (
                  <p key={`s-${index}`}>{line}</p>
                ))}
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

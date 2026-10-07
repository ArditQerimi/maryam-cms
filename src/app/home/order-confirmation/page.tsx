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
import AutoRefresh from './AutoRefresh';
import { getT } from '@/lib/i18n/server';
import { getContextDb } from '@/lib/tenant';
import { orderPhases, type OrderPhase } from '@/lib/storefront/order-status';
import styles from './order-confirmation.module.css';

export const metadata: Metadata = {
  title: 'Order confirmation',
  description: 'Protected storefront order confirmation.',
  robots: {
    index: false,
    follow: false,
  },
};

function formatDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === 'sq' ? 'sq-AL' : 'en-GB', {
    dateStyle: 'long',
  }).format(value);
}

function formatCapability(value: string) {
  return value.replace(/_/g, ' ');
}

/** The five steps of an online order; how many are done for each phase. */
const STEP_KEYS = ['stepPlaced', 'stepConfirmed', 'stepPreparing', 'stepShipped', 'stepCompleted'] as const;
const STEPS_DONE: Record<OrderPhase, number> = {
  awaiting: 1,
  confirmed: 2,
  preparing: 3,
  shipped: 4,
  completed: 5,
  cancelled: 1,
  other: 1,
};

async function ConfirmationUnavailable() {
  const t = await getT();
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/home">{t('account.orderConfirm.home')}</Link>
            <span>/</span>
            <span>{t('account.orderConfirm.pageTitle')}</span>
          </nav>
          <h1 className={styles.title}>{t('account.orderConfirm.pageTitle')}</h1>
        </header>
        <div className={styles.noticeCard}>
          <p>{t('account.orderConfirm.unavailable')}</p>
          <Link href="/home/account/orders" className={styles.primaryLink}>
            {t('account.orderConfirm.viewOrders')}
          </Link>
        </div>
      </div>
    </div>
  );
}

async function ConfirmationDetails({
  order,
  phase,
}: {
  order: StorefrontOrderConfirmation;
  phase: OrderPhase;
}) {
  const t = await getT();
  const locale = String(t('account.orderConfirm.locale'));
  const paymentMethod = formatCapability(order.paymentMethodId);
  const money = (value: string | number) => formatPersistedCheckoutMoney(String(value), order.currency);
  // Shipping is what remains of the grand total after merchandise, coupon and tax.
  const shippingCost =
    Number(order.total) - Number(order.subtotal) + Number(order.discount) - Number(order.tax);
  const billing = addressLines(order.billingAddress);
  const shipping = addressLines(order.shippingAddress);
  const cancelled = phase === 'cancelled';
  const done = STEPS_DONE[phase];
  const open = phase !== 'other' && phase !== 'completed' && phase !== 'cancelled';
  const phaseKey = phase === 'other' ? 'awaiting' : phase;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/home">{t('account.orderConfirm.home')}</Link>
            <span>/</span>
            <span>{t('account.orderConfirm.pageTitle')}</span>
          </nav>
          <h1 className={styles.title}>{t('account.orderConfirm.pageTitle')}</h1>
        </header>

        <div className={styles.confirmationWrap}>
          <section className={styles.statusCard} aria-live="polite">
            <p className={styles.statusEyebrow}>
              {t('account.orderConfirm.status')} {t(`account.orderPhase.${phaseKey}`)}
            </p>
            <h2 className={styles.statusTitle}>{t(`account.orderConfirm.${phaseKey}Title`)}</h2>
            <p className={styles.statusLead}>{t(`account.orderConfirm.${phaseKey}Lead`)}</p>

            <ol className={styles.steps} aria-label={t('account.orderConfirm.stepsLabel')}>
              {(cancelled ? (['stepPlaced', 'stepCancelled'] as const) : STEP_KEYS).map((key, index) => {
                const state = cancelled
                  ? index === 0
                    ? 'done'
                    : 'current'
                  : index < done
                    ? 'done'
                    : index === done
                      ? 'current'
                      : 'todo';
                return (
                  <li key={key} className={`${styles.step} ${styles[`step_${state}`]}`}>
                    <span className={styles.stepDot} aria-hidden="true">
                      {state === 'done' ? '✓' : state === 'current' ? '•' : ''}
                    </span>
                    <span className={styles.stepLabel}>{t(`account.orderConfirm.${key}`)}</span>
                  </li>
                );
              })}
            </ol>

            {open ? <p className={styles.statusNote}>{t('account.orderConfirm.refreshNote')}</p> : null}
            {open ? <AutoRefresh /> : null}
          </section>

          <dl className={styles.metaGrid}>
            <div>
              <dt>{t('account.orderConfirm.orderNumber')}</dt>
              <dd>{order.orderNumber}</dd>
            </div>
            <div>
              <dt>{t('account.orderConfirm.date')}</dt>
              <dd>{formatDate(order.createdAt, locale)}</dd>
            </div>
            <div>
              <dt>{t('account.orderConfirm.email')}</dt>
              <dd>{order.contactEmail}</dd>
            </div>
            <div>
              <dt>{t('account.orderConfirm.total')}</dt>
              <dd>{money(order.total)}</dd>
            </div>
            <div>
              <dt>{t('account.orderConfirm.paymentMethod')}</dt>
              <dd>{order.paymentMethodId === 'cash_on_delivery' ? t('account.orderConfirm.payOnDelivery') : paymentMethod}</dd>
            </div>
          </dl>

          <section className={styles.orderSummary} aria-labelledby="order-details-title">
            <h2 id="order-details-title">{t('account.orderConfirm.orderDetails')}</h2>
            <div className={styles.summaryTable}>
              <div className={styles.summaryHead}>
                <span>{t('account.orderConfirm.product')}</span>
                <span>{t('account.orderConfirm.total')}</span>
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
                <span>{t('account.orderConfirm.subtotal')}</span>
                <span>{money(order.subtotal)}</span>
              </div>
              {Number(order.discount) > 0 ? (
                <div className={styles.summaryRow}>
                  <span>{t('account.orderConfirm.discount')}</span>
                  <span>-{money(order.discount)}</span>
                </div>
              ) : null}
              <div className={styles.summaryRow}>
                <span>{t('account.orderConfirm.shipping')}</span>
                <span>
                  {formatCapability(order.deliveryMethodId)}
                  {shippingCost > 0.004 ? ` (${money(shippingCost.toFixed(2))})` : ''}
                </span>
              </div>
              {Number(order.tax) > 0 ? (
                <div className={styles.summaryRow}>
                  <span>{t('account.orderConfirm.tax')}</span>
                  <span>{money(order.tax)}</span>
                </div>
              ) : null}
              <div className={styles.summaryRowTotal}>
                <span>{t('account.orderConfirm.total')}</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
          </section>

          <div className={styles.addressGrid}>
            <section className={styles.addressCard}>
              <h3>{t('account.orderConfirm.billingAddress')}</h3>
              <div className={styles.addressBody}>
                {billing.map((line, index) => (
                  <p key={`b-${index}`}>{line}</p>
                ))}
                {order.contactPhone ? <p>{order.contactPhone}</p> : null}
                <p>{order.contactEmail}</p>
              </div>
            </section>

            <section className={styles.addressCard}>
              <h3>{t('account.orderConfirm.shippingAddress')}</h3>
              <div className={styles.addressBody}>
                {shipping.map((line, index) => (
                  <p key={`s-${index}`}>{line}</p>
                ))}
              </div>
            </section>
          </div>

          <div className={styles.actions}>
            <Link href="/home/account/orders" className={styles.primaryLink}>
              {t('account.orderConfirm.viewOrders')}
            </Link>
            <Link href="/home/products" className={styles.secondaryLink}>
              {t('account.orderConfirm.continueShopping')}
            </Link>
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

  if (!order) return <ConfirmationUnavailable />;

  const db = await getContextDb();
  const phase =
    (await orderPhases(db, [{ id: Number(order.orderId), status: order.status }])).get(Number(order.orderId)) ??
    'other';
  return <ConfirmationDetails order={order} phase={phase} />;
}

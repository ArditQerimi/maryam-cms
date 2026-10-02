import type { Metadata } from 'next';
import Link from 'next/link';
import { getContextCompany } from '@/lib/tenant';
import styles from '../legal/legal.module.css';
import PrintButton from './PrintButton';

const LAST_UPDATED = 'September 23, 2026';
const LAST_UPDATED_ISO = '2026-09-23';

const description =
  'Learn how orders are processed, where they can be delivered, how delivery charges are calculated, and what happens if a parcel is delayed, lost, or damaged.';

export const metadata: Metadata = {
  title: 'Shipping Policy',
  description,
  alternates: {
    canonical: '/shop/shipping-policy',
  },
  openGraph: {
    title: 'Shipping Policy',
    description,
    url: '/shop/shipping-policy',
    type: 'website',
  },
};

const policyLinks = [
  { href: '/shop/terms-conditions', label: 'Terms & Conditions' },
  { href: '/shop/privacy-policy', label: 'Privacy Policy' },
  { href: '/shop/refund-policy', label: 'Refund Policy' },
  { href: '/shop/shipping-policy', label: 'Shipping Policy' },
];

const tableOfContents = [
  { href: '#merchant-details', label: 'Merchant details' },
  { href: '#scope', label: 'Scope' },
  { href: '#processing', label: 'Order processing' },
  { href: '#destinations', label: 'Delivery destinations' },
  { href: '#rates', label: 'Delivery charges' },
  { href: '#carriers', label: 'Carriers and tracking' },
  { href: '#estimates', label: 'Delivery estimates and delays' },
  { href: '#addresses', label: 'Delivery addresses' },
  { href: '#international', label: 'International delivery' },
  { href: '#lost-damaged', label: 'Lost or damaged parcels' },
  { href: '#contact', label: 'Contact' },
];

async function getMerchantName() {
  try {
    const company = await getContextCompany();
    const companyName = company.name.trim();

    if (companyName) {
      return companyName;
    }
  } catch {
    return process.env.NEXT_PUBLIC_STOREFRONT_NAME?.trim() || 'this store';
  }

  return process.env.NEXT_PUBLIC_STOREFRONT_NAME?.trim() || 'this store';
}

export default async function ShippingPolicyPage() {
  const merchantName = await getMerchantName();
  const legalEntityName = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim();
  const registeredAddress = process.env.NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS?.trim();
  const contactEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();
  const processingTime = process.env.NEXT_PUBLIC_ORDER_PROCESSING_TIME?.trim();
  const dispatchTime = process.env.NEXT_PUBLIC_DISPATCH_TIME?.trim();
  const shippingOrigin = process.env.NEXT_PUBLIC_SHIPPING_ORIGIN?.trim();
  const shippingDestinations = process.env.NEXT_PUBLIC_SHIPPING_DESTINATIONS?.trim();
  const carriers = process.env.NEXT_PUBLIC_SHIPPING_CARRIERS?.trim();
  const internationalTerms = process.env.NEXT_PUBLIC_INTERNATIONAL_DELIVERY_TERMS?.trim();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <a className={styles.skipLink} href="#policy-content">Skip to policy content</a>

        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol className={styles.breadcrumbList}>
            <li><Link className={styles.breadcrumbLink} href="/shop">Home</Link></li>
            <li aria-current="page">Shipping Policy</li>
          </ol>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroMark} aria-hidden="true">
            <svg className={styles.heroIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h11v11H3z" />
              <path d="M14 10h4l3 3v4h-7z" />
              <circle cx="7" cy="19" r="2" />
              <circle cx="18" cy="19" r="2" />
            </svg>
          </div>
          <p className={styles.eyebrow}>Order fulfilment</p>
          <h1 className={styles.heroTitle} id="shipping-title">Shipping Policy</h1>
          <p className={styles.lede}>
            How orders from {merchantName} are prepared, charged for delivery, dispatched, and supported.
          </p>
          <div className={styles.heroMeta}>
            <span className={styles.lastUpdated}>Last updated <time dateTime={LAST_UPDATED_ISO}>{LAST_UPDATED}</time></span>
            <PrintButton />
          </div>
        </header>

        <nav className={styles.policyNav} aria-label="Store policies">
          <p className={styles.policyNavLabel} id="policy-navigation-label">Policies and practical information</p>
          <ul className={styles.policyNavList} aria-labelledby="policy-navigation-label">
            {policyLinks.map((policy) => {
              const isCurrent = policy.href === '/shop/shipping-policy';

              return (
                <li key={policy.href}>
                  <Link
                    className={`${styles.policyNavLink} ${isCurrent ? styles.currentPolicy : ''}`}
                    href={policy.href}
                    aria-current={isCurrent ? 'page' : undefined}
                  >
                    {policy.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <details className={styles.mobileToc}>
          <summary className={styles.mobileTocSummary}>On this page</summary>
          <nav aria-label="On this page">
            <ol className={styles.mobileTocList}>
              {tableOfContents.map((item) => (
                <li key={item.href}><a href={item.href}>{item.label}</a></li>
              ))}
            </ol>
          </nav>
        </details>

        <div className={styles.layout}>
          <nav className={styles.toc} aria-label="On this page">
            <p className={styles.tocTitle}>On this page</p>
            <ol className={styles.tocList}>
              {tableOfContents.map((item) => (
                <li key={item.href}><a className={styles.tocLink} href={item.href}>{item.label}</a></li>
              ))}
            </ol>
          </nav>

          <article className={styles.content} id="policy-content" aria-labelledby="shipping-title">
            <aside className={styles.reviewNotice} role="note">
              <strong className={styles.noticeTitle}>Merchant and carrier confirmation required</strong>
              No processing time, destination, carrier, rate, or customs promise is treated as final until operations confirms it. Bracketed items must be replaced with verified, customer-facing terms before publication.
            </aside>

            <section className={styles.merchantCard} id="merchant-details" aria-labelledby="merchant-details-title">
              <h2 id="merchant-details-title">Merchant and dispatch details</h2>
              <dl className={styles.merchantGrid}>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Store display name</dt>
                  <dd className={styles.merchantValue}>{merchantName}</dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Legal entity</dt>
                  <dd className={styles.merchantValue}>
                    {legalEntityName || <span className={styles.placeholder}>[registered legal entity name to be confirmed]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Shipping origin</dt>
                  <dd className={styles.merchantValue}>
                    {shippingOrigin || <span className={styles.placeholder}>[actual dispatch location or locations to be added]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Shipping contact</dt>
                  <dd className={styles.merchantValue}>
                    {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : <span className={styles.placeholder}>[monitored shipping contact email to be added]</span>}
                  </dd>
                </div>
              </dl>
            </section>

            <div className={styles.prose}>
              <section className={styles.section} id="scope" aria-labelledby="scope-title">
                <h2 id="scope-title">1. Scope</h2>
                <p>
                  This Shipping Policy applies to physical products purchased through this storefront. Digital products, services, gift cards, or made-to-order items may have different fulfilment terms that must be shown on their product page or accepted order. Any more specific delivery commitment displayed for an order takes priority over this general policy.
                </p>
                <p>
                  Shipping is part of the purchase terms. If delivery is unavailable for a product, destination, or date, that must be clear before the order is placed. Terms about returns after delivery are in the <Link href="/shop/refund-policy">Refund Policy</Link>.
                </p>
              </section>

              <section className={styles.section} id="processing" aria-labelledby="processing-title">
                <h2 id="processing-title">2. Order processing and dispatch</h2>
                <p>
                  Processing begins after the order is accepted and any required payment or verification is complete. Processing time is separate from carrier transit time and may vary by product, order size, stock location, verification, weekends, public holidays, or other operational factors.
                </p>
                {processingTime ? (
                  <p><strong>Processing time:</strong> {processingTime}</p>
                ) : (
                  <p><span className={styles.placeholder}>[insert the verified standard processing time and when the clock begins]</span></p>
                )}
                {dispatchTime ? (
                  <p><strong>Dispatch:</strong> {dispatchTime}</p>
                ) : (
                  <p><span className={styles.placeholder}>[state whether dispatch means leaving the warehouse, receiving a carrier scan, or another verified event]</span></p>
                )}
                {registeredAddress && <p><strong>Registered business address:</strong> {registeredAddress}</p>}
                <p>
                  An order may be shipped in more than one parcel and products may come from more than one stock location. <span className={styles.placeholder}>[confirm split-shipment handling and any charges before promising combined delivery]</span>
                </p>
              </section>

              <section className={styles.section} id="destinations" aria-labelledby="destinations-title">
                <h2 id="destinations-title">3. Delivery destinations and restrictions</h2>
                {shippingDestinations ? (
                  <p>{shippingDestinations}</p>
                ) : (
                  <p><span className={styles.placeholder}>[list every supported destination by country and region, and any excluded territories]</span></p>
                )}
                <p>
                  A delivery option shown at checkout is limited to the address, postcode, product, order value, and quantity accepted for that option. The store may decline an unsupported address before dispatch and refund any amount that can lawfully be returned, less only charges that were clearly attributable to the rejected fulfilment.
                </p>
                <p><span className={styles.placeholder}>[confirm any PO-box, locker, military, island, remote-area, or forwarding-address restrictions only if they apply]</span></p>
              </section>

              <section className={styles.section} id="rates" aria-labelledby="rates-title">
                <h2 id="rates-title">4. Delivery charges and availability</h2>
                <p>
                  The delivery method, price, currency, estimated timing, and any free-delivery threshold must be displayed before an order is submitted. Unless checkout expressly says otherwise, charges are calculated once for the destination and basket shown in the order summary.
                </p>
                <p>
                  Delivery charges may differ for remote or restricted areas, oversized products, multiple parcels, or other special handling. Any surcharge must be disclosed before acceptance. Taxes, customs charges, and merchant-collected fees are addressed in the international section where relevant.
                </p>
                <p><span className={styles.placeholder}>[insert any actual free-delivery threshold, excluded delivery types, and surcharge rules; do not carry over legacy promotional claims]</span></p>
              </section>

              <section className={styles.section} id="carriers" aria-labelledby="carriers-title">
                <h2 id="carriers-title">5. Carriers, service levels and tracking</h2>
                <p>
                  Orders may be handed to one or more delivery partners. The carrier and service level shown for an order are part of the delivery choice; the merchant may substitute a reasonably equivalent service where necessary, subject to applicable law and any material price difference.
                </p>
                {carriers ? (
                  <p><strong>Carriers or service types:</strong> {carriers}</p>
                ) : (
                  <p><span className={styles.placeholder}>[identify the actual carriers, service levels, and handover process for each destination]</span></p>
                )}
                <p>
                  Tracking is provided when the carrier makes event data available. A tracking number confirms carrier handling and is not, by itself, proof of delivery. Some carrier scans may be delayed, incomplete, or show an earlier scan location than expected.
                </p>
              </section>

              <section className={styles.section} id="estimates" aria-labelledby="estimates-title">
                <h2 id="estimates-title">6. Delivery estimates and delays</h2>
                <p>
                  Any estimated delivery window is a forecast based on information available at checkout. It is not a guarantee unless the accepted order expressly says so. Weather, operational disruption, customs review, address issues, carrier capacity, and events outside reasonable control can delay delivery.
                </p>
                <p>
                  If an expected date has passed, check the tracking information and contact the merchant or carrier. No fixed investigation deadline is stated until the merchant has approved a support process. The store is not responsible for a carrier’s delay to the extent the carrier caused it, but consumer rights and any express delivery commitment still apply.
                </p>
                <div className={styles.callout}>
                  <p>
                    <strong>Operations input required:</strong> <span className={styles.placeholder}>[add an approved delay-reporting and lost-parcel investigation process, with truthful service-level expectations]</span>
                  </p>
                </div>
              </section>

              <section className={styles.section} id="addresses" aria-labelledby="addresses-title">
                <h2 id="addresses-title">7. Delivery addresses and customer responsibility</h2>
                <p>
                  You are responsible for entering a complete and accurate delivery address, including the recipient name, street, building or unit details, locality, postcode, country, and telephone number where requested. Check the address before submitting the order and promptly report a mistake.
                </p>
                <p>
                  If an incorrect address is supplied, the store may be unable to deliver or may need to arrange redelivery, return, or correction. Any additional charge or refund consequence must follow the carrier’s actual costs and applicable law. A successful delivery to the address supplied does not automatically eliminate the merchant’s responsibility for its own dispatch error.
                </p>
              </section>

              <section className={styles.section} id="international" aria-labelledby="international-title">
                <h2 id="international-title">8. International delivery, duties and taxes</h2>
                {internationalTerms ? (
                  <p>{internationalTerms}</p>
                ) : (
                  <p><span className={styles.placeholder}>[state whether international orders are accepted, which duties and taxes are prepaid or payable on arrival, and the responsible party]</span></p>
                )}
                <p>
                  Import duties, taxes, customs clearances, brokerage fees, and restrictions may apply to cross-border orders. The checkout and order confirmation must identify which charges are collected by {merchantName} and which may be payable to a carrier, customs authority, or other authority.
                </p>
                <p>
                  If a parcel is delayed, returned, or cannot be cleared because of incomplete information, avoidable refusal, or charges not accepted, any refund or loss allocation must be handled under the applicable law and the terms shown before dispatch. <span className={styles.placeholder}>[insert the merchant’s verified customs and refused-parcel procedure]</span>
                </p>
              </section>

              <section className={styles.section} id="lost-damaged" aria-labelledby="lost-damaged-title">
                <h2 id="lost-damaged-title">9. Lost, delayed or damaged parcels</h2>
                <p>
                  If tracking has not updated for a concerning period, the parcel is marked delivered but not received, or the outer packaging is visibly damaged, contact us promptly with the order number, tracking details, and relevant photographs. If the outer box is intact but damage is found later, photograph the product and packaging before use where reasonably safe.
                </p>
                <p>
                  The merchant may ask the carrier to investigate, open a trace, replace, refund, or arrange redelivery according to the order terms and applicable law. Customers must reasonably cooperate with an investigation and must not dispose of the item or evidence while a claim is being considered, unless doing so is unsafe or necessary.
                </p>
                <p><span className={styles.placeholder}>[confirm the carrier claim window, merchant investigation steps, and any remedy hierarchy before publication]</span></p>
              </section>

              <section className={styles.section} id="contact" aria-labelledby="contact-title">
                <h2 id="contact-title">10. Shipping contact</h2>
                <p>
                  For an order-specific delivery question, use the verified shipping contact below or the <Link href="/shop/contact">contact page</Link>. Include the order number and tracking reference, but never send a password or full payment-card number.
                </p>
                <div className={styles.contactBlock}>
                  <p><strong>{merchantName} shipping support</strong></p>
                  {legalEntityName && <p>{legalEntityName}</p>}
                  {contactEmail ? (
                    <p>Email: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
                  ) : (
                    <p>Email: <span className={styles.placeholder}>[monitored shipping email to be added]</span></p>
                  )}
                  <p>Returns after delivery: <Link href="/shop/refund-policy">Refund Policy</Link>.</p>
                </div>
              </section>
            </div>

            <nav className={styles.related} aria-label="Related policies">
              <h2 className={styles.relatedTitle}>Continue reading</h2>
              <div className={styles.relatedGrid}>
                <Link className={styles.relatedLink} href="/shop/terms-conditions">
                  <span className={styles.relatedLabel}>Purchase terms</span>
                  <span>Order acceptance, payment, and delivery commitments</span>
                </Link>
                <Link className={styles.relatedLink} href="/shop/refund-policy">
                  <span className={styles.relatedLabel}>After delivery</span>
                  <span>Returns for damaged, incorrect, or unwanted items</span>
                </Link>
                <Link className={styles.relatedLink} href="/shop/privacy-policy">
                  <span className={styles.relatedLabel}>Delivery data</span>
                  <span>How carriers and fulfilment partners may use details</span>
                </Link>
              </div>
            </nav>

            <p className={styles.policyFooter}>Keep the order confirmation and tracking details for any delivery enquiry.</p>
          </article>
        </div>
      </div>
    </div>
  );
}

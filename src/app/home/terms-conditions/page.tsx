import type { Metadata } from 'next';
import Link from 'next/link';
import { getContextCompany } from '@/lib/tenant';
import styles from '../legal/legal.module.css';
import PrintButton from './PrintButton';

const LAST_UPDATED = 'September 23, 2026';
const LAST_UPDATED_ISO = '2026-09-23';

const description =
  'Read the terms that apply when browsing, ordering, paying for, or receiving products from this storefront.';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description,
  alternates: {
    canonical: '/shop/terms-conditions',
  },
  openGraph: {
    title: 'Terms & Conditions',
    description,
    url: '/shop/terms-conditions',
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
  { href: '#about-these-terms', label: 'About these terms' },
  { href: '#orders', label: 'Orders and acceptance' },
  { href: '#products-prices', label: 'Products, prices and payment' },
  { href: '#delivery', label: 'Delivery' },
  { href: '#returns', label: 'Returns and cancellation' },
  { href: '#customer-responsibilities', label: 'Customer responsibilities' },
  { href: '#intellectual-property', label: 'Intellectual property' },
  { href: '#consumer-rights', label: 'Consumer rights' },
  { href: '#liability', label: 'Liability' },
  { href: '#changes', label: 'Changes to these terms' },
  { href: '#governing-law', label: 'Governing law' },
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

export default async function TermsConditionsPage() {
  const merchantName = await getMerchantName();
  const legalEntityName = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim();
  const registeredAddress = process.env.NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS?.trim();
  const contactEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();
  const governingLaw = process.env.NEXT_PUBLIC_GOVERNING_LAW?.trim();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <a className={styles.skipLink} href="#policy-content">Skip to policy content</a>

        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol className={styles.breadcrumbList}>
            <li><Link className={styles.breadcrumbLink} href="/shop">Home</Link></li>
            <li aria-current="page">Terms &amp; Conditions</li>
          </ol>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroMark} aria-hidden="true">
            <svg className={styles.heroIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18" />
              <path d="M5 6h14" />
              <path d="m5 6-3 6a4.2 4.2 0 0 0 6 0L5 6Z" />
              <path d="m19 6-3 6a4.2 4.2 0 0 0 6 0l-3-6Z" />
              <path d="M8 21h8" />
            </svg>
          </div>
          <p className={styles.eyebrow}>Customer information</p>
          <h1 className={styles.heroTitle} id="terms-title">Terms &amp; Conditions</h1>
          <p className={styles.lede}>
            The ground rules for shopping with {merchantName}, from placing an order to receiving your products.
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
              const isCurrent = policy.href === '/shop/terms-conditions';

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

          <article className={styles.content} id="policy-content" aria-labelledby="terms-title">
            <aside className={styles.reviewNotice} role="note">
              <strong className={styles.noticeTitle}>Merchant configuration required</strong>
              Bracketed fields are deliberately unconfirmed placeholders. Complete and review them before treating this page as a final statement of the merchant’s legal obligations.
            </aside>

            <section className={styles.merchantCard} id="merchant-details" aria-labelledby="merchant-details-title">
              <h2 id="merchant-details-title">Merchant details</h2>
              <dl className={styles.merchantGrid}>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Store display name</dt>
                  <dd className={styles.merchantValue}>{merchantName}</dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Registered legal entity</dt>
                  <dd className={styles.merchantValue}>
                    {legalEntityName || <span className={styles.placeholder}>[legal entity name to be confirmed]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Registered address</dt>
                  <dd className={styles.merchantValue}>
                    {registeredAddress || <span className={styles.placeholder}>[registered business address to be added]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Legal contact email</dt>
                  <dd className={styles.merchantValue}>
                    {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : <span className={styles.placeholder}>[monitored legal contact email to be added]</span>}
                  </dd>
                </div>
              </dl>
            </section>

            <div className={styles.prose}>
              <section className={styles.section} id="about-these-terms" aria-labelledby="about-these-terms-title">
                <h2 id="about-these-terms-title">1. About these terms</h2>
                <p>
                  These Terms &amp; Conditions form part of your agreement with {merchantName} when you browse the storefront, create an account, contact us, place an order, or use another store function. They apply together with the checkout terms, order confirmation, and the policies linked on this page.
                </p>
                <p>
                  If a product page, checkout field, or separate written term expressly says something different, that more specific term may apply to the relevant order. Mandatory consumer rights in your country of residence always remain unaffected.
                </p>
              </section>

              <section className={styles.section} id="orders" aria-labelledby="orders-title">
                <h2 id="orders-title">2. Orders and acceptance</h2>
                <p>
                  When you place an order, you make an offer to buy the selected products for the displayed price and delivery terms. A contract is formed only when {merchantName} accepts the order. Acceptance may be confirmed through an order acknowledgement, dispatch notice, or another clear communication.
                </p>
                <p>
                  We may decline or cancel an order before acceptance if, for example, an item is unavailable, an obvious pricing or listing error exists, the order cannot be fulfilled to the selected destination, or additional payment verification is required. If payment has already been taken, any amount that must be returned will be handled using the payment method used for the order, subject to the payment provider’s processing time.
                </p>
                <p>
                  Please provide accurate contact and delivery information. You are responsible for reviewing the order summary before submitting it.
                </p>
              </section>

              <section className={styles.section} id="products-prices" aria-labelledby="products-prices-title">
                <h2 id="products-prices-title">3. Products, prices and payment</h2>
                <h3>Product information</h3>
                <p>
                  We aim to describe products accurately. Product images, measurements, weights, colours and materials may vary because of screen settings, production variation, or supplier updates. Always check the written specifications and any suitability requirements before ordering. Do not rely on a product being suitable for a particular purpose unless we have expressly confirmed that suitability in writing.
                </p>

                <h3>Price and availability</h3>
                <p>
                  Prices, currency, available promotions, delivery charges, and any applicable taxes are shown during checkout or in the order summary. A product may become unavailable before acceptance. Prices may change without notice, but a change will not affect an order already accepted at the old price.
                </p>

                <h3>Payment</h3>
                <p>
                  Payment is made through the methods offered at checkout and is subject to their stated terms. We may verify a payment or request additional information where reasonably necessary to prevent fraud or comply with legal obligations. Full payment is not assumed where a different arrangement is expressly displayed at checkout.
                </p>
              </section>

              <section className={styles.section} id="delivery" aria-labelledby="delivery-title">
                <h2 id="delivery-title">4. Delivery</h2>
                <p>
                  Delivery is subject to the <Link href="/shop/shipping-policy">Shipping Policy</Link> and the destination, method, and estimate shown when the order is placed. Any delivery estimate is an estimate rather than a guaranteed date unless the order expressly states otherwise.
                </p>
                <p>
                  Unless the law provides otherwise, responsibility for an undelivered product, risk of loss, and any delivery commitments will be handled according to the Shipping Policy and the agreed order terms. Please report delivery problems as soon as reasonably possible.
                </p>
              </section>

              <section className={styles.section} id="returns" aria-labelledby="returns-title">
                <h2 id="returns-title">5. Returns, refunds and cancellation</h2>
                <p>
                  Returns and refund requests are handled under the <Link href="/shop/refund-policy">Refund Policy</Link>. Any more generous cancellation or return right displayed for a particular order applies to that order. These Terms &amp; Conditions do not reduce rights that cannot lawfully be excluded.
                </p>
                <p>
                  To request cancellation before acceptance, contact us promptly using the details below. After acceptance, follow the refund process rather than sending an item without instructions.
                </p>
              </section>

              <section className={styles.section} id="customer-responsibilities" aria-labelledby="customer-responsibilities-title">
                <h2 id="customer-responsibilities-title">6. Customer responsibilities and acceptable use</h2>
                <p>When using the storefront, you agree that you will:</p>
                <ul className={styles.checklist}>
                  <li>use the service lawfully and only for intended personal or authorised business use;</li>
                  <li>provide accurate information and keep account credentials secure;</li>
                  <li>not attempt to disrupt, overload, probe, or gain unauthorised access to the service;</li>
                  <li>not introduce malicious code, scrape content in a way that violates applicable law or another party’s rights, or misuse reviews, support, or other communications; and</li>
                  <li>not use the storefront to violate export, tax, product-safety, sanctions, or other applicable requirements.</li>
                </ul>
                <p>
                  We may restrict access or cancel an order where we reasonably believe there is a security, fraud, legal, or safety risk, or where these rules have been materially breached.
                </p>
              </section>

              <section className={styles.section} id="intellectual-property" aria-labelledby="intellectual-property-title">
                <h2 id="intellectual-property-title">7. Intellectual property</h2>
                <p>
                  The storefront software, branding, page design, product content, photographs, and other materials owned or licensed by {merchantName} remain subject to their owner’s intellectual-property rights. You receive a limited, revocable, non-transferable right to use the storefront for its intended purpose. You may not reproduce, modify, publish, or commercially exploit those materials without permission, except as allowed by applicable law.
                </p>
                <p>
                  Brand names and product content may belong to third parties. Nothing in these terms grants you a right to use them beyond normal use of the product or service.
                </p>
              </section>

              <section className={styles.section} id="consumer-rights" aria-labelledby="consumer-rights-title">
                <h2 id="consumer-rights-title">8. Consumer rights and product information</h2>
                <p>
                  Nothing in these terms excludes or limits warranties, remedies, or other rights that cannot lawfully be excluded or limited. Product descriptions, care information, safety instructions, delivery commitments, and any specific warranty offered with an order form part of the information you may rely on when deciding to buy.
                </p>
                <div className={styles.callout}>
                  <p>
                    <strong>Merchant input required:</strong> <span className={styles.placeholder}>[add any product-specific warranty, expiry statement, care condition, or other condition of sale that is actually offered]</span>
                  </p>
                </div>
                <p>
                  If a product does not match its description or your statutory rights apply, statutory remedies may be available in addition to, or instead of, the returns process.
                </p>
              </section>

              <section className={styles.section} id="liability" aria-labelledby="liability-title">
                <h2 id="liability-title">9. Liability</h2>
                <p>
                  To the fullest extent permitted by applicable law, {merchantName} is not responsible for losses that were not reasonably foreseeable when these terms were accepted, were caused by your own breach, or arose from a matter outside our reasonable control. Indirect or consequential loss is excluded only to the extent the law allows.
                </p>
                <p>
                  No exclusion in these terms limits liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, deliberate misuse, payment obligations, or any other liability that cannot lawfully be limited. The merchant must confirm any store-specific cap, insurance statement, or mandatory local-law wording before publication.
                </p>
              </section>

              <section className={styles.section} id="changes" aria-labelledby="changes-title">
                <h2 id="changes-title">10. Changes to these terms</h2>
                <p>
                  We may update these terms to reflect changes in the service, products, or law. The updated version applies from the date shown at the top of the page. If a change materially affects an order already accepted, the terms accepted for that order will continue to apply unless the law says otherwise.
                </p>
                <p>
                  Version history beyond the current effective date is not yet maintained. <span className={styles.placeholder}>[decide whether a public version history is required]</span>
                </p>
              </section>

              <section className={styles.section} id="governing-law" aria-labelledby="governing-law-title">
                <h2 id="governing-law-title">11. Governing law and disputes</h2>
                <p>
                  The law and forum that apply to a dispute must reflect the mandatory consumer law of your place of residence and the merchant’s place of business. {governingLaw || <span className={styles.placeholder}>[insert governing law, jurisdiction, and any lawful dispute-resolution process only after legal review]</span>}
                </p>
                <p>
                  Nothing here prevents you from using a mandatory consumer ombudsman, small-claims process, or other remedy available under local law.
                </p>
              </section>

              <section className={styles.section} id="contact" aria-labelledby="contact-title">
                <h2 id="contact-title">12. Contact us</h2>
                <p>
                  Questions about these terms, an accepted order, or a legal right should be sent to the verified legal contact below. Please do not include payment-card numbers, passwords, or unnecessary sensitive information.
                </p>
                <div className={styles.contactBlock}>
                  <p><strong>{merchantName}</strong></p>
                  {legalEntityName && <p>{legalEntityName}</p>}
                  {registeredAddress && <p>{registeredAddress}</p>}
                  {contactEmail ? (
                    <p>Email: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
                  ) : (
                    <p>Email: <span className={styles.placeholder}>[monitored legal contact email to be added]</span></p>
                  )}
                  <p>General store enquiries: <Link href="/shop/contact">Contact us</Link>.</p>
                </div>
              </section>
            </div>

            <nav className={styles.related} aria-label="Related policies">
              <h2 className={styles.relatedTitle}>Continue reading</h2>
              <div className={styles.relatedGrid}>
                <Link className={styles.relatedLink} href="/shop/privacy-policy">
                  <span className={styles.relatedLabel}>Customer data</span>
                  <span>How the storefront handles personal information</span>
                </Link>
                <Link className={styles.relatedLink} href="/shop/refund-policy">
                  <span className={styles.relatedLabel}>After purchase</span>
                  <span>Return eligibility, refunds, and exclusions</span>
                </Link>
                <Link className={styles.relatedLink} href="/shop/shipping-policy">
                  <span className={styles.relatedLabel}>Order fulfilment</span>
                  <span>Processing, destinations, costs, and delivery issues</span>
                </Link>
              </div>
            </nav>

            <p className={styles.policyFooter}>Please retain a copy of these terms and your order confirmation for your records.</p>
          </article>
        </div>
      </div>
    </div>
  );
}

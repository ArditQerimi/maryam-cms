import type { Metadata } from 'next';
import Link from 'next/link';
import { getContextCompany } from '@/lib/tenant';
import styles from '../legal/legal.module.css';
import PrintButton from './PrintButton';

const LAST_UPDATED = 'September 23, 2026';
const LAST_UPDATED_ISO = '2026-09-23';

const description =
  'Read how to request a return or refund, the conditions that apply, and how eligible refunds are handled.';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description,
  alternates: {
    canonical: '/shop/refund-policy',
  },
  openGraph: {
    title: 'Refund Policy',
    description,
    url: '/shop/refund-policy',
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
  { href: '#scope', label: 'Scope and rights' },
  { href: '#eligibility', label: 'Return eligibility' },
  { href: '#exclusions', label: 'Possible exclusions' },
  { href: '#request', label: 'How to request a return' },
  { href: '#returning', label: 'Returning an item' },
  { href: '#inspection', label: 'Inspection and decision' },
  { href: '#refund', label: 'Refund method and amount' },
  { href: '#exchanges', label: 'Exchanges' },
  { href: '#problems', label: 'Damaged or incorrect items' },
  { href: '#cancellation', label: 'Order cancellation' },
  { href: '#consumer-rights', label: 'Consumer rights' },
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

export default async function RefundPolicyPage() {
  const merchantName = await getMerchantName();
  const legalEntityName = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim();
  const registeredAddress = process.env.NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS?.trim();
  const contactEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();
  const returnWindow = process.env.NEXT_PUBLIC_RETURN_WINDOW?.trim();
  const returnShippingPolicy = process.env.NEXT_PUBLIC_RETURN_SHIPPING_POLICY?.trim();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <a className={styles.skipLink} href="#policy-content">Skip to policy content</a>

        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol className={styles.breadcrumbList}>
            <li><Link className={styles.breadcrumbLink} href="/shop">Home</Link></li>
            <li aria-current="page">Refund Policy</li>
          </ol>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroMark} aria-hidden="true">
            <svg className={styles.heroIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h13a3 3 0 0 1 3 3v1" />
              <path d="m14 4 3 3-3 3" />
              <path d="M20 17H7a3 3 0 0 1-3-3v-1" />
              <path d="m10 14-3 3 3 3" />
            </svg>
          </div>
          <p className={styles.eyebrow}>After your purchase</p>
          <h1 className={styles.heroTitle} id="refund-title">Refund Policy</h1>
          <p className={styles.lede}>
            A clear process for return requests, eligible refunds, and problems with an order from {merchantName}.
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
              const isCurrent = policy.href === '/shop/refund-policy';

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

          <article className={styles.content} id="policy-content" aria-labelledby="refund-title">
            <aside className={styles.reviewNotice} role="note">
              <strong className={styles.noticeTitle}>Merchant configuration required</strong>
              The store must approve the actual return window, product exclusions, return-postage terms, refund deductions, and any jurisdiction-specific exceptions before publication.
            </aside>

            <section className={styles.merchantCard} id="merchant-details" aria-labelledby="merchant-details-title">
              <h2 id="merchant-details-title">Merchant details</h2>
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
                  <dt className={styles.merchantLabel}>Registered address</dt>
                  <dd className={styles.merchantValue}>
                    {registeredAddress || <span className={styles.placeholder}>[registered business address to be added]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Returns contact</dt>
                  <dd className={styles.merchantValue}>
                    {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : <span className={styles.placeholder}>[monitored returns email to be added]</span>}
                  </dd>
                </div>
              </dl>
            </section>

            <div className={styles.prose}>
              <section className={styles.section} id="scope" aria-labelledby="scope-title">
                <h2 id="scope-title">1. Scope and non-exclusion of rights</h2>
                <p>
                  This Refund Policy explains the voluntary returns process offered by {merchantName}. It applies to orders placed through this storefront unless an order or product page expressly provides a different process. Delivery arrangements are described in the <Link href="/shop/shipping-policy">Shipping Policy</Link>, and the purchase agreement is governed by the <Link href="/shop/terms-conditions">Terms &amp; Conditions</Link>.
                </p>
                <p>
                  This policy does not remove, restrict, or replace a mandatory consumer right, warranty, remedy, or statutory cancellation right. Where local law gives you a right that is different from this policy, the stronger applicable protection should be honoured.
                </p>
              </section>

              <section className={styles.section} id="eligibility" aria-labelledby="eligibility-title">
                <h2 id="eligibility-title">2. Return eligibility and timing</h2>
                <p>
                  An item may be eligible for a return if it is unused, complete, in resalable condition, and accompanied by the packaging, accessories, labels, and documentation supplied with it. Eligibility also depends on the product, reason for return, proof of purchase, and any condition clearly displayed before purchase.
                </p>
                {returnWindow ? (
                  <p><strong>Return window:</strong> {returnWindow}</p>
                ) : (
                  <p><span className={styles.placeholder}>[state the merchant-approved return window, when it begins, and any proof-of-purchase requirement]</span></p>
                )}
                <p>
                  Contact us before returning an item if you are unsure whether it qualifies. Approval of a return request does not guarantee a refund if the returned item fails the stated eligibility checks.
                </p>
              </section>

              <section className={styles.section} id="exclusions" aria-labelledby="exclusions-title">
                <h2 id="exclusions-title">3. Possible exclusions</h2>
                <p>
                  The following may be excluded only to the extent the product is actually sold that way, the exclusion is clearly communicated, and the law permits it:
                </p>
                <ul className={styles.list}>
                  <li>items returned after the approved return window;</li>
                  <li>items that were used, damaged, altered, incomplete, or no longer in resalable condition, except where the damage or defect is the merchant’s responsibility;</li>
                  <li>perishable, hygiene-sensitive, sealed, personalised, or made-to-order items, where exclusion is lawful;</li>
                  <li>digital content or services once lawfully supplied or downloaded, where the law allows this exception;</li>
                  <li>gift cards, vouchers, or other value instruments if they cannot legally be refunded as money;</li>
                  <li>items damaged after delivery, lost, or used contrary to care instructions; and</li>
                  <li>items where a change of mind is not accepted because a mandatory exception applies.</li>
                </ul>
                <div className={styles.callout}>
                  <p>
                    <strong>Inventory check required:</strong> <span className={styles.placeholder}>[list the exact product categories, seals, and exclusions that this store sells; remove categories that are not offered]</span>
                  </p>
                </div>
              </section>

              <section className={styles.section} id="request" aria-labelledby="request-title">
                <h2 id="request-title">4. How to request a return</h2>
                <p>Send the following information through the returns contact or <Link href="/shop/contact">contact page</Link>:</p>
                <ol className={styles.list}>
                  <li>your order number and the email or telephone details associated with it;</li>
                  <li>the product name, variant, and quantity;</li>
                  <li>the reason for the return or a concise description of the problem;</li>
                  <li>the date the order was received, if known; and</li>
                  <li>clear photographs or other evidence where relevant, especially for damage or incorrect items.</li>
                </ol>
                <p>
                  Do not send payment-card numbers, passwords, or unnecessary sensitive information. A request does not guarantee eligibility and should be submitted through the verified returns channel rather than an unverified social-media message.
                </p>
              </section>

              <section className={styles.section} id="returning" aria-labelledby="returning-title">
                <h2 id="returning-title">5. Returning an item</h2>
                <p>
                  If a return is approved, wait for return instructions, including the authorised return address, packing guidance, and any required reference or authorisation code. Do not send an item to the registered business address unless the merchant confirms that it is the returns address.
                </p>
                <p>
                  Use a tracked service where available and keep the receipt and proof of postage. The risk of loss during return may remain with the customer until the merchant receives the item, unless the merchant offers a different arrangement or the law provides otherwise.
                </p>
                {returnShippingPolicy ? (
                  <p><strong>Return postage:</strong> {returnShippingPolicy}</p>
                ) : (
                  <p><span className={styles.placeholder}>[state who pays return postage and when reimbursement, if any, may be available]</span></p>
                )}
              </section>

              <section className={styles.section} id="inspection" aria-labelledby="inspection-title">
                <h2 id="inspection-title">6. Inspection and return decision</h2>
                <p>
                  The returned item and supporting information may be checked to confirm identity, condition, eligibility, and the reason for the request. We may contact you if clarification is needed or if evidence does not show a manufacturing fault or another covered issue.
                </p>
                <p>
                  A decision will be communicated using the contact details supplied with the request. If a return is declined, the reasons will be provided to the extent appropriate. Rejection of this voluntary process does not remove a separate statutory remedy.
                </p>
                <p><span className={styles.placeholder}>[define the approved inspection method and any target decision time without promising an unverified deadline]</span></p>
              </section>

              <section className={styles.section} id="refund" aria-labelledby="refund-title-heading">
                <h2 id="refund-title-heading">7. Refund method and amount</h2>
                <p>
                  When a refund is approved, the usual amount is the price actually paid for the eligible returned item, adjusted for the order as required by law. Depending on the offer and the law, this may include deductions for missing parts, damage caused after delivery, early-return deductions permitted for a lawful exception, or the proportional effect of a discount. Any deduction must be explained.
                </p>
                <p>
                  Refunds are generally sent to the original payment method. The time taken to appear depends on the payment provider and bank and is not fixed by this policy. Until a refund is sent, the merchant may cancel an undelivered order as protection against a second payment.
                </p>
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <caption>What may affect the final refund</caption>
                    <thead>
                      <tr>
                        <th scope="col">Situation</th>
                        <th scope="col">Possible treatment</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Eligible item returned</td>
                        <td>Refund to the original payment method, subject to the final order calculation</td>
                      </tr>
                      <tr>
                        <td>Original or return delivery charge</td>
                        <td>Refundable only if the offer says so or applicable law requires it</td>
                      </tr>
                      <tr>
                        <td>Applied discount or promotion</td>
                        <td>May be recalculated according to the published promotion terms and applicable law</td>
                      </tr>
                      <tr>
                        <td>Item damaged by the customer</td>
                        <td>A lawful deduction may apply, except for responsibility attributed to the merchant or carrier</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p><span className={styles.placeholder}>[confirm actual refund components, deductions, fraud checks, and whether a store credit option is offered]</span></p>
              </section>

              <section className={styles.section} id="exchanges" aria-labelledby="exchanges-title">
                <h2 id="exchanges-title">8. Exchanges</h2>
                <p>
                  An exchange is offered only if stock is available and the return is otherwise accepted. The replacement will be priced at its price when the exchange is arranged. If the replacement costs more, the additional amount will be shown for approval; if it costs less, any refund will follow the same process used for a returned item.
                </p>
                <p>
                  An exchange is not guaranteed and may instead be resolved as a refund where no suitable item is available. <span className={styles.placeholder}>[confirm whether this store offers exchanges and any price-adjustment terms]</span>
                </p>
              </section>

              <section className={styles.section} id="problems" aria-labelledby="problems-title">
                <h2 id="problems-title">9. Damaged, incorrect, faulty, or missing items</h2>
                <p>
                  If an item arrives damaged, incorrect, faulty, or missing, contact us promptly with the order number, a description, and clear photographs of the item and packaging. Keep the item and packaging while the issue is reviewed unless it is unsafe or unnecessary to do so.
                </p>
                <p>
                  Do not discard or repair an item before a covered claim is assessed, where reasonably possible. The merchant will offer a remedy permitted by the order terms and applicable law. The word “promptly” must be given a real, operational meaning for each market: <span className={styles.placeholder}>[insert a verified reporting deadline only if one has been approved]</span>.
                </p>
              </section>

              <section className={styles.section} id="cancellation" aria-labelledby="cancellation-title">
                <h2 id="cancellation-title">10. Order cancellation</h2>
                <p>
                  To request cancellation of an order, contact us promptly. A request is not guaranteed because an order may already have entered fulfilment. If {merchantName} can cancel before dispatch, any amount charged will be handled under the refund process. If cancellation is not possible, the order may be treated as a return.
                </p>
                <p>
                  Any mandatory right to cancel a distance contract or receive a refund after delivery cannot be removed by this policy. <span className={styles.placeholder}>[add a cancellation cut-off only after operations confirms the actual fulfilment workflow]</span>
                </p>
              </section>

              <section className={styles.section} id="consumer-rights" aria-labelledby="consumer-rights-title">
                <h2 id="consumer-rights-title">11. Consumer rights and payment disputes</h2>
                <p>
                  We ask you to use this process first so that the problem can be understood and resolved. This does not prevent you from using a mandatory consumer ombudsman, small-claims process, statutory rights, or a bank or card chargeback service where available.
                </p>
                <p>
                  Before starting a chargeback, contact us so we can attempt to resolve the issue. Chargeback eligibility, timing, and consequences are determined by the relevant provider and law, not by this policy.
                </p>
              </section>

              <section className={styles.section} id="contact" aria-labelledby="contact-title">
                <h2 id="contact-title">12. Returns contact</h2>
                <p>
                  Send return requests and questions to the verified channel below. Use the exact order details to help us locate the purchase, and keep copies of your messages and postage evidence.
                </p>
                <div className={styles.contactBlock}>
                  <p><strong>{merchantName} returns team</strong></p>
                  {legalEntityName && <p>{legalEntityName}</p>}
                  {contactEmail ? (
                    <p>Email: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
                  ) : (
                    <p>Email: <span className={styles.placeholder}>[monitored returns email to be added]</span></p>
                  )}
                  <p>Request form and general enquiries: <Link href="/shop/contact">Contact us</Link>.</p>
                </div>
              </section>
            </div>

            <nav className={styles.related} aria-label="Related policies">
              <h2 className={styles.relatedTitle}>Continue reading</h2>
              <div className={styles.relatedGrid}>
                <Link className={styles.relatedLink} href="/shop/terms-conditions">
                  <span className={styles.relatedLabel}>Order information</span>
                  <span>Contract, payment, delivery, and mandatory rights</span>
                </Link>
                <Link className={styles.relatedLink} href="/shop/shipping-policy">
                  <span className={styles.relatedLabel}>Delivery issues</span>
                  <span>Tracking, lost parcels, and delivery expectations</span>
                </Link>
                <Link className={styles.relatedLink} href="/shop/privacy-policy">
                  <span className={styles.relatedLabel}>Request privacy</span>
                  <span>How information in a return request is used</span>
                </Link>
              </div>
            </nav>

            <p className={styles.policyFooter}>Keep your order confirmation and return evidence until the matter is fully resolved.</p>
          </article>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getContextCompany } from '@/lib/tenant';
import styles from '../legal/legal.module.css';
import PrintButton from './PrintButton';

const LAST_UPDATED = 'September 23, 2026';
const LAST_UPDATED_ISO = '2026-09-23';

const description =
  'Learn how the storefront may collect, use, protect, and share personal information when you browse or place an order.';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description,
  alternates: {
    canonical: '/shop/privacy-policy',
  },
  openGraph: {
    title: 'Privacy Policy',
    description,
    url: '/shop/privacy-policy',
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
  { href: '#merchant-details', label: 'Controller details' },
  { href: '#scope', label: 'Scope' },
  { href: '#information', label: 'Information we collect' },
  { href: '#use', label: 'How we use information' },
  { href: '#legal-bases', label: 'Legal bases' },
  { href: '#cookies', label: 'Cookies and similar technologies' },
  { href: '#sharing', label: 'How we share information' },
  { href: '#international', label: 'International transfers' },
  { href: '#retention', label: 'Retention' },
  { href: '#security', label: 'Security' },
  { href: '#rights', label: 'Your rights' },
  { href: '#automated-decisions', label: 'Automated decisions' },
  { href: '#children', label: 'Children' },
  { href: '#changes', label: 'Policy changes' },
  { href: '#contact', label: 'Contact and complaints' },
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

export default async function PrivacyPolicyPage() {
  const merchantName = await getMerchantName();
  const legalEntityName = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim();
  const registeredAddress = process.env.NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS?.trim();
  const contactEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();
  const retentionSchedule = process.env.NEXT_PUBLIC_DATA_RETENTION_SCHEDULE?.trim();
  const cookieDetails = process.env.NEXT_PUBLIC_COOKIE_DETAILS?.trim();
  const supervisoryAuthority = process.env.NEXT_PUBLIC_SUPERVISORY_AUTHORITY?.trim();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <a className={styles.skipLink} href="#policy-content">Skip to policy content</a>

        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol className={styles.breadcrumbList}>
            <li><Link className={styles.breadcrumbLink} href="/shop">Home</Link></li>
            <li aria-current="page">Privacy Policy</li>
          </ol>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroMark} aria-hidden="true">
            <svg className={styles.heroIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              <path d="M12 14.5v2" />
            </svg>
          </div>
          <p className={styles.eyebrow}>Customer information</p>
          <h1 className={styles.heroTitle} id="privacy-title">Privacy Policy</h1>
          <p className={styles.lede}>
            How {merchantName} handles personal information when you use the storefront and place orders.
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
              const isCurrent = policy.href === '/shop/privacy-policy';

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

          <article className={styles.content} id="policy-content" aria-labelledby="privacy-title">
            <aside className={styles.reviewNotice} role="note">
              <strong className={styles.noticeTitle}>Merchant and legal review required</strong>
              This policy must be matched to the features, vendors, countries, and lawful bases actually used. Bracketed items and optional statements must be completed before publication.
            </aside>

            <section className={styles.merchantCard} id="merchant-details" aria-labelledby="merchant-details-title">
              <h2 id="merchant-details-title">Controller details</h2>
              <dl className={styles.merchantGrid}>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Store display name</dt>
                  <dd className={styles.merchantValue}>{merchantName}</dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Data controller / legal entity</dt>
                  <dd className={styles.merchantValue}>
                    {legalEntityName || <span className={styles.placeholder}>[controller’s registered legal name to be confirmed]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Registered address</dt>
                  <dd className={styles.merchantValue}>
                    {registeredAddress || <span className={styles.placeholder}>[controller’s registered address to be added]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>Privacy contact</dt>
                  <dd className={styles.merchantValue}>
                    {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : <span className={styles.placeholder}>[monitored privacy contact email to be added]</span>}
                  </dd>
                </div>
              </dl>
            </section>

            <div className={styles.prose}>
              <section className={styles.section} id="scope" aria-labelledby="scope-title">
                <h2 id="scope-title">1. Scope and status of this policy</h2>
                <p>
                  This Privacy Policy explains how {merchantName} handles personal information in connection with this storefront, customer accounts, support requests, orders, payment, and delivery. The controller is the legal entity shown above. If a separate privacy notice is provided for a specific service or activity, that notice may add to or replace this policy for that activity.
                </p>
                <p>
                  The exact controller role can differ in a relationship—for example, a processor acting for a business customer. The merchant must identify any such processing relationships here before launching the relevant service.
                </p>
              </section>

              <section className={styles.section} id="information" aria-labelledby="information-title">
                <h2 id="information-title">2. Information we may collect</h2>
                <p>Depending on how you interact with the store, the information processed may include:</p>
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <caption>Categories of personal information and examples</caption>
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col">Examples</th>
                        <th scope="col">When it is collected</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Identity and contact data</strong></td>
                        <td>Name, billing and delivery name, email address, telephone number, delivery address</td>
                        <td>Account registration, checkout, order updates, or support</td>
                      </tr>
                      <tr>
                        <td><strong>Order and transaction data</strong></td>
                        <td>Products ordered, order reference, price, discount, delivery choice, invoice data, refund or cancellation history</td>
                        <td>When you place, change, or query an order</td>
                      </tr>
                      <tr>
                        <td><strong>Payment data</strong></td>
                        <td>Payment status, transaction reference, billing country, and limited card or bank details provided by the payment provider</td>
                        <td>During payment or payment verification</td>
                      </tr>
                      <tr>
                        <td><strong>Device and usage data</strong></td>
                        <td>IP address, browser or device type, approximate location derived from an IP address, pages viewed, referrer, timestamps, and error records</td>
                        <td>When you browse or use the store</td>
                      </tr>
                      <tr>
                        <td><strong>Communications</strong></td>
                        <td>Support messages, survey responses, delivery notices, and records of consent or choices</td>
                        <td>When you contact us or submit a form</td>
                      </tr>
                      <tr>
                        <td><strong>Marketing preferences</strong></td>
                        <td>Whether you opted in, your channel choices, and campaign interactions</td>
                        <td>Only when marketing is offered and permitted</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>
                  Please do not send passwords, full payment-card details, government identifiers, health information, or other sensitive information in a support message. If special-category data is intentionally required for a specific request, its necessity, safeguards, and lawful basis must be explained before collection.
                </p>
              </section>

              <section className={styles.section} id="use" aria-labelledby="use-title">
                <h2 id="use-title">3. How we use information</h2>
                <p>We may use personal information to:</p>
                <ul className={styles.list}>
                  <li>create and administer customer accounts and authenticate users;</li>
                  <li>process orders, payments, invoices, delivery arrangements, returns, and support;</li>
                  <li>provide order updates, respond to enquiries, and prevent or investigate fraud or abuse;</li>
                  <li>operate, secure, test, and improve the storefront, including to understand failures and performance;</li>
                  <li>send service messages and, where permitted, marketing; and</li>
                  <li>check and comply with tax, product, sanctions, and other legal obligations.</li>
                </ul>
                <p>
                  We do not use personal information for a materially incompatible purpose without providing any notice or obtaining consent required by law.
                </p>
              </section>

              <section className={styles.section} id="legal-bases" aria-labelledby="legal-bases-title">
                <h2 id="legal-bases-title">4. Legal bases for processing</h2>
                <p>Where privacy law requires a legal basis, the store may rely on one or more of the following, depending on the activity and your location:</p>
                <ul className={styles.list}>
                  <li><strong>Contract:</strong> processing needed to take steps at your request, perform an accepted order, or provide support.</li>
                  <li><strong>Legal obligation:</strong> meeting tax, accounting, product-safety, consumer, or other binding duties.</li>
                  <li><strong>Legitimate interests:</strong> securing the service, preventing fraud, improving operations, or communicating with existing customers, where those interests are not overridden by your rights.</li>
                  <li><strong>Consent:</strong> optional cookies, marketing, or other processing where consent is required. Consent may be withdrawn prospectively.</li>
                  <li><strong>Vital interests or public task:</strong> only where applicable and legally recognised.</li>
                </ul>
                <div className={styles.callout}>
                  <p>
                    <strong>Legal review required:</strong> <span className={styles.placeholder}>[confirm the specific basis for each processing purpose and any balancing test relied on]</span>
                  </p>
                </div>
              </section>

              <section className={styles.section} id="cookies" aria-labelledby="cookies-title">
                <h2 id="cookies-title">5. Cookies and similar technologies</h2>
                <p>
                  Strictly necessary technologies may be used to remember the cart, keep you signed in, protect forms and accounts, process checkout, balance site traffic, and remember privacy or cookie choices. Where those technologies are not legally exempt, the site should request consent before using non-essential ones.
                </p>
                <p>
                  Optional analytics, advertising, personalisation, and social-media technologies must be listed with their provider, purpose, duration, and any transfer implications before they are enabled.
                </p>
                {cookieDetails ? (
                  <p>{cookieDetails}</p>
                ) : (
                  <p><span className={styles.placeholder}>[inventory all cookies and similar technologies, including name, purpose, provider, and duration]</span></p>
                )}
                <p>
                  Your browser may offer controls to delete or block stored data. Blocking strictly necessary technologies can prevent some store functions from working.
                </p>
              </section>

              <section className={styles.section} id="sharing" aria-labelledby="sharing-title">
                <h2 id="sharing-title">6. How we share information</h2>
                <p>We do not sell personal information as a general rule. However, information may be shared when needed to operate the store or meet legal duties, including with:</p>
                <ul className={styles.list}>
                  <li>payment, fraud-prevention, and identity-verification providers;</li>
                  <li>hosting, database, content-delivery, email, analytics, and IT service providers that process data under contract;</li>
                  <li>carriers, fulfilment partners, and suppliers involved in an order;</li>
                  <li>professional advisers, auditors, insurers, and public authorities where legally required or reasonably necessary;</li>
                  <li>a buyer or successor in a merger, reorganisation, or asset transfer, subject to appropriate notice and safeguards; and</li>
                  <li>other recipients at your direction or with your consent.</li>
                </ul>
                <p>
                  Service providers must process information only as instructed and must provide appropriate security and confidentiality commitments. <span className={styles.placeholder}>[add the actual material processor and subprocessor list after vendors are approved]</span>
                </p>
              </section>

              <section className={styles.section} id="international" aria-labelledby="international-title">
                <h2 id="international-title">7. International transfers</h2>
                <p>
                  Your information may be processed in a country other than your own when service providers or payment partners operate there. Where required, transfers use an approved legal mechanism and supplementary safeguards, with any rights to object or request information about the transfer.
                </p>
                <p><span className={styles.placeholder}>[identify relevant transfer countries, legal mechanisms, and how to request transfer information]</span></p>
              </section>

              <section className={styles.section} id="retention" aria-labelledby="retention-title">
                <h2 id="retention-title">8. Retention and deletion</h2>
                <p>
                  Information is kept only for as long as needed for the relevant order, account, support, security, and legal purposes. Retention may differ by record type: an invoice may be required for tax and accounting periods, while an abandoned cart or basic device record may be removed much sooner. Data is deleted or de-identified when its purpose ends unless continued retention is legally required.
                </p>
                {retentionSchedule ? (
                  <p>{retentionSchedule}</p>
                ) : (
                  <p><span className={styles.placeholder}>[confirm concrete retention periods for account, order, support, payment, security, consent, and marketing records]</span></p>
                )}
              </section>

              <section className={styles.section} id="security" aria-labelledby="security-title">
                <h2 id="security-title">9. Security</h2>
                <p>
                  Reasonable administrative, technical, and organisational measures may be used to protect information, such as access controls, encryption where appropriate, secure service providers, logging, backups, and vulnerability management. No online or payment system can guarantee absolute security. If a breach affects your rights or creates notification duties, the merchant will comply with applicable law.
                </p>
                <p>
                  You should protect your password and account access and contact us promptly if you believe your account has been compromised.
                </p>
              </section>

              <section className={styles.section} id="rights" aria-labelledby="rights-title">
                <h2 id="rights-title">10. Your privacy rights</h2>
                <p>Depending on your location, you may have the right to:</p>
                <ul className={styles.checklist}>
                  <li>ask whether personal information is processed and obtain a copy;</li>
                  <li>correct inaccurate or incomplete information;</li>
                  <li>request deletion, restriction, or objection to certain processing;</li>
                  <li>receive certain information in a portable, machine-readable format;</li>
                  <li>withdraw consent and object to direct marketing at any time; and</li>
                  <li>complain to a competent data-protection authority.</li>
                </ul>
                <p>
                  We may ask for information to verify identity and protect your data. Some rights are limited where the law requires retention, a claim needs evidence, or another legitimate interest applies. Mandatory rights and limitations must be tailored by the merchant to the customer’s country.
                </p>
                <div className={styles.callout}>
                  <p>
                    <strong>Jurisdiction check required:</strong> <span className={styles.placeholder}>[confirm whether the right to object, portability, automated decision-making, direct marketing, “sale”/“sharing”, or similar concepts apply]</span>
                  </p>
                </div>
              </section>

              <section className={styles.section} id="automated-decisions" aria-labelledby="automated-decisions-title">
                <h2 id="automated-decisions-title">11. Automated decisions and profiling</h2>
                <p>
                  Order, payment, fraud-prevention, or delivery decisions may involve systems that apply rules or produce a score. Any decision that has a legal or similarly significant effect, or any meaningful profiling that relies only on automated processing, must be disclosed here with the required safeguards and right to human intervention.
                </p>
                <p><span className={styles.placeholder}>[confirm that no significant automated-only decision or profiling is used, or describe each approved use and safeguard]</span></p>
              </section>

              <section className={styles.section} id="children" aria-labelledby="children-title">
                <h2 id="children-title">12. Children</h2>
                <p>
                  The store and its products are not directed to children below the age at which they may independently consent to the relevant processing. The merchant must set and verify the applicable minimum age under local law. We do not knowingly collect personal information from a child below that threshold without valid authorisation; a parent or guardian may contact us to report a concern.
                </p>
                <p><span className={styles.placeholder}>[insert the verified minimum age for each target market if a child threshold applies]</span></p>
              </section>

              <section className={styles.section} id="changes" aria-labelledby="changes-title">
                <h2 id="changes-title">13. Changes to this policy</h2>
                <p>
                  This policy may be updated when the store, vendors, or law changes. The date at the top shows when the current version took effect. Where a change requires notice, additional consent, or gives you a right to object, the merchant will provide that notice before the change applies.
                </p>
              </section>

              <section className={styles.section} id="contact" aria-labelledby="contact-title">
                <h2 id="contact-title">14. Privacy contact and complaints</h2>
                <p>
                  Send privacy questions, access requests, corrections, or objections to the verified contact below. Include enough information to identify the request, but do not send passwords or full payment-card details. We may ask for verification before acting.
                </p>
                <div className={styles.contactBlock}>
                  <p><strong>Privacy contact for {merchantName}</strong></p>
                  {legalEntityName && <p>{legalEntityName}</p>}
                  {registeredAddress && <p>{registeredAddress}</p>}
                  {contactEmail ? (
                    <p><a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
                  ) : (
                    <p><span className={styles.placeholder}>[monitored privacy contact email to be added]</span></p>
                  )}
                  {supervisoryAuthority ? (
                    <p>Complaint authority: {supervisoryAuthority}</p>
                  ) : (
                    <p><span className={styles.placeholder}>[identify the correct complaint authority for each target market]</span></p>
                  )}
                  <p>For order-specific questions, use the <Link href="/shop/contact">contact page</Link>.</p>
                </div>
              </section>
            </div>

            <nav className={styles.related} aria-label="Related policies">
              <h2 className={styles.relatedTitle}>Continue reading</h2>
              <div className={styles.relatedGrid}>
                <Link className={styles.relatedLink} href="/shop/terms-conditions">
                  <span className={styles.relatedLabel}>Purchase terms</span>
                  <span>Orders, payment, delivery, and legal terms</span>
                </Link>
                <Link className={styles.relatedLink} href="/shop/refund-policy">
                  <span className={styles.relatedLabel}>Your purchase</span>
                  <span>Return requests and the data used to process them</span>
                </Link>
                <Link className={styles.relatedLink} href="/shop/shipping-policy">
                  <span className={styles.relatedLabel}>Delivery data</span>
                  <span>How fulfilment and tracking may use contact details</span>
                </Link>
              </div>
            </nav>

            <p className={styles.policyFooter}>A printed copy is available using your browser’s print function.</p>
          </article>
        </div>
      </div>
    </div>
  );
}

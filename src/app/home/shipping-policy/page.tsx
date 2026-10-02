import type { Metadata } from 'next';
import Link from 'next/link';
import { getContextCompany } from '@/lib/tenant';
import { getT } from '@/lib/i18n/server';
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
    canonical: '/home/shipping-policy',
  },
  openGraph: {
    title: 'Shipping Policy',
    description,
    url: '/home/shipping-policy',
    type: 'website',
  },
};

const policyLinks = [
  { href: '/home/terms-conditions', labelKey: 'pages.policy.linkTerms' },
  { href: '/home/privacy-policy', labelKey: 'pages.policy.linkPrivacy' },
  { href: '/home/refund-policy', labelKey: 'pages.policy.linkRefund' },
  { href: '/home/shipping-policy', labelKey: 'pages.policy.linkShipping' },
] as const;

const tableOfContents = [
  { href: '#merchant-details', labelKey: 'pages.policy.merchantDetails' },
  { href: '#scope', labelKey: 'pages.shipping.toc.scope' },
  { href: '#processing', labelKey: 'pages.shipping.toc.processing' },
  { href: '#destinations', labelKey: 'pages.shipping.toc.destinations' },
  { href: '#rates', labelKey: 'pages.shipping.toc.rates' },
  { href: '#carriers', labelKey: 'pages.shipping.toc.carriers' },
  { href: '#estimates', labelKey: 'pages.shipping.toc.estimates' },
  { href: '#addresses', labelKey: 'pages.shipping.toc.addresses' },
  { href: '#international', labelKey: 'pages.shipping.toc.international' },
  { href: '#lost-damaged', labelKey: 'pages.shipping.toc.lostDamaged' },
  { href: '#contact', labelKey: 'pages.shipping.toc.contact' },
] as const;

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
  const t = await getT();
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
        <a className={styles.skipLink} href="#policy-content">{t('pages.policy.skip')}</a>

        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol className={styles.breadcrumbList}>
            <li><Link className={styles.breadcrumbLink} href="/home">{t('pages.common.home')}</Link></li>
            <li aria-current="page">{t('pages.policy.linkShipping')}</li>
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
          <p className={styles.eyebrow}>{t('pages.shipping.eyebrow')}</p>
          <h1 className={styles.heroTitle} id="shipping-title">{t('pages.policy.linkShipping')}</h1>
          <p className={styles.lede}>
            {t('pages.shipping.lede', { merchantName })}
          </p>
          <div className={styles.heroMeta}>
            <span className={styles.lastUpdated}>{t('pages.policy.lastUpdated')} <time dateTime={LAST_UPDATED_ISO}>{LAST_UPDATED}</time></span>
            <PrintButton />
          </div>
        </header>

        <nav className={styles.policyNav} aria-label={t('pages.policy.navAria')}>
          <p className={styles.policyNavLabel} id="policy-navigation-label">{t('pages.policy.navLabel')}</p>
          <ul className={styles.policyNavList} aria-labelledby="policy-navigation-label">
            {policyLinks.map((policy) => {
              const isCurrent = policy.href === '/home/shipping-policy';

              return (
                <li key={policy.href}>
                  <Link
                    className={`${styles.policyNavLink} ${isCurrent ? styles.currentPolicy : ''}`}
                    href={policy.href}
                    aria-current={isCurrent ? 'page' : undefined}
                  >
                    {t(policy.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <details className={styles.mobileToc}>
          <summary className={styles.mobileTocSummary}>{t('pages.policy.onThisPage')}</summary>
          <nav aria-label={t('pages.policy.onThisPage')}>
            <ol className={styles.mobileTocList}>
              {tableOfContents.map((item) => (
                <li key={item.href}><a href={item.href}>{t(item.labelKey)}</a></li>
              ))}
            </ol>
          </nav>
        </details>

        <div className={styles.layout}>
          <nav className={styles.toc} aria-label={t('pages.policy.onThisPage')}>
            <p className={styles.tocTitle}>{t('pages.policy.onThisPage')}</p>
            <ol className={styles.tocList}>
              {tableOfContents.map((item) => (
                <li key={item.href}><a className={styles.tocLink} href={item.href}>{t(item.labelKey)}</a></li>
              ))}
            </ol>
          </nav>

          <article className={styles.content} id="policy-content" aria-labelledby="shipping-title">
            <aside className={styles.reviewNotice} role="note">
              <strong className={styles.noticeTitle}>{t('pages.shipping.noticeTitle')}</strong>
              {t('pages.shipping.noticeBody')}
            </aside>

            <section className={styles.merchantCard} id="merchant-details" aria-labelledby="merchant-details-title">
              <h2 id="merchant-details-title">{t('pages.shipping.merchantHeading')}</h2>
              <dl className={styles.merchantGrid}>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.policy.storeDisplayName')}</dt>
                  <dd className={styles.merchantValue}>{merchantName}</dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.policy.legalEntity')}</dt>
                  <dd className={styles.merchantValue}>
                    {legalEntityName || <span className={styles.placeholder}>[registered legal entity name to be confirmed]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.shipping.origin')}</dt>
                  <dd className={styles.merchantValue}>
                    {shippingOrigin || <span className={styles.placeholder}>[actual dispatch location or locations to be added]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.shipping.contact')}</dt>
                  <dd className={styles.merchantValue}>
                    {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : <span className={styles.placeholder}>[monitored shipping contact email to be added]</span>}
                  </dd>
                </div>
              </dl>
            </section>

            <div className={styles.prose}>
              <section className={styles.section} id="scope" aria-labelledby="scope-title">
                <h2 id="scope-title">{t('pages.shipping.h2.scope')}</h2>
                <p>
                  {t('pages.shipping.scopeProducts')}
                </p>
                <p>
                  {t('pages.shipping.scopeReturnsIntro')} <Link href="/home/refund-policy">{t('pages.policy.linkRefund')}</Link>.
                </p>
              </section>

              <section className={styles.section} id="processing" aria-labelledby="processing-title">
                <h2 id="processing-title">{t('pages.shipping.h2.processing')}</h2>
                <p>
                  {t('pages.shipping.processingParagraph')}
                </p>
                {processingTime ? (
                  <p><strong>{t('pages.shipping.processingTime')}</strong> {processingTime}</p>
                ) : (
                  <p><span className={styles.placeholder}>[insert the verified standard processing time and when the clock begins]</span></p>
                )}
                {dispatchTime ? (
                  <p><strong>{t('pages.shipping.dispatch')}</strong> {dispatchTime}</p>
                ) : (
                  <p><span className={styles.placeholder}>[state whether dispatch means leaving the warehouse, receiving a carrier scan, or another verified event]</span></p>
                )}
                {registeredAddress && <p><strong>{t('pages.shipping.registeredAddress')}</strong> {registeredAddress}</p>}
                <p>
                  {t('pages.shipping.processingSplit')} <span className={styles.placeholder}>[confirm split-shipment handling and any charges before promising combined delivery]</span>
                </p>
              </section>

              <section className={styles.section} id="destinations" aria-labelledby="destinations-title">
                <h2 id="destinations-title">{t('pages.shipping.h2.destinations')}</h2>
                {shippingDestinations ? (
                  <p>{shippingDestinations}</p>
                ) : (
                  <p><span className={styles.placeholder}>[list every supported destination by country and region, and any excluded territories]</span></p>
                )}
                <p>
                  {t('pages.shipping.destinationsLimits')}
                </p>
                <p><span className={styles.placeholder}>[confirm any PO-box, locker, military, island, remote-area, or forwarding-address restrictions only if they apply]</span></p>
              </section>

              <section className={styles.section} id="rates" aria-labelledby="rates-title">
                <h2 id="rates-title">{t('pages.shipping.h2.rates')}</h2>
                <p>
                  {t('pages.shipping.ratesDisplay')}
                </p>
                <p>
                  {t('pages.shipping.ratesSpecial')}
                </p>
                <p><span className={styles.placeholder}>[insert any actual free-delivery threshold, excluded delivery types, and surcharge rules; do not carry over legacy promotional claims]</span></p>
              </section>

              <section className={styles.section} id="carriers" aria-labelledby="carriers-title">
                <h2 id="carriers-title">{t('pages.shipping.h2.carriers')}</h2>
                <p>
                  {t('pages.shipping.carriersPartners')}
                </p>
                {carriers ? (
                  <p><strong>{t('pages.shipping.carriers')}</strong> {carriers}</p>
                ) : (
                  <p><span className={styles.placeholder}>[identify the actual carriers, service levels, and handover process for each destination]</span></p>
                )}
                <p>
                  {t('pages.shipping.carriersTracking')}
                </p>
              </section>

              <section className={styles.section} id="estimates" aria-labelledby="estimates-title">
                <h2 id="estimates-title">{t('pages.shipping.h2.estimates')}</h2>
                <p>
                  {t('pages.shipping.estimatesForecast')}
                </p>
                <p>
                  {t('pages.shipping.estimatesLate')}
                </p>
                <div className={styles.callout}>
                  <p>
                    <strong>{t('pages.shipping.operations')}</strong> <span className={styles.placeholder}>[add an approved delay-reporting and lost-parcel investigation process, with truthful service-level expectations]</span>
                  </p>
                </div>
              </section>

              <section className={styles.section} id="addresses" aria-labelledby="addresses-title">
                <h2 id="addresses-title">{t('pages.shipping.h2.addresses')}</h2>
                <p>
                  {t('pages.shipping.addressesResponsibility')}
                </p>
                <p>
                  {t('pages.shipping.addressesIncorrect')}
                </p>
              </section>

              <section className={styles.section} id="international" aria-labelledby="international-title">
                <h2 id="international-title">{t('pages.shipping.h2.international')}</h2>
                {internationalTerms ? (
                  <p>{internationalTerms}</p>
                ) : (
                  <p><span className={styles.placeholder}>[state whether international orders are accepted, which duties and taxes are prepaid or payable on arrival, and the responsible party]</span></p>
                )}
                <p>
                  {t('pages.shipping.internationalCharges', { merchantName })}
                </p>
                <p>
                  {t('pages.shipping.internationalRefunds')} <span className={styles.placeholder}>[insert the merchant’s verified customs and refused-parcel procedure]</span>
                </p>
              </section>

              <section className={styles.section} id="lost-damaged" aria-labelledby="lost-damaged-title">
                <h2 id="lost-damaged-title">{t('pages.shipping.h2.lostDamaged')}</h2>
                <p>
                  {t('pages.shipping.lostDamagedReport')}
                </p>
                <p>
                  {t('pages.shipping.lostDamagedCooperation')}
                </p>
                <p><span className={styles.placeholder}>[confirm the carrier claim window, merchant investigation steps, and any remedy hierarchy before publication]</span></p>
              </section>

              <section className={styles.section} id="contact" aria-labelledby="contact-title">
                <h2 id="contact-title">{t('pages.shipping.h2.contact')}</h2>
                <p>
                  {t('pages.shipping.contactIntro')} <Link href="/home/contact">{t('pages.policy.contactPage')}</Link>. {t('pages.shipping.contactFollowUp')}
                </p>
                <div className={styles.contactBlock}>
                  <p><strong>{t('pages.shipping.contactStrong', { merchantName })}</strong></p>
                  {legalEntityName && <p>{legalEntityName}</p>}
                  {contactEmail ? (
                    <p>{t('pages.policy.email')} <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
                  ) : (
                    <p>{t('pages.policy.email')} <span className={styles.placeholder}>[monitored shipping email to be added]</span></p>
                  )}
                  <p>{t('pages.shipping.returnsLead')} <Link href="/home/refund-policy">{t('pages.policy.linkRefund')}</Link>.</p>
                </div>
              </section>
            </div>

            <nav className={styles.related} aria-label={t('pages.policy.relatedAria')}>
              <h2 className={styles.relatedTitle}>{t('pages.policy.continueReading')}</h2>
              <div className={styles.relatedGrid}>
                <Link className={styles.relatedLink} href="/home/terms-conditions">
                  <span className={styles.relatedLabel}>{t('pages.policy.relatedPurchaseTerms')}</span>
                  <span>{t('pages.shipping.relatedTermsText')}</span>
                </Link>
                <Link className={styles.relatedLink} href="/home/refund-policy">
                  <span className={styles.relatedLabel}>{t('pages.shipping.relatedRefundLabel')}</span>
                  <span>{t('pages.shipping.relatedRefundText')}</span>
                </Link>
                <Link className={styles.relatedLink} href="/home/privacy-policy">
                  <span className={styles.relatedLabel}>{t('pages.policy.relatedDeliveryData')}</span>
                  <span>{t('pages.shipping.relatedPrivacyText')}</span>
                </Link>
              </div>
            </nav>

            <p className={styles.policyFooter}>{t('pages.shipping.footer')}</p>
          </article>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getContextCompany } from '@/lib/tenant';
import { getT } from '@/lib/i18n/server';
import styles from '../legal/legal.module.css';
import PrintButton from './PrintButton';
import ShopPageHeader from '../components/ShopPageHeader';

const LAST_UPDATED = 'September 23, 2026';
const LAST_UPDATED_ISO = '2026-09-23';

const description =
  'Read the terms that apply when browsing, ordering, paying for, or receiving products from this storefront.';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description,
  alternates: {
    canonical: '/home/terms-conditions',
  },
  openGraph: {
    title: 'Terms & Conditions',
    description,
    url: '/home/terms-conditions',
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
  { href: '#about-these-terms', labelKey: 'pages.terms.toc.about' },
  { href: '#orders', labelKey: 'pages.terms.toc.orders' },
  { href: '#products-prices', labelKey: 'pages.terms.toc.products' },
  { href: '#delivery', labelKey: 'pages.terms.toc.delivery' },
  { href: '#returns', labelKey: 'pages.terms.toc.returns' },
  { href: '#customer-responsibilities', labelKey: 'pages.terms.toc.responsibilities' },
  { href: '#intellectual-property', labelKey: 'pages.terms.toc.ip' },
  { href: '#consumer-rights', labelKey: 'pages.terms.toc.consumerRights' },
  { href: '#liability', labelKey: 'pages.terms.toc.liability' },
  { href: '#changes', labelKey: 'pages.terms.toc.changes' },
  { href: '#governing-law', labelKey: 'pages.terms.toc.governingLaw' },
  { href: '#contact', labelKey: 'pages.terms.toc.contact' },
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

export default async function TermsConditionsPage() {
  const t = await getT();
  const merchantName = await getMerchantName();
  const legalEntityName = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim();
  const registeredAddress = process.env.NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS?.trim();
  const contactEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();
  const governingLaw = process.env.NEXT_PUBLIC_GOVERNING_LAW?.trim();

  return (
    <div className={styles.page}>
      <ShopPageHeader
        title={t('pages.policy.linkTerms')}
        titleId="terms-title"
        crumbs={[{ label: t('pages.policy.linkTerms') }]}
        eyebrow={t('pages.terms.eyebrow')}
        lead={t('pages.terms.lede', { merchantName })}
      >
        <div className={styles.heroMeta}>
          <span className={styles.lastUpdated}>{t('pages.policy.lastUpdated')} <time dateTime={LAST_UPDATED_ISO}>{LAST_UPDATED}</time></span>
          <PrintButton />
        </div>
      </ShopPageHeader>
      <div className={styles.container}>
        <a className={styles.skipLink} href="#policy-content">{t('pages.policy.skip')}</a>


        <nav className={styles.policyNav} aria-label={t('pages.policy.navAria')}>
          <p className={styles.policyNavLabel} id="policy-navigation-label">{t('pages.policy.navLabel')}</p>
          <ul className={styles.policyNavList} aria-labelledby="policy-navigation-label">
            {policyLinks.map((policy) => {
              const isCurrent = policy.href === '/home/terms-conditions';

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

          <article className={styles.content} id="policy-content" aria-labelledby="terms-title">
            <aside className={styles.reviewNotice} role="note">
              <strong className={styles.noticeTitle}>{t('pages.policy.merchantConfig')}</strong>
              {t('pages.terms.noticeBody')}
            </aside>

            <section className={styles.merchantCard} id="merchant-details" aria-labelledby="merchant-details-title">
              <h2 id="merchant-details-title">{t('pages.policy.merchantDetails')}</h2>
              <dl className={styles.merchantGrid}>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.policy.storeDisplayName')}</dt>
                  <dd className={styles.merchantValue}>{merchantName}</dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.terms.registeredEntity')}</dt>
                  <dd className={styles.merchantValue}>
                    {legalEntityName || <span className={styles.placeholder}>[legal entity name to be confirmed]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.policy.registeredAddress')}</dt>
                  <dd className={styles.merchantValue}>
                    {registeredAddress || <span className={styles.placeholder}>[registered business address to be added]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.terms.legalEmail')}</dt>
                  <dd className={styles.merchantValue}>
                    {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : <span className={styles.placeholder}>[monitored legal contact email to be added]</span>}
                  </dd>
                </div>
              </dl>
            </section>

            <div className={styles.prose}>
              <section className={styles.section} id="about-these-terms" aria-labelledby="about-these-terms-title">
                <h2 id="about-these-terms-title">{t('pages.terms.h2.about')}</h2>
                <p>
                  {t('pages.terms.aboutP1', { merchantName })}
                </p>
                <p>
                  {t('pages.terms.aboutP2')}
                </p>
              </section>

              <section className={styles.section} id="orders" aria-labelledby="orders-title">
                <h2 id="orders-title">{t('pages.terms.h2.orders')}</h2>
                <p>
                  {t('pages.terms.ordersOffer', { merchantName })}
                </p>
                <p>
                  {t('pages.terms.ordersDecline')}
                </p>
                <p>
                  {t('pages.terms.ordersContact')}
                </p>
              </section>

              <section className={styles.section} id="products-prices" aria-labelledby="products-prices-title">
                <h2 id="products-prices-title">{t('pages.terms.h2.products')}</h2>
                <h3>{t('pages.terms.h3.productInfo')}</h3>
                <p>
                  {t('pages.terms.productInfoParagraph')}
                </p>

                <h3>{t('pages.terms.h3.price')}</h3>
                <p>
                  {t('pages.terms.priceParagraph')}
                </p>

                <h3>{t('pages.terms.h3.payment')}</h3>
                <p>
                  {t('pages.terms.paymentParagraph')}
                </p>
              </section>

              <section className={styles.section} id="delivery" aria-labelledby="delivery-title">
                <h2 id="delivery-title">{t('pages.terms.h2.delivery')}</h2>
                <p>
                  {t('pages.terms.deliveryTermsIntro')} <Link href="/home/shipping-policy">{t('pages.policy.linkShipping')}</Link> {t('pages.terms.deliveryTermsRest')}
                </p>
                <p>
                  {t('pages.terms.deliveryResponsibility')}
                </p>
              </section>

              <section className={styles.section} id="returns" aria-labelledby="returns-title">
                <h2 id="returns-title">{t('pages.terms.h2.returns')}</h2>
                <p>
                  {t('pages.terms.returnsIntro')} <Link href="/home/refund-policy">{t('pages.policy.linkRefund')}</Link> {t('pages.terms.returnsRest')}
                </p>
                <p>
                  {t('pages.terms.returnsCancellation')}
                </p>
              </section>

              <section className={styles.section} id="customer-responsibilities" aria-labelledby="customer-responsibilities-title">
                <h2 id="customer-responsibilities-title">{t('pages.terms.h2.responsibilities')}</h2>
                <p>{t('pages.terms.responsibilitiesLead')}</p>
                <ul className={styles.checklist}>
                  <li>{t('pages.terms.responsibilitiesList1')}</li>
                  <li>{t('pages.terms.responsibilitiesList2')}</li>
                  <li>{t('pages.terms.responsibilitiesList3')}</li>
                  <li>{t('pages.terms.responsibilitiesList4')}</li>
                  <li>{t('pages.terms.responsibilitiesList5')}</li>
                </ul>
                <p>
                  {t('pages.terms.responsibilitiesRestriction')}
                </p>
              </section>

              <section className={styles.section} id="intellectual-property" aria-labelledby="intellectual-property-title">
                <h2 id="intellectual-property-title">{t('pages.terms.h2.ip')}</h2>
                <p>
                  {t('pages.terms.ipParagraph1', { merchantName })}
                </p>
                <p>
                  {t('pages.terms.ipParagraph2')}
                </p>
              </section>

              <section className={styles.section} id="consumer-rights" aria-labelledby="consumer-rights-title">
                <h2 id="consumer-rights-title">{t('pages.terms.h2.consumerRights')}</h2>
                <p>
                  {t('pages.terms.consumerRightsWarranties')}
                </p>
                <div className={styles.callout}>
                  <p>
                    <strong>{t('pages.terms.merchantInput')}</strong> <span className={styles.placeholder}>[add any product-specific warranty, expiry statement, care condition, or other condition of sale that is actually offered]</span>
                  </p>
                </div>
                <p>
                  {t('pages.terms.consumerRightsRemedies')}
                </p>
              </section>

              <section className={styles.section} id="liability" aria-labelledby="liability-title">
                <h2 id="liability-title">{t('pages.terms.h2.liability')}</h2>
                <p>
                  {t('pages.terms.liabilityScope', { merchantName })}
                </p>
                <p>
                  {t('pages.terms.liabilityExclusions')}
                </p>
              </section>

              <section className={styles.section} id="changes" aria-labelledby="changes-title">
                <h2 id="changes-title">{t('pages.terms.h2.changes')}</h2>
                <p>
                  {t('pages.terms.changesUpdates')}
                </p>
                <p>
                  {t('pages.terms.changesHistory')} <span className={styles.placeholder}>[decide whether a public version history is required]</span>
                </p>
              </section>

              <section className={styles.section} id="governing-law" aria-labelledby="governing-law-title">
                <h2 id="governing-law-title">{t('pages.terms.h2.governingLaw')}</h2>
                <p>
                  {t('pages.terms.governingLawIntro')} {governingLaw || <span className={styles.placeholder}>[insert governing law, jurisdiction, and any lawful dispute-resolution process only after legal review]</span>}
                </p>
                <p>
                  {t('pages.terms.governingLawRemedies')}
                </p>
              </section>

              <section className={styles.section} id="contact" aria-labelledby="contact-title">
                <h2 id="contact-title">{t('pages.terms.h2.contact')}</h2>
                <p>
                  {t('pages.terms.contactIntro')}
                </p>
                <div className={styles.contactBlock}>
                  <p><strong>{merchantName}</strong></p>
                  {legalEntityName && <p>{legalEntityName}</p>}
                  {registeredAddress && <p>{registeredAddress}</p>}
                  {contactEmail ? (
                    <p>{t('pages.policy.email')} <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
                  ) : (
                    <p>{t('pages.policy.email')} <span className={styles.placeholder}>[monitored legal contact email to be added]</span></p>
                  )}
                  <p>{t('pages.terms.generalEnquiries')} <Link href="/home/contact">{t('pages.policy.contactUs')}</Link>.</p>
                </div>
              </section>
            </div>

            <nav className={styles.related} aria-label={t('pages.policy.relatedAria')}>
              <h2 className={styles.relatedTitle}>{t('pages.policy.continueReading')}</h2>
              <div className={styles.relatedGrid}>
                <Link className={styles.relatedLink} href="/home/privacy-policy">
                  <span className={styles.relatedLabel}>{t('pages.terms.relatedPrivacyLabel')}</span>
                  <span>{t('pages.terms.relatedPrivacyText')}</span>
                </Link>
                <Link className={styles.relatedLink} href="/home/refund-policy">
                  <span className={styles.relatedLabel}>{t('pages.terms.relatedRefundLabel')}</span>
                  <span>{t('pages.terms.relatedRefundText')}</span>
                </Link>
                <Link className={styles.relatedLink} href="/home/shipping-policy">
                  <span className={styles.relatedLabel}>{t('pages.terms.relatedShippingLabel')}</span>
                  <span>{t('pages.terms.relatedShippingText')}</span>
                </Link>
              </div>
            </nav>

            <p className={styles.policyFooter}>{t('pages.terms.footer')}</p>
          </article>
        </div>
      </div>
    </div>
  );
}

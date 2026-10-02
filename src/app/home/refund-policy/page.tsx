import type { Metadata } from 'next';
import Link from 'next/link';
import { getContextCompany } from '@/lib/tenant';
import { getT } from '@/lib/i18n/server';
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
    canonical: '/home/refund-policy',
  },
  openGraph: {
    title: 'Refund Policy',
    description,
    url: '/home/refund-policy',
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
  { href: '#scope', labelKey: 'pages.refund.toc.scope' },
  { href: '#eligibility', labelKey: 'pages.refund.toc.eligibility' },
  { href: '#exclusions', labelKey: 'pages.refund.toc.exclusions' },
  { href: '#request', labelKey: 'pages.refund.toc.request' },
  { href: '#returning', labelKey: 'pages.refund.toc.returning' },
  { href: '#inspection', labelKey: 'pages.refund.toc.inspection' },
  { href: '#refund', labelKey: 'pages.refund.toc.refund' },
  { href: '#exchanges', labelKey: 'pages.refund.toc.exchanges' },
  { href: '#problems', labelKey: 'pages.refund.toc.problems' },
  { href: '#cancellation', labelKey: 'pages.refund.toc.cancellation' },
  { href: '#consumer-rights', labelKey: 'pages.refund.toc.consumerRights' },
  { href: '#contact', labelKey: 'pages.refund.toc.contact' },
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

export default async function RefundPolicyPage() {
  const t = await getT();
  const merchantName = await getMerchantName();
  const legalEntityName = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim();
  const registeredAddress = process.env.NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS?.trim();
  const contactEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();
  const returnWindow = process.env.NEXT_PUBLIC_RETURN_WINDOW?.trim();
  const returnShippingPolicy = process.env.NEXT_PUBLIC_RETURN_SHIPPING_POLICY?.trim();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <a className={styles.skipLink} href="#policy-content">{t('pages.policy.skip')}</a>

        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol className={styles.breadcrumbList}>
            <li><Link className={styles.breadcrumbLink} href="/home">{t('pages.common.home')}</Link></li>
            <li aria-current="page">{t('pages.policy.linkRefund')}</li>
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
          <p className={styles.eyebrow}>{t('pages.refund.eyebrow')}</p>
          <h1 className={styles.heroTitle} id="refund-title">{t('pages.policy.linkRefund')}</h1>
          <p className={styles.lede}>
            {t('pages.refund.lede', { merchantName })}
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
              const isCurrent = policy.href === '/home/refund-policy';

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

          <article className={styles.content} id="policy-content" aria-labelledby="refund-title">
            <aside className={styles.reviewNotice} role="note">
              <strong className={styles.noticeTitle}>{t('pages.policy.merchantConfig')}</strong>
              {t('pages.refund.noticeBody')}
            </aside>

            <section className={styles.merchantCard} id="merchant-details" aria-labelledby="merchant-details-title">
              <h2 id="merchant-details-title">{t('pages.policy.merchantDetails')}</h2>
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
                  <dt className={styles.merchantLabel}>{t('pages.policy.registeredAddress')}</dt>
                  <dd className={styles.merchantValue}>
                    {registeredAddress || <span className={styles.placeholder}>[registered business address to be added]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.refund.returnsContact')}</dt>
                  <dd className={styles.merchantValue}>
                    {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : <span className={styles.placeholder}>[monitored returns email to be added]</span>}
                  </dd>
                </div>
              </dl>
            </section>

            <div className={styles.prose}>
              <section className={styles.section} id="scope" aria-labelledby="scope-title">
                <h2 id="scope-title">{t('pages.refund.h2.scope')}</h2>
                <p>
                  {t('pages.refund.scopeIntro', { merchantName })} <Link href="/home/shipping-policy">{t('pages.policy.linkShipping')}</Link>{t('pages.refund.scopeMiddle')} <Link href="/home/terms-conditions">{t('pages.policy.linkTerms')}</Link>.
                </p>
                <p>
                  {t('pages.refund.scopeRights')}
                </p>
              </section>

              <section className={styles.section} id="eligibility" aria-labelledby="eligibility-title">
                <h2 id="eligibility-title">{t('pages.refund.h2.eligibility')}</h2>
                <p>
                  {t('pages.refund.eligibilityParagraph')}
                </p>
                {returnWindow ? (
                  <p><strong>{t('pages.refund.returnWindow')}</strong> {returnWindow}</p>
                ) : (
                  <p><span className={styles.placeholder}>[state the merchant-approved return window, when it begins, and any proof-of-purchase requirement]</span></p>
                )}
                <p>
                  {t('pages.refund.eligibilityContact')}
                </p>
              </section>

              <section className={styles.section} id="exclusions" aria-labelledby="exclusions-title">
                <h2 id="exclusions-title">{t('pages.refund.h2.exclusions')}</h2>
                <p>
                  {t('pages.refund.exclusionsLead')}
                </p>
                <ul className={styles.list}>
                  <li>{t('pages.refund.exclusionsList1')}</li>
                  <li>{t('pages.refund.exclusionsList2')}</li>
                  <li>{t('pages.refund.exclusionsList3')}</li>
                  <li>{t('pages.refund.exclusionsList4')}</li>
                  <li>{t('pages.refund.exclusionsList5')}</li>
                  <li>{t('pages.refund.exclusionsList6')}</li>
                  <li>{t('pages.refund.exclusionsList7')}</li>
                </ul>
                <div className={styles.callout}>
                  <p>
                    <strong>{t('pages.refund.inventoryCheck')}</strong> <span className={styles.placeholder}>[list the exact product categories, seals, and exclusions that this store sells; remove categories that are not offered]</span>
                  </p>
                </div>
              </section>

              <section className={styles.section} id="request" aria-labelledby="request-title">
                <h2 id="request-title">{t('pages.refund.h2.request')}</h2>
                <p>{t('pages.refund.requestLead')} <Link href="/home/contact">{t('pages.policy.contactPage')}</Link>:</p>
                <ol className={styles.list}>
                  <li>{t('pages.refund.requestList1')}</li>
                  <li>{t('pages.refund.requestList2')}</li>
                  <li>{t('pages.refund.requestList3')}</li>
                  <li>{t('pages.refund.requestList4')}</li>
                  <li>{t('pages.refund.requestList5')}</li>
                </ol>
                <p>
                  {t('pages.refund.requestWarning')}
                </p>
              </section>

              <section className={styles.section} id="returning" aria-labelledby="returning-title">
                <h2 id="returning-title">{t('pages.refund.h2.returning')}</h2>
                <p>
                  {t('pages.refund.returningInstructions')}
                </p>
                <p>
                  {t('pages.refund.returningTracked')}
                </p>
                {returnShippingPolicy ? (
                  <p><strong>{t('pages.refund.returnPostage')}</strong> {returnShippingPolicy}</p>
                ) : (
                  <p><span className={styles.placeholder}>[state who pays return postage and when reimbursement, if any, may be available]</span></p>
                )}
              </section>

              <section className={styles.section} id="inspection" aria-labelledby="inspection-title">
                <h2 id="inspection-title">{t('pages.refund.h2.inspection')}</h2>
                <p>
                  {t('pages.refund.inspectionCheck')}
                </p>
                <p>
                  {t('pages.refund.inspectionDecision')}
                </p>
                <p><span className={styles.placeholder}>[define the approved inspection method and any target decision time without promising an unverified deadline]</span></p>
              </section>

              <section className={styles.section} id="refund" aria-labelledby="refund-title-heading">
                <h2 id="refund-title-heading">{t('pages.refund.h2.refund')}</h2>
                <p>
                  {t('pages.refund.refundAmount')}
                </p>
                <p>
                  {t('pages.refund.refundMethod')}
                </p>
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <caption>{t('pages.refund.tableCaption')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('pages.refund.thSituation')}</th>
                        <th scope="col">{t('pages.refund.thTreatment')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{t('pages.refund.tableRowEligibleSituation')}</td>
                        <td>{t('pages.refund.tableRowEligibleTreatment')}</td>
                      </tr>
                      <tr>
                        <td>{t('pages.refund.tableRowDeliverySituation')}</td>
                        <td>{t('pages.refund.tableRowDeliveryTreatment')}</td>
                      </tr>
                      <tr>
                        <td>{t('pages.refund.tableRowDiscountSituation')}</td>
                        <td>{t('pages.refund.tableRowDiscountTreatment')}</td>
                      </tr>
                      <tr>
                        <td>{t('pages.refund.tableRowDamagedSituation')}</td>
                        <td>{t('pages.refund.tableRowDamagedTreatment')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p><span className={styles.placeholder}>[confirm actual refund components, deductions, fraud checks, and whether a store credit option is offered]</span></p>
              </section>

              <section className={styles.section} id="exchanges" aria-labelledby="exchanges-title">
                <h2 id="exchanges-title">{t('pages.refund.h2.exchanges')}</h2>
                <p>
                  {t('pages.refund.exchangesPricing')}
                </p>
                <p>
                  {t('pages.refund.exchangesNotGuaranteed')} <span className={styles.placeholder}>[confirm whether this store offers exchanges and any price-adjustment terms]</span>
                </p>
              </section>

              <section className={styles.section} id="problems" aria-labelledby="problems-title">
                <h2 id="problems-title">{t('pages.refund.h2.problems')}</h2>
                <p>
                  {t('pages.refund.problemsReport')}
                </p>
                <p>
                  {t('pages.refund.problemsPromptly')} <span className={styles.placeholder}>[insert a verified reporting deadline only if one has been approved]</span>.
                </p>
              </section>

              <section className={styles.section} id="cancellation" aria-labelledby="cancellation-title">
                <h2 id="cancellation-title">{t('pages.refund.h2.cancellation')}</h2>
                <p>
                  {t('pages.refund.cancellationRequest', { merchantName })}
                </p>
                <p>
                  {t('pages.refund.cancellationMandatory')} <span className={styles.placeholder}>[add a cancellation cut-off only after operations confirms the actual fulfilment workflow]</span>
                </p>
              </section>

              <section className={styles.section} id="consumer-rights" aria-labelledby="consumer-rights-title">
                <h2 id="consumer-rights-title">{t('pages.refund.h2.consumerRights')}</h2>
                <p>
                  {t('pages.refund.consumerRightsProcess')}
                </p>
                <p>
                  {t('pages.refund.consumerRightsChargeback')}
                </p>
              </section>

              <section className={styles.section} id="contact" aria-labelledby="contact-title">
                <h2 id="contact-title">{t('pages.refund.h2.contact')}</h2>
                <p>
                  {t('pages.refund.contactParagraph')}
                </p>
                <div className={styles.contactBlock}>
                  <p><strong>{t('pages.refund.contactStrong', { merchantName })}</strong></p>
                  {legalEntityName && <p>{legalEntityName}</p>}
                  {contactEmail ? (
                    <p>{t('pages.policy.email')} <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
                  ) : (
                    <p>{t('pages.policy.email')} <span className={styles.placeholder}>[monitored returns email to be added]</span></p>
                  )}
                  <p>{t('pages.refund.enquiriesLead')} <Link href="/home/contact">{t('pages.policy.contactUs')}</Link>.</p>
                </div>
              </section>
            </div>

            <nav className={styles.related} aria-label={t('pages.policy.relatedAria')}>
              <h2 className={styles.relatedTitle}>{t('pages.policy.continueReading')}</h2>
              <div className={styles.relatedGrid}>
                <Link className={styles.relatedLink} href="/home/terms-conditions">
                  <span className={styles.relatedLabel}>{t('pages.refund.relatedOrderLabel')}</span>
                  <span>{t('pages.refund.relatedOrderText')}</span>
                </Link>
                <Link className={styles.relatedLink} href="/home/shipping-policy">
                  <span className={styles.relatedLabel}>{t('pages.refund.relatedShippingLabel')}</span>
                  <span>{t('pages.refund.relatedShippingText')}</span>
                </Link>
                <Link className={styles.relatedLink} href="/home/privacy-policy">
                  <span className={styles.relatedLabel}>{t('pages.refund.relatedPrivacyLabel')}</span>
                  <span>{t('pages.refund.relatedPrivacyText')}</span>
                </Link>
              </div>
            </nav>

            <p className={styles.policyFooter}>{t('pages.refund.footer')}</p>
          </article>
        </div>
      </div>
    </div>
  );
}

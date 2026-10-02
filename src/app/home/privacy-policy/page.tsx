import type { Metadata } from 'next';
import Link from 'next/link';
import { getContextCompany } from '@/lib/tenant';
import { getT } from '@/lib/i18n/server';
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
    canonical: '/home/privacy-policy',
  },
  openGraph: {
    title: 'Privacy Policy',
    description,
    url: '/home/privacy-policy',
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
  { href: '#merchant-details', labelKey: 'pages.privacy.toc.controllerDetails' },
  { href: '#scope', labelKey: 'pages.privacy.toc.scope' },
  { href: '#information', labelKey: 'pages.privacy.toc.information' },
  { href: '#use', labelKey: 'pages.privacy.toc.use' },
  { href: '#legal-bases', labelKey: 'pages.privacy.toc.legalBases' },
  { href: '#cookies', labelKey: 'pages.privacy.toc.cookies' },
  { href: '#sharing', labelKey: 'pages.privacy.toc.sharing' },
  { href: '#international', labelKey: 'pages.privacy.toc.international' },
  { href: '#retention', labelKey: 'pages.privacy.toc.retention' },
  { href: '#security', labelKey: 'pages.privacy.toc.security' },
  { href: '#rights', labelKey: 'pages.privacy.toc.rights' },
  { href: '#automated-decisions', labelKey: 'pages.privacy.toc.automatedDecisions' },
  { href: '#children', labelKey: 'pages.privacy.toc.children' },
  { href: '#changes', labelKey: 'pages.privacy.toc.changes' },
  { href: '#contact', labelKey: 'pages.privacy.toc.contact' },
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

export default async function PrivacyPolicyPage() {
  const t = await getT();
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
        <a className={styles.skipLink} href="#policy-content">{t('pages.policy.skip')}</a>

        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol className={styles.breadcrumbList}>
            <li><Link className={styles.breadcrumbLink} href="/home">{t('pages.common.home')}</Link></li>
            <li aria-current="page">{t('pages.policy.linkPrivacy')}</li>
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
          <p className={styles.eyebrow}>{t('pages.policy.customerInfo')}</p>
          <h1 className={styles.heroTitle} id="privacy-title">{t('pages.policy.linkPrivacy')}</h1>
          <p className={styles.lede}>
            {t('pages.privacy.lede', { merchantName })}
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
              const isCurrent = policy.href === '/home/privacy-policy';

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

          <article className={styles.content} id="policy-content" aria-labelledby="privacy-title">
            <aside className={styles.reviewNotice} role="note">
              <strong className={styles.noticeTitle}>{t('pages.privacy.noticeTitle')}</strong>
              {t('pages.privacy.noticeBody')}
            </aside>

            <section className={styles.merchantCard} id="merchant-details" aria-labelledby="merchant-details-title">
              <h2 id="merchant-details-title">{t('pages.privacy.toc.controllerDetails')}</h2>
              <dl className={styles.merchantGrid}>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.policy.storeDisplayName')}</dt>
                  <dd className={styles.merchantValue}>{merchantName}</dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.privacy.dataController')}</dt>
                  <dd className={styles.merchantValue}>
                    {legalEntityName || <span className={styles.placeholder}>[controller’s registered legal name to be confirmed]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.policy.registeredAddress')}</dt>
                  <dd className={styles.merchantValue}>
                    {registeredAddress || <span className={styles.placeholder}>[controller’s registered address to be added]</span>}
                  </dd>
                </div>
                <div className={styles.merchantItem}>
                  <dt className={styles.merchantLabel}>{t('pages.privacy.privacyContact')}</dt>
                  <dd className={styles.merchantValue}>
                    {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : <span className={styles.placeholder}>[monitored privacy contact email to be added]</span>}
                  </dd>
                </div>
              </dl>
            </section>

            <div className={styles.prose}>
              <section className={styles.section} id="scope" aria-labelledby="scope-title">
                <h2 id="scope-title">{t('pages.privacy.h2.scope')}</h2>
                <p>
                  {t('pages.privacy.scopePolicyIntro', { merchantName })}
                </p>
                <p>
                  {t('pages.privacy.scopeControllerRole')}
                </p>
              </section>

              <section className={styles.section} id="information" aria-labelledby="information-title">
                <h2 id="information-title">{t('pages.privacy.h2.information')}</h2>
                <p>{t('pages.privacy.infoLead')}</p>
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <caption>{t('pages.privacy.tableCaption')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('pages.privacy.thCategory')}</th>
                        <th scope="col">{t('pages.privacy.thExamples')}</th>
                        <th scope="col">{t('pages.privacy.thWhen')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>{t('pages.privacy.tableRowIdentityCategory')}</strong></td>
                        <td>{t('pages.privacy.tableRowIdentityExamples')}</td>
                        <td>{t('pages.privacy.tableRowIdentityWhen')}</td>
                      </tr>
                      <tr>
                        <td><strong>{t('pages.privacy.tableRowOrderCategory')}</strong></td>
                        <td>{t('pages.privacy.tableRowOrderExamples')}</td>
                        <td>{t('pages.privacy.tableRowOrderWhen')}</td>
                      </tr>
                      <tr>
                        <td><strong>{t('pages.privacy.tableRowPaymentCategory')}</strong></td>
                        <td>{t('pages.privacy.tableRowPaymentExamples')}</td>
                        <td>{t('pages.privacy.tableRowPaymentWhen')}</td>
                      </tr>
                      <tr>
                        <td><strong>{t('pages.privacy.tableRowDeviceCategory')}</strong></td>
                        <td>{t('pages.privacy.tableRowDeviceExamples')}</td>
                        <td>{t('pages.privacy.tableRowDeviceWhen')}</td>
                      </tr>
                      <tr>
                        <td><strong>{t('pages.privacy.tableRowCommunicationsCategory')}</strong></td>
                        <td>{t('pages.privacy.tableRowCommunicationsExamples')}</td>
                        <td>{t('pages.privacy.tableRowCommunicationsWhen')}</td>
                      </tr>
                      <tr>
                        <td><strong>{t('pages.privacy.tableRowMarketingCategory')}</strong></td>
                        <td>{t('pages.privacy.tableRowMarketingExamples')}</td>
                        <td>{t('pages.privacy.tableRowMarketingWhen')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>
                  {t('pages.privacy.infoSensitiveWarning')}
                </p>
              </section>

              <section className={styles.section} id="use" aria-labelledby="use-title">
                <h2 id="use-title">{t('pages.privacy.h2.use')}</h2>
                <p>{t('pages.privacy.useLead')}</p>
                <ul className={styles.list}>
                  <li>{t('pages.privacy.useList1')}</li>
                  <li>{t('pages.privacy.useList2')}</li>
                  <li>{t('pages.privacy.useList3')}</li>
                  <li>{t('pages.privacy.useList4')}</li>
                  <li>{t('pages.privacy.useList5')}</li>
                  <li>{t('pages.privacy.useList6')}</li>
                </ul>
                <p>
                  {t('pages.privacy.useIncompatible')}
                </p>
              </section>

              <section className={styles.section} id="legal-bases" aria-labelledby="legal-bases-title">
                <h2 id="legal-bases-title">{t('pages.privacy.h2.legalBases')}</h2>
                <p>{t('pages.privacy.basisLead')}</p>
                <ul className={styles.list}>
                  <li><strong>{t('pages.privacy.basisContractLabel')}</strong> {t('pages.privacy.basisContractText')}</li>
                  <li><strong>{t('pages.privacy.basisLegalObligationLabel')}</strong> {t('pages.privacy.basisLegalObligationText')}</li>
                  <li><strong>{t('pages.privacy.basisLegitimateInterestsLabel')}</strong> {t('pages.privacy.basisLegitimateInterestsText')}</li>
                  <li><strong>{t('pages.privacy.basisConsentLabel')}</strong> {t('pages.privacy.basisConsentText')}</li>
                  <li><strong>{t('pages.privacy.basisVitalInterestsLabel')}</strong> {t('pages.privacy.basisVitalInterestsText')}</li>
                </ul>
                <div className={styles.callout}>
                  <p>
                    <strong>{t('pages.privacy.legalReview')}</strong> <span className={styles.placeholder}>[confirm the specific basis for each processing purpose and any balancing test relied on]</span>
                  </p>
                </div>
              </section>

              <section className={styles.section} id="cookies" aria-labelledby="cookies-title">
                <h2 id="cookies-title">{t('pages.privacy.h2.cookies')}</h2>
                <p>
                  {t('pages.privacy.cookiesStrictlyNecessary')}
                </p>
                <p>
                  {t('pages.privacy.cookiesOptional')}
                </p>
                {cookieDetails ? (
                  <p>{cookieDetails}</p>
                ) : (
                  <p><span className={styles.placeholder}>[inventory all cookies and similar technologies, including name, purpose, provider, and duration]</span></p>
                )}
                <p>
                  {t('pages.privacy.cookiesBrowserControls')}
                </p>
              </section>

              <section className={styles.section} id="sharing" aria-labelledby="sharing-title">
                <h2 id="sharing-title">{t('pages.privacy.h2.sharing')}</h2>
                <p>{t('pages.privacy.sharingLead')}</p>
                <ul className={styles.list}>
                  <li>{t('pages.privacy.sharingList1')}</li>
                  <li>{t('pages.privacy.sharingList2')}</li>
                  <li>{t('pages.privacy.sharingList3')}</li>
                  <li>{t('pages.privacy.sharingList4')}</li>
                  <li>{t('pages.privacy.sharingList5')}</li>
                  <li>{t('pages.privacy.sharingList6')}</li>
                </ul>
                <p>
                  {t('pages.privacy.sharingProviders')} <span className={styles.placeholder}>[add the actual material processor and subprocessor list after vendors are approved]</span>
                </p>
              </section>

              <section className={styles.section} id="international" aria-labelledby="international-title">
                <h2 id="international-title">{t('pages.privacy.h2.international')}</h2>
                <p>
                  {t('pages.privacy.internationalTransfers')}
                </p>
                <p><span className={styles.placeholder}>[identify relevant transfer countries, legal mechanisms, and how to request transfer information]</span></p>
              </section>

              <section className={styles.section} id="retention" aria-labelledby="retention-title">
                <h2 id="retention-title">{t('pages.privacy.h2.retention')}</h2>
                <p>
                  {t('pages.privacy.retentionParagraph')}
                </p>
                {retentionSchedule ? (
                  <p>{retentionSchedule}</p>
                ) : (
                  <p><span className={styles.placeholder}>[confirm concrete retention periods for account, order, support, payment, security, consent, and marketing records]</span></p>
                )}
              </section>

              <section className={styles.section} id="security" aria-labelledby="security-title">
                <h2 id="security-title">{t('pages.privacy.h2.security')}</h2>
                <p>
                  {t('pages.privacy.securityMeasures')}
                </p>
                <p>
                  {t('pages.privacy.securityPassword')}
                </p>
              </section>

              <section className={styles.section} id="rights" aria-labelledby="rights-title">
                <h2 id="rights-title">{t('pages.privacy.h2.rights')}</h2>
                <p>{t('pages.privacy.rightsLead')}</p>
                <ul className={styles.checklist}>
                  <li>{t('pages.privacy.rightsList1')}</li>
                  <li>{t('pages.privacy.rightsList2')}</li>
                  <li>{t('pages.privacy.rightsList3')}</li>
                  <li>{t('pages.privacy.rightsList4')}</li>
                  <li>{t('pages.privacy.rightsList5')}</li>
                  <li>{t('pages.privacy.rightsList6')}</li>
                </ul>
                <p>
                  {t('pages.privacy.rightsLimits')}
                </p>
                <div className={styles.callout}>
                  <p>
                    <strong>{t('pages.privacy.jurisdictionCheck')}</strong> <span className={styles.placeholder}>[confirm whether the right to object, portability, automated decision-making, direct marketing, “sale”/“sharing”, or similar concepts apply]</span>
                  </p>
                </div>
              </section>

              <section className={styles.section} id="automated-decisions" aria-labelledby="automated-decisions-title">
                <h2 id="automated-decisions-title">{t('pages.privacy.h2.automatedDecisions')}</h2>
                <p>
                  {t('pages.privacy.automatedDecisionsParagraph')}
                </p>
                <p><span className={styles.placeholder}>[confirm that no significant automated-only decision or profiling is used, or describe each approved use and safeguard]</span></p>
              </section>

              <section className={styles.section} id="children" aria-labelledby="children-title">
                <h2 id="children-title">{t('pages.privacy.h2.children')}</h2>
                <p>
                  {t('pages.privacy.childrenParagraph')}
                </p>
                <p><span className={styles.placeholder}>[insert the verified minimum age for each target market if a child threshold applies]</span></p>
              </section>

              <section className={styles.section} id="changes" aria-labelledby="changes-title">
                <h2 id="changes-title">{t('pages.privacy.h2.changes')}</h2>
                <p>
                  {t('pages.privacy.changesParagraph')}
                </p>
              </section>

              <section className={styles.section} id="contact" aria-labelledby="contact-title">
                <h2 id="contact-title">{t('pages.privacy.h2.contact')}</h2>
                <p>
                  {t('pages.privacy.contactParagraph')}
                </p>
                <div className={styles.contactBlock}>
                  <p><strong>{t('pages.privacy.contactStrong', { merchantName })}</strong></p>
                  {legalEntityName && <p>{legalEntityName}</p>}
                  {registeredAddress && <p>{registeredAddress}</p>}
                  {contactEmail ? (
                    <p><a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
                  ) : (
                    <p><span className={styles.placeholder}>[monitored privacy contact email to be added]</span></p>
                  )}
                  {supervisoryAuthority ? (
                    <p>{t('pages.privacy.complaintAuthority', { authority: supervisoryAuthority })}</p>
                  ) : (
                    <p><span className={styles.placeholder}>[identify the correct complaint authority for each target market]</span></p>
                  )}
                  <p>{t('pages.privacy.orderQuestionsLead')} <Link href="/home/contact">{t('pages.policy.contactPage')}</Link>.</p>
                </div>
              </section>
            </div>

            <nav className={styles.related} aria-label={t('pages.policy.relatedAria')}>
              <h2 className={styles.relatedTitle}>{t('pages.policy.continueReading')}</h2>
              <div className={styles.relatedGrid}>
                <Link className={styles.relatedLink} href="/home/terms-conditions">
                  <span className={styles.relatedLabel}>{t('pages.policy.relatedPurchaseTerms')}</span>
                  <span>{t('pages.privacy.relatedTermsText')}</span>
                </Link>
                <Link className={styles.relatedLink} href="/home/refund-policy">
                  <span className={styles.relatedLabel}>{t('pages.privacy.relatedRefundLabel')}</span>
                  <span>{t('pages.privacy.relatedRefundText')}</span>
                </Link>
                <Link className={styles.relatedLink} href="/home/shipping-policy">
                  <span className={styles.relatedLabel}>{t('pages.policy.relatedDeliveryData')}</span>
                  <span>{t('pages.privacy.relatedShippingText')}</span>
                </Link>
              </div>
            </nav>

            <p className={styles.policyFooter}>{t('pages.privacy.footer')}</p>
          </article>
        </div>
      </div>
    </div>
  );
}

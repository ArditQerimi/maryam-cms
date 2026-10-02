import type { ComponentProps, CSSProperties } from 'react';
import Link from 'next/link';
import { Mail, MessageCircle, Phone, Send, Share2 } from 'lucide-react';
import { getContextCompany } from '@/lib/tenant';
import { getT, type Dictionary } from '@/lib/i18n/server';
import type { PublicStorefrontPresentation } from '@/lib/storefront-settings/contracts';
import { DEFAULT_FOOTER, type FooterCustomizations } from '@/lib/theme/types';
import WidgetArea from './WidgetArea';

function safeExternalUrl(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

// Dictionary keys (not literal copy) so both locales stay in sync — the
// labels are resolved with `t()` inside the component.
const footerGroups: Array<{
  titleKey: keyof Dictionary;
  links: Array<{ labelKey: keyof Dictionary; href: string }>;
}> = [
  {
    titleKey: 'footer.group.info',
    links: [
      { labelKey: 'footer.link.about', href: '/home/about-us' },
      { labelKey: 'footer.link.contact', href: '/home/contact' },
      { labelKey: 'footer.link.faqs', href: '/home/faqs' },
      { labelKey: 'footer.link.journal', href: '/home/blogs' },
    ],
  },
  {
    titleKey: 'footer.group.account',
    links: [
      { labelKey: 'footer.link.signin', href: '/home/login' },
      { labelKey: 'footer.link.create', href: '/home/register' },
      { labelKey: 'footer.link.orders', href: '/home/account/orders' },
      { labelKey: 'footer.link.wishlist', href: '/home/wishlist' },
      { labelKey: 'footer.link.compare', href: '/home/compare' },
    ],
  },
  {
    titleKey: 'footer.group.policies',
    links: [
      { labelKey: 'footer.link.terms', href: '/home/terms-conditions' },
      { labelKey: 'footer.link.privacy', href: '/home/privacy-policy' },
      { labelKey: 'footer.link.shipping', href: '/home/shipping-policy' },
      { labelKey: 'footer.link.refund', href: '/home/refund-policy' },
    ],
  },
];

async function getStoreIdentity() {
  try {
    const company = await getContextCompany();
    return {
      name: company.name.trim() || 'Store',
      email: process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim()
        || process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()
        || '',
      phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || '',
      address: process.env.NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS?.trim() || '',
      website: safeExternalUrl(process.env.NEXT_PUBLIC_SOCIAL_WEBSITE_URL),
      messages: safeExternalUrl(process.env.NEXT_PUBLIC_SOCIAL_MESSAGES_URL),
      share: safeExternalUrl(process.env.NEXT_PUBLIC_SOCIAL_SHARE_URL),
    };
  } catch {
    return {
      name: process.env.NEXT_PUBLIC_STOREFRONT_NAME?.trim() || 'Store',
      email: process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim()
        || process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()
        || '',
      phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || '',
      address: process.env.NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS?.trim() || '',
      website: '',
      messages: '',
      share: '',
    };
  }
}

export default async function ShopFooter({
  presentation,
  customizations,
}: {
  presentation?: PublicStorefrontPresentation;
  /** `theme_settings.customizations.footer` (the shop layout resolves it). */
  customizations?: FooterCustomizations;
}) {
  const store = await getStoreIdentity();
  const t = await getT();
  const footer = customizations ?? DEFAULT_FOOTER;
  const background = footer.background.trim();
  const copyright = footer.copyright.trim();
  // CMS columns replace the hardcoded groups; empty content keeps today's footer.
  const customColumns = footer.items
    .slice(0, footer.columns)
    .filter((column) => column.title.trim() || column.links.length > 0);
  const hasCustomColumns = customColumns.length > 0;
  const gridStyle = hasCustomColumns
    ? ({ '--footer-custom-cols': String(customColumns.length) } as CSSProperties)
    : undefined;
  const persistedPresentation = presentation?.status === 'ready' ? presentation.config : null;
  const socialLinks = [
    { href: store.website, label: t('footer.social.website'), icon: GlobeIcon },
    { href: store.messages, label: t('footer.social.messages'), icon: MessageCircle },
    { href: store.share, label: t('footer.social.share'), icon: Share2 },
  ].filter((item) => Boolean(item.href));

  return (
    <footer
      className="site-footer"
      style={background ? { backgroundColor: background } : undefined}
    >
      <div className="site-container">
        <div className="footer-subscribe-bar">
          <div className="footer-subscribe-copy">
            <Send size={18} aria-hidden="true" />
            <strong>{t('footer.help.title')}</strong>
          </div>
          <Link className="footer-subscribe-form" href="/home/contact">
            {t('footer.help.contact')}
          </Link>
        </div>

        <div
          className={hasCustomColumns ? 'footer-grid has-custom-columns' : 'footer-grid'}
          style={gridStyle}
        >
          <div className="footer-col">
            <h4 className="footer-heading">{store.name}</h4>
            {store.address ? <p>{store.address}</p> : <p>{t('footer.tagline')}</p>}
            <div className="footer-contact-list">
              {store.phone ? (
                <a className="footer-contact-item" href={`tel:${store.phone}`}>
                  <Phone size={15} aria-hidden="true" /> {store.phone}
                </a>
              ) : null}
              {store.email ? (
                <a className="footer-contact-item" href={`mailto:${store.email}`}>
                  <Mail size={15} aria-hidden="true" /> {store.email}
                </a>
              ) : (
                <Link className="footer-contact-item" href="/home/contact">
                  <Mail size={15} aria-hidden="true" /> {t('footer.sendMessage')}
                </Link>
              )}
              {socialLinks.length > 0 ? (
                <div className="footer-socials">
                  {socialLinks.map(({ href, label, icon: Icon }) => (
                    <a key={label} href={href} aria-label={label} rel="noopener noreferrer">
                      <Icon size={15} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {hasCustomColumns
            ? customColumns.map((column, columnIndex) => (
                <div key={`cms-column-${columnIndex}`} className="footer-col">
                  <h4 className="footer-heading">{column.title.trim() || ' '}</h4>
                  <div className="footer-links">
                    {column.links.map((link, linkIndex) => (
                      <Link key={`cms-link-${columnIndex}-${linkIndex}`} href={link.url || '#'}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            : footerGroups.map((group) => (
                <div key={group.titleKey} className="footer-col">
                  <h4 className="footer-heading">{t(group.titleKey)}</h4>
                  <div className="footer-links">
                    {group.links.map((link) => (
                      <Link key={link.href} href={link.href}>{t(link.labelKey)}</Link>
                    ))}
                  </div>
                </div>
              ))}
        </div>

        <WidgetArea area="footer" />

        <div className="footer-bottom">
          <div>
            <p>
              {copyright
                ? copyright
                : t('footer.rights', { year: new Date().getFullYear(), store: store.name })}
            </p>
            {persistedPresentation?.footer.supportingText ? (
              <p className="footer-supporting-text">{persistedPresentation.footer.supportingText}</p>
            ) : null}
          </div>
          <div>
            <div>{t('footer.support')}</div>
            {persistedPresentation?.footer.showPoweredBy ? (
              <div>{t('footer.powered')}</div>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}

function GlobeIcon(props: ComponentProps<typeof MessageCircle>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

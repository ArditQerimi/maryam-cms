import type { ComponentProps, CSSProperties } from 'react';
import Link from 'next/link';
import { Mail, MessageCircle, Phone, Send, Share2 } from 'lucide-react';
import { getContextCompany } from '@/lib/tenant';
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

const footerGroups = [
  {
    title: 'Information',
    links: [
      { label: 'About us', href: '/shop/about-us' },
      { label: 'Contact us', href: '/shop/contact' },
      { label: 'FAQs', href: '/shop/faqs' },
      { label: 'Journal', href: '/shop/blogs' },
    ],
  },
  {
    title: 'Customer account',
    links: [
      { label: 'Sign in', href: '/shop/login' },
      { label: 'Create account', href: '/shop/register' },
      { label: 'My orders', href: '/shop/account/orders' },
      { label: 'Wishlist', href: '/shop/wishlist' },
      { label: 'Compare', href: '/shop/compare' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { label: 'Terms & Conditions', href: '/shop/terms-conditions' },
      { label: 'Privacy Policy', href: '/shop/privacy-policy' },
      { label: 'Shipping Policy', href: '/shop/shipping-policy' },
      { label: 'Refund Policy', href: '/shop/refund-policy' },
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
    { href: store.website, label: 'Website', icon: GlobeIcon },
    { href: store.messages, label: 'Messages', icon: MessageCircle },
    { href: store.share, label: 'Share', icon: Share2 },
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
            <strong>Need help with an order?</strong>
          </div>
          <Link className="footer-subscribe-form" href="/shop/contact">
            Contact us
          </Link>
        </div>

        <div
          className={hasCustomColumns ? 'footer-grid has-custom-columns' : 'footer-grid'}
          style={gridStyle}
        >
          <div className="footer-col">
            <h4 className="footer-heading">{store.name}</h4>
            {store.address ? <p>{store.address}</p> : <p>Thoughtful books for every home.</p>}
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
                <Link className="footer-contact-item" href="/shop/contact">
                  <Mail size={15} aria-hidden="true" /> Send us a message
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
                <div key={group.title} className="footer-col">
                  <h4 className="footer-heading">{group.title}</h4>
                  <div className="footer-links">
                    {group.links.map((link) => (
                      <Link key={link.href} href={link.href}>{link.label}</Link>
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
                : <>© {new Date().getFullYear()} {store.name}. All rights reserved.</>}
            </p>
            {persistedPresentation?.footer.supportingText ? (
              <p className="footer-supporting-text">{persistedPresentation.footer.supportingText}</p>
            ) : null}
          </div>
          <div>
            <div>Customer account · Order support</div>
            {persistedPresentation?.footer.showPoweredBy ? (
              <div>Powered by the storefront platform</div>
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

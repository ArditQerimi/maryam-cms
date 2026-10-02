import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import React from 'react';
import { getSession } from '@/lib/session';
import { getFilterOptions, getStorefrontBlogPosts } from './blogs/blog-data';
import { getContextCompany } from '@/lib/tenant';
import { getPublicEcommerceStorefrontPresentation } from '@/lib/storefront-settings/reader';
import './base-theme.css';
import './base-globals.css';
import styles from './home.module.css';
import ShopHeader from './components/ShopHeader';
import ShopFooter from './components/ShopFooter';
import ShopProviders from './components/ShopProviders';
import PreviewBridge from '@/components/appearance/PreviewBridge';
import { buildThemeCss, getStorefrontTheme } from '@/lib/theme/apply-theme';
import { EMPTY_ACTIVE_NAV_MENU, getActiveNavMenu } from '@/lib/theme/storefront-nav';
import { DEFAULT_FOOTER, DEFAULT_HEADER } from '@/lib/theme/types';
import { getDictionary, getLocale } from '@/lib/i18n/server';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';

function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
    || `http://${process.env.NEXT_PUBLIC_DOMAIN || 'localhost:3000'}`;
  try {
    return new URL(configured);
  } catch {
    return new URL('http://localhost:3000');
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [company, presentation] = await Promise.all([
    getContextCompany().catch(() => null),
    getPublicEcommerceStorefrontPresentation().catch(() => null),
  ]);
  const storeName = company?.name?.trim() || 'Store';
  const siteUrl = getSiteUrl();
  const persistedMetadata = presentation?.status === 'ready' ? presentation.config.metadata : null;
  const title = persistedMetadata?.title || storeName;
  // This fallback is platform-owned identity, not a claimed persisted default.
  const description = persistedMetadata
    ? persistedMetadata.description
    : `Shop the current catalog, discover editorial stories, and manage your ${storeName} customer account.`;

  return {
    metadataBase: siteUrl,
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    alternates: {
      canonical: '/home',
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url: new URL('/home', siteUrl).toString(),
      siteName: title,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const company = await getContextCompany().catch(() => null);
  if (!company && process.env.NODE_ENV === 'production') notFound();

  const [posts, session, presentation, activeNav] = await Promise.all([
    getStorefrontBlogPosts().catch(() => []),
    getSession().catch(() => null),
    getPublicEcommerceStorefrontPresentation().catch(() => null),
    // Active CMS menu (`settings_store.nav_menus` + `theme_settings.nav_menu`).
    getActiveNavMenu(company?.id).catch(() => EMPTY_ACTIVE_NAV_MENU),
  ]);
  // Theme injection must never break the storefront: a missing/failed
  // `theme_settings` row falls back to null → buildThemeCss emits safe defaults.
  const theme = company
    ? await getStorefrontTheme(company.id).catch(() => null)
    : null;
  const themeCss = buildThemeCss(theme);
  const headerCustomizations = theme?.customizations.header ?? DEFAULT_HEADER;
  const footerCustomizations = theme?.customizations.footer ?? DEFAULT_FOOTER;
  // Brand identity: CMS site name → company name → today's hardcoded brand.
  const siteName = headerCustomizations.siteName.trim();
  const brandName = siteName || 'ELIF';
  const brandTagline =
    headerCustomizations.tagline.trim() || (siteName ? '' : 'DYQANI ISLAM');
  const blogCategories = getFilterOptions(posts, 'category')
    .slice(0, 6)
    .map((category) => ({
      id: category.value,
      name: category.label,
      href: `/home/blogs?category=${encodeURIComponent(category.value)}`,
    }));
  const accountHref = session?.platformRole === 'customer'
    ? '/home/account'
    : session?.platformRole === 'admin' || session?.platformRole === 'super_admin'
      ? '/'
      : '/home/login';

  // Cookie-resolved storefront locale (sq default) + its dictionary for the
  // client tree — see src/lib/i18n.
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <LocaleProvider locale={locale} dict={dict}>
      <ShopProviders>
        <PreviewBridge />
        <div
          className={`${styles.shopWrapper} shopWrapper`}
          style={{
            fontFamily:
              'var(--cms-body-font), var(--font-spectral), "Spectral", Georgia, serif',
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: themeCss }} />
          <ShopHeader
            accountHref={accountHref}
            blogCategories={blogCategories}
            navItems={activeNav.items}
            brandName={brandName}
            brandTagline={brandTagline}
            brandLogo={headerCustomizations.logo}
            navStyle={headerCustomizations.navStyle}
            showSearch={headerCustomizations.showSearch}
            showCart={headerCustomizations.showCart}
            headerBgMode={headerCustomizations.headerBgMode}
            headerBgColor={headerCustomizations.headerBgColor}
          />
          <main className={`${styles.mainContent} content-area`}>{children}</main>
          <ShopFooter
            presentation={presentation || undefined}
            customizations={footerCustomizations}
          />
        </div>
      </ShopProviders>
    </LocaleProvider>
  );
}


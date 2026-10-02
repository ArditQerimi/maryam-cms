'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Heart, Search, ShoppingBag, User, Repeat, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCompare } from '@/context/CompareContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { navLabelKey } from '@/lib/i18n/nav-labels';
import LanguageSwitcher from './LanguageSwitcher';

function cartLineKey(item: { productId: string | number; variantId: string | number | null }) {
  return `${String(item.productId)}:${String(item.variantId)}`;
}

/** One row of a CMS navigation menu (see `settings_store.nav_menus`). */
export type HeaderNavItem = {
  id: string;
  label: string;
  url: string;
  depth?: 0 | 1;
};

type ShopHeaderProps = {
  accountHref?: string;
  blogCategories?: Array<{ id: string; name: string; href: string }>;
  /** Active CMS menu — when empty the hardcoded links below are rendered. */
  navItems?: HeaderNavItem[];
  /** `theme_settings.customizations.header` (layout resolves the fallbacks). */
  brandName?: string;
  brandTagline?: string;
  brandLogo?: string;
  navStyle?: 'standard' | 'centered' | 'minimal';
  showSearch?: boolean;
  showCart?: boolean;
  headerBgMode?: 'transparent' | 'white' | 'custom';
  headerBgColor?: string;
};

export default function ShopHeader({
  accountHref = '/home/login',
  blogCategories = [],
  navItems = [],
  brandName = 'ELIF',
  brandTagline = 'DYQANI ISLAM',
  brandLogo = '',
  navStyle = 'standard',
  showSearch = true,
  showCart = true,
  headerBgMode = 'white',
  headerBgColor = '#ffffff',
}: ShopHeaderProps) {
  const pathname = usePathname();
  const isHomePage = pathname === '/home';
  const isActive = (href: string) => (
    href === '/home' ? pathname === href : pathname.startsWith(href)
  );
  // CMS menu wins when it has items; otherwise the historical links stay.
  const hasCustomNav = navItems.some((item) => item.label && item.label.trim());
  const brandNameText = brandName.trim() || 'ELIF';
  const linkProps = (url: string) => {
    const href = url.trim() || '#';
    if (/^https?:\/\//i.test(href)) {
      return { href, target: '_blank' as const, rel: 'noopener noreferrer' };
    }
    return { href };
  };
  const headerStyle =
    headerBgMode === 'custom' && headerBgColor.trim()
      ? { backgroundColor: headerBgColor.trim() }
      : undefined;
  const { cart, removeFromCart, totalItems, subtotal } = useCart();
  const { compareItems } = useCompare();
  const { wishlist } = useWishlist();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { t } = useLocale();

  /**
   * CMS menu labels are stored in the database; the seeded defaults get their
   * localized wording, merchant-renamed labels stay exactly as written.
   */
  const navLabel = (label: string) => {
    const key = navLabelKey(label);
    return key ? t(key) : label;
  };

  const shopDropdown = [
    { label: t('header.shop.cart'), href: '/home/cart' },
    { label: t('header.shop.checkout'), href: '/home/checkout' },
    { label: t('header.shop.wishlist'), href: '/home/wishlist' },
    { label: t('header.shop.compare'), href: '/home/compare' },
    { label: t('header.shop.account'), href: accountHref },
  ];

  const blogDropdown = [
    { label: t('header.blog.all'), href: '/home/blogs' },
    ...blogCategories.map((category) => ({ label: category.name, href: category.href })),
  ];

  return (
    <>
      <header
        className={`site-header${isHomePage ? ' shop-home-header' : ''} nav-${navStyle} header-bg-${headerBgMode}`}
        style={headerStyle}
      >
        <div className="site-header-row">
          <button
            type="button"
            className="site-burger"
            aria-label={t('header.menu.open')}
            onClick={() => setIsMenuOpen(true)}
          >
            ☰
          </button>

          <nav className="site-nav" aria-label={t('header.nav.aria')}>
            {hasCustomNav ? (
              navItems
                .filter((item) => item.label && item.label.trim())
                .map((item) => (
                  <Link
                    key={item.id || `${item.url}-${item.label}`}
                    {...linkProps(item.url)}
                    className={`site-nav-link${
                      item.url.startsWith('/') && isActive(item.url) ? ' is-active' : ''
                    }${item.depth === 1 ? ' is-sub' : ''}`}
                  >
                    {navLabel(item.label)}
                  </Link>
                ))
            ) : (
              <>
                <Link
                  href="/home"
                  className={`site-nav-link${isActive('/home') ? ' is-active' : ''}`}
                >
                  {t('header.nav.home')}
                </Link>

                <div className="site-nav-item">
                  <Link
                    href="/home/products"
                    className={`site-nav-link${isActive('/home/products') ? ' is-active' : ''}`}
                  >
                    {t('header.nav.shop')} <span className="site-nav-caret">▾</span>
                  </Link>
                  <div className="site-dropdown">
                    {shopDropdown.map((item) => (
                      <Link key={item.href} href={item.href}>{item.label}</Link>
                    ))}
                  </div>
                </div>

                <div className="site-nav-item">
                  <Link
                    href="/home/blogs"
                    className={`site-nav-link${isActive('/home/blogs') ? ' is-active' : ''}`}
                  >
                    {t('header.nav.blog')} <span className="site-nav-caret">▾</span>
                  </Link>
                  <div className="site-dropdown">
                    {blogDropdown.map((item) => (
                      <Link key={item.href} href={item.href}>{item.label}</Link>
                    ))}
                  </div>
                </div>

                <Link
                  href="/home/about-us"
                  className={`site-nav-link${isActive('/home/about-us') ? ' is-active' : ''}`}
                >
                  {t('header.nav.about')}
                </Link>
                <Link
                  href="/home/contact"
                  className={`site-nav-link${isActive('/home/contact') ? ' is-active' : ''}`}
                >
                  {t('header.nav.contact')}
                </Link>
              </>
            )}
          </nav>

          <Link href="/home" className="site-brand" aria-label={brandNameText}>
            {brandLogo.trim() ? (
              <img
                className="site-brand-logo"
                src={brandLogo.trim()}
                alt={brandNameText}
              />
            ) : (
              <span
                className={`site-brand-name${brandNameText.length > 12 ? ' is-compact' : ''}`}
              >
                {brandNameText}
              </span>
            )}
            {brandTagline.trim() ? (
              <span className="site-brand-tag">{brandTagline.trim()}</span>
            ) : null}
          </Link>

          <div className="site-actions">
            {showSearch ? (
              <button
                type="button"
                className="site-icon-btn"
                aria-label={t('header.search.open')}
                onClick={() => setIsSearchOpen(true)}
              >
                <Search size={24} strokeWidth={1.5} />
              </button>
            ) : null}
            <Link href={accountHref} className="site-icon-btn" aria-label={t('header.account')}>
              <User size={24} strokeWidth={1.5} />
            </Link>
            <Link href="/home/compare" className="site-icon-btn" aria-label={t('header.compare')}>
              <Repeat size={24} strokeWidth={1.5} />
              <span className="site-badge">{compareItems.length}</span>
            </Link>
            <Link href="/home/wishlist" className="site-icon-btn" aria-label={t('header.wishlist')}>
              <Heart size={24} strokeWidth={1.5} />
              <span className="site-badge">{wishlist.length}</span>
            </Link>
            {showCart ? (
              <button
                type="button"
                className="site-icon-btn"
                aria-label={t('header.cart')}
                onClick={() => setIsCartOpen(true)}
              >
                <ShoppingBag size={24} strokeWidth={1.5} />
                <span className="site-badge">{totalItems}</span>
              </button>
            ) : null}
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Search overlay */}
      {isSearchOpen && showSearch ? (
        <div className="site-search-overlay" role="dialog" aria-modal="true">
          <div className="site-search-panel">
            <button
              type="button"
              className="site-search-close"
              aria-label={t('header.search.close')}
              onClick={() => setIsSearchOpen(false)}
            >
              <X size={22} />
            </button>
            <form
              className="site-search-form"
              action="/home/products"
              method="get"
              onSubmit={() => setIsSearchOpen(false)}
            >
              <input
                type="search"
                name="q"
                placeholder={t('header.search.placeholder')}
                aria-label={t('header.search.title')}
                autoFocus
              />
              <button type="submit" className="button">{t('header.search.submit')}</button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Cart sidebar */}
      {isCartOpen && showCart ? (
        <>
          <div
            className="site-cart-backdrop"
            onClick={() => setIsCartOpen(false)}
            aria-hidden="true"
          />
          <aside className="site-cart-panel" role="dialog" aria-modal="true" aria-label={t('header.cart.title')}>
            <div className="site-cart-head">
              <h2 className="site-cart-title">{t('header.cart.title')}</h2>
              <button
                type="button"
                className="site-cart-close"
                aria-label={t('header.cart.close')}
                onClick={() => setIsCartOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="site-cart-items">
              {cart.length === 0 ? (
                <p className="site-cart-empty">{t('header.cart.empty')}</p>
              ) : (
                cart.map((item) => (
                  <div key={cartLineKey(item)} className="site-cart-item">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="site-cart-item-img"
                    />
                    <div className="site-cart-item-body">
                      <span className="site-cart-item-name">{item.name}</span>
                      <span className="site-cart-item-meta">
                        {item.quantity} × €{item.price.toFixed(2)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="site-cart-remove"
                      aria-label={t('header.cart.removeItem', { name: item.name })}
                      onClick={() => removeFromCart({ productId: item.productId, variantId: item.variantId })}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="site-cart-foot">
              <div className="site-cart-subtotal">
                <span>{t('header.cart.subtotal')}</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              <div className="site-cart-actions">
                <Link
                  href="/home/cart"
                  className="button is-outline"
                  onClick={() => setIsCartOpen(false)}
                >
                  {t('header.cart.view')}
                </Link>
                <Link
                  href="/home/checkout"
                  className="button"
                  onClick={() => setIsCartOpen(false)}
                >
                  {t('header.cart.checkout')}
                </Link>
              </div>
            </div>
          </aside>
        </>
      ) : null}

      {/* Mobile drawer */}
      {isMenuOpen ? (
        <div className="site-drawer" role="dialog" aria-modal="true">
          <div className="site-drawer-head">
            <span className="site-brand-name">{brandNameText}</span>
            <button
              type="button"
              className="site-icon-btn"
              onClick={() => setIsMenuOpen(false)}
              aria-label={t('header.menu.close')}
            >
              <X size={22} />
            </button>
          </div>
          <nav className="site-drawer-nav">
            {hasCustomNav ? (
              navItems
                .filter((item) => item.label && item.label.trim())
                .map((item) => (
                  <Link
                    key={item.id || `${item.url}-${item.label}`}
                    {...linkProps(item.url)}
                    className={item.depth === 1 ? 'is-sub' : undefined}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {navLabel(item.label)}
                  </Link>
                ))
            ) : (
              <>
                <Link href="/home" onClick={() => setIsMenuOpen(false)}>{t('header.nav.home')}</Link>
                <Link href="/home/products" onClick={() => setIsMenuOpen(false)}>{t('header.nav.shop')}</Link>
                <Link href="/home/blogs" onClick={() => setIsMenuOpen(false)}>{t('header.nav.blog')}</Link>
                <Link href="/home/about-us" onClick={() => setIsMenuOpen(false)}>{t('header.nav.about')}</Link>
                <Link href="/home/contact" onClick={() => setIsMenuOpen(false)}>{t('header.nav.contact')}</Link>
              </>
            )}
            <Link href={accountHref} onClick={() => setIsMenuOpen(false)}>{t('header.shop.account')}</Link>
          </nav>
        </div>
      ) : null}
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Heart, Search, ShoppingBag, User, Repeat, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCompare } from '@/context/CompareContext';
import { useWishlist } from '@/context/WishlistContext';

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
  accountHref = '/shop/login',
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
  const isHomePage = pathname === '/shop';
  const isActive = (href: string) => (
    href === '/shop' ? pathname === href : pathname.startsWith(href)
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

  const shopDropdown = [
    { label: 'Cart', href: '/shop/cart' },
    { label: 'Checkout', href: '/shop/checkout' },
    { label: 'Wishlist', href: '/shop/wishlist' },
    { label: 'Compare', href: '/shop/compare' },
    { label: 'My Account', href: accountHref },
  ];

  const blogDropdown = [
    { label: 'All articles', href: '/shop/blogs' },
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
            aria-label="Open menu"
            onClick={() => setIsMenuOpen(true)}
          >
            ☰
          </button>

          <nav className="site-nav" aria-label="Primary">
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
                    {item.label}
                  </Link>
                ))
            ) : (
              <>
                <Link
                  href="/shop"
                  className={`site-nav-link${isActive('/shop') ? ' is-active' : ''}`}
                >
                  Home
                </Link>

                <div className="site-nav-item">
                  <Link
                    href="/shop/products"
                    className={`site-nav-link${isActive('/shop/products') ? ' is-active' : ''}`}
                  >
                    Shop <span className="site-nav-caret">▾</span>
                  </Link>
                  <div className="site-dropdown">
                    {shopDropdown.map((item) => (
                      <Link key={item.href} href={item.href}>{item.label}</Link>
                    ))}
                  </div>
                </div>

                <div className="site-nav-item">
                  <Link
                    href="/shop/blogs"
                    className={`site-nav-link${isActive('/shop/blogs') ? ' is-active' : ''}`}
                  >
                    Blog <span className="site-nav-caret">▾</span>
                  </Link>
                  <div className="site-dropdown">
                    {blogDropdown.map((item) => (
                      <Link key={item.href} href={item.href}>{item.label}</Link>
                    ))}
                  </div>
                </div>

                <Link
                  href="/shop/about-us"
                  className={`site-nav-link${isActive('/shop/about-us') ? ' is-active' : ''}`}
                >
                  About Us
                </Link>
                <Link
                  href="/shop/contact"
                  className={`site-nav-link${isActive('/shop/contact') ? ' is-active' : ''}`}
                >
                  Contact Us
                </Link>
              </>
            )}
          </nav>

          <Link href="/shop" className="site-brand" aria-label={brandNameText}>
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
                aria-label="Search"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search size={24} strokeWidth={1.5} />
              </button>
            ) : null}
            <Link href={accountHref} className="site-icon-btn" aria-label="Account">
              <User size={24} strokeWidth={1.5} />
            </Link>
            <Link href="/shop/compare" className="site-icon-btn" aria-label="Compare">
              <Repeat size={24} strokeWidth={1.5} />
              <span className="site-badge">{compareItems.length}</span>
            </Link>
            <Link href="/shop/wishlist" className="site-icon-btn" aria-label="Wishlist">
              <Heart size={24} strokeWidth={1.5} />
              <span className="site-badge">{wishlist.length}</span>
            </Link>
            {showCart ? (
              <button
                type="button"
                className="site-icon-btn"
                aria-label="Cart"
                onClick={() => setIsCartOpen(true)}
              >
                <ShoppingBag size={24} strokeWidth={1.5} />
                <span className="site-badge">{totalItems}</span>
              </button>
            ) : null}
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
              aria-label="Close search"
              onClick={() => setIsSearchOpen(false)}
            >
              <X size={22} />
            </button>
            <form
              className="site-search-form"
              action="/shop/products"
              method="get"
              onSubmit={() => setIsSearchOpen(false)}
            >
              <input
                type="search"
                name="q"
                placeholder="Search by title or SKU…"
                aria-label="Search products"
                autoFocus
              />
              <button type="submit" className="button">Search</button>
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
          <aside className="site-cart-panel" role="dialog" aria-modal="true" aria-label="Shopping Cart">
            <div className="site-cart-head">
              <h2 className="site-cart-title">Shopping Cart</h2>
              <button
                type="button"
                className="site-cart-close"
                aria-label="Close cart"
                onClick={() => setIsCartOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="site-cart-items">
              {cart.length === 0 ? (
                <p className="site-cart-empty">Shporta juaj është bosh.</p>
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
                      aria-label={`Remove ${item.name}`}
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
                <span>Subtotal:</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              <div className="site-cart-actions">
                <Link
                  href="/shop/cart"
                  className="button is-outline"
                  onClick={() => setIsCartOpen(false)}
                >
                  View Cart
                </Link>
                <Link
                  href="/shop/checkout"
                  className="button"
                  onClick={() => setIsCartOpen(false)}
                >
                  Checkout
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
              aria-label="Close menu"
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
                    {item.label}
                  </Link>
                ))
            ) : (
              <>
                <Link href="/shop" onClick={() => setIsMenuOpen(false)}>Home</Link>
                <Link href="/shop/products" onClick={() => setIsMenuOpen(false)}>Shop</Link>
                <Link href="/shop/blogs" onClick={() => setIsMenuOpen(false)}>Blog</Link>
                <Link href="/shop/about-us" onClick={() => setIsMenuOpen(false)}>About Us</Link>
                <Link href="/shop/contact" onClick={() => setIsMenuOpen(false)}>Contact Us</Link>
              </>
            )}
            <Link href={accountHref} onClick={() => setIsMenuOpen(false)}>My Account</Link>
          </nav>
        </div>
      ) : null}
    </>
  );
}

'use client';

import Link from 'next/link';
import React from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from './shop-page-header.module.css';

export type ShopCrumb = {
  label: string;
  /** Omit on the last crumb — it renders as the current page. */
  href?: string;
};

/**
 * The banner every storefront page opens with: breadcrumb, title and an
 * optional eyebrow/lead on a cream band. Presentational only, so it works
 * inside Server and Client Components alike.
 */
export default function ShopPageHeader({
  title,
  titleId,
  crumbs = [],
  eyebrow,
  lead,
  align = 'center',
  children,
}: {
  /** Omit on pages whose own heading lives in the body (e.g. product detail). */
  title?: string;
  /** Set when the surrounding section uses `aria-labelledby`. */
  titleId?: string;
  crumbs?: ShopCrumb[];
  eyebrow?: string;
  lead?: string;
  align?: 'center' | 'start';
  /** Page-specific extras, e.g. a count pill. Rendered under the copy. */
  children?: React.ReactNode;
}) {
  const { t } = useLocale();
  // The `Breadcrumb` landmark name stays stable in every locale (tests and
  // assistive-tech muscle memory depend on it); the label itself translates.
  const trail: ShopCrumb[] = [{ label: t('header.nav.home'), href: '/home' }, ...crumbs];

  return (
    <section className={styles.band} data-align={align}>
      <div className="site-container">
        <div className={styles.inner}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            {trail.map((crumb, index) => {
              const isLast = index === trail.length - 1;
              return (
                <React.Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 ? (
                    <span className={styles.separator} aria-hidden="true">
                      /
                    </span>
                  ) : null}
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className={styles.crumbLink}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={styles.current} aria-current="page">
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          {title ? (
            <h1 id={titleId} className={styles.title}>
              {title}
            </h1>
          ) : null}
          {lead ? <p className={styles.lead}>{lead}</p> : null}
          {children}
        </div>
      </div>
    </section>
  );
}

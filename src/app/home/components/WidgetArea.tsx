/**
 * Server component that renders the widgets an admin configured for one
 * storefront area (`sidebar` | `homepage` | `footer`).
 *
 * - Reads `settings_store.widgets` through `getStorefrontWidgets`
 *   (falling back to `theme_settings.widgets`), so what you save in
 *   `/cms/appearance/widgets` is exactly what shows up here.
 * - Renders nothing when the area has no widgets and never throws: every
 *   database read falls back to an empty list.
 *
 * Widget classes (`.shop-widget*`) are defined in `../base-globals.css`.
 */

import type { ReactElement } from 'react';
import Link from 'next/link';
import { asc, desc, eq } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import * as t from '@/db/schema-tenant';
// The blog pages read their posts through `getStorefrontBlogPosts`, which wraps
// `getPublicBlogPostRecords` from `@/lib/storefront/blogs` — reuse it so the
// widget always lists exactly what /shop/blogs lists.
import { getStorefrontBlogPosts, type BlogPost } from '../blogs/blog-data';
import NewsletterForm from './NewsletterForm';
import { getStorefrontWidgets } from '@/lib/theme/storefront-widgets';
import {
  WIDGET_LABELS,
  type WidgetAreaKey,
  type WidgetInstance,
} from '@/lib/theme/types';

type WidgetAreaProps = {
  area: WidgetAreaKey;
};

const priceFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function isExternalUrl(value: string): boolean {
  return /^(https?:)?\/\//i.test(value) || value.startsWith('mailto:') || value.startsWith('tel:');
}

/** Same visibility rule the blog pages apply (status + not future-dated). */
function isPublishedPost(post: BlogPost): boolean {
  const status = post.status.toLocaleLowerCase();
  if (status && !['active', 'published', 'live'].includes(status)) return false;
  const publishedAt = new Date(post.publishedAt).getTime();
  return !Number.isFinite(publishedAt) || publishedAt <= Date.now();
}

export default async function WidgetArea({ area }: WidgetAreaProps) {
  const widgets = await getStorefrontWidgets(area);
  if (widgets.length === 0) return null;

  const rendered = await Promise.all(widgets.map((widget) => renderWidget(widget)));
  const blocks = rendered.filter((node): node is ReactElement => node !== null);
  if (blocks.length === 0) return null;

  return (
    <div className="widget-area shop-widget-area" data-widget-area={area}>
      {blocks}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Widget shell                                                                */
/* -------------------------------------------------------------------------- */

function widgetShell(
  widget: WidgetInstance,
  heading: string,
  body: ReactElement | null,
): ReactElement | null {
  if (!body) return null;
  return (
    <aside
      key={widget.id}
      className={`shop-widget shop-widget--${widget.type}`}
      data-widget-type={widget.type}
    >
      {heading ? <h3 className="shop-widget-title">{heading}</h3> : null}
      {body}
    </aside>
  );
}

function linkList(
  className: string,
  rows: Array<{ key: string; label: string; href: string; meta?: string }>,
): ReactElement {
  return (
    <ul className={`shop-widget-list ${className}`}>
      {rows.map((row) => (
        <li key={row.key}>
          {isExternalUrl(row.href) ? (
            <a
              href={row.href}
              target={/^https?:/i.test(row.href) ? '_blank' : undefined}
              rel="noopener noreferrer"
            >
              {row.label}
            </a>
          ) : (
            <Link href={row.href}>{row.label}</Link>
          )}
          {row.meta ? <span className="shop-widget-meta">{row.meta}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-type renderers (each one is failure-tolerant)                           */
/* -------------------------------------------------------------------------- */

async function renderWidget(widget: WidgetInstance): Promise<ReactElement | null> {
  const { settings, type } = widget;
  const limit = Number.isFinite(settings.limit) && settings.limit > 0 ? settings.limit : 5;
  const heading = settings.title.trim() || (type === 'text' ? '' : WIDGET_LABELS[type]);

  switch (type) {
    case 'text': {
      if (!settings.html.trim()) return null;
      return widgetShell(
        widget,
        heading,
        <div className="shop-widget-html" dangerouslySetInnerHTML={{ __html: settings.html }} />,
      );
    }

    case 'social': {
      const links = settings.links.filter(
        (link) => link.label.trim() && link.url.trim(),
      );
      if (links.length === 0) return null;
      return widgetShell(
        widget,
        heading,
        linkList(
          'shop-widget-social',
          links.map((link, index) => ({
            key: `${link.url}-${index}`,
            label: link.label.trim(),
            href: link.url.trim(),
          })),
        ),
      );
    }

    case 'categories': {
      const rows = await getContextDb()
        .then((db) =>
          db
            .select({ id: t.categories.id, name: t.categories.name })
            .from(t.categories)
            .where(eq(t.categories.status, 'Active'))
            .orderBy(asc(t.categories.name))
            .limit(limit),
        )
        .catch(() => [] as Array<{ id: number; name: string }>);

      if (rows.length === 0) return null;
      return widgetShell(
        widget,
        heading,
        linkList(
          'shop-widget-categories',
          rows
            .filter((row) => row.name.trim())
            .map((row) => ({
              key: String(row.id),
              label: row.name.trim(),
              // The shop filters by numeric category id (`ShopProductsClient`).
              href: `/shop/products?category=${row.id}`,
            })),
        ),
      );
    }

    case 'recent-posts': {
      const posts = await getStorefrontBlogPosts().catch(() => [] as BlogPost[]);
      const rows = posts
        .filter((post) => isPublishedPost(post) && post.slug.trim())
        .slice(0, limit)
        .map((post) => ({
          key: post.slug,
          label: post.title.trim() || 'Untitled post',
          href: `/shop/blogs/${post.slug}`,
        }));

      if (rows.length === 0) return null;
      return widgetShell(widget, heading, linkList('shop-widget-posts', rows));
    }

    case 'recent-products': {
      const rows = await getContextDb()
        .then((db) =>
          db
            .select({
              id: t.products.id,
              name: t.products.name,
              price: t.products.price,
            })
            .from(t.products)
            .where(eq(t.products.status, 'Active'))
            .orderBy(desc(t.products.createdAt), desc(t.products.id))
            .limit(limit),
        )
        .catch(
          () => [] as Array<{ id: number; name: string; price: string | null }>,
        );

      if (rows.length === 0) return null;
      return widgetShell(
        widget,
        heading,
        linkList(
          'shop-widget-products',
          rows
            .filter((row) => row.name.trim())
            .map((row) => {
              const price = Number(row.price);
              return {
                key: String(row.id),
                label: row.name.trim(),
                href: `/shop/products/${row.id}`,
                meta: Number.isFinite(price) ? priceFormatter.format(price) : undefined,
              };
            }),
        ),
      );
    }

    case 'newsletter':
    default: {
      // No newsletter/subscribe endpoint exists in `src/app/api/**`, so this
      // renders a friendly capture form that acknowledges the address locally
      // instead of inventing an endpoint.
      return widgetShell(
        widget,
        heading,
        <NewsletterForm inputId={`widget-email-${widget.id}`} />,
      );
    }
  }
}

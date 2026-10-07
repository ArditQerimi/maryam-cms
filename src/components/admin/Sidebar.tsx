'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ChevronLeft,
  FileText,
  Image,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  MessageCircle,
  Menu,
  Package,
  Palette,
  Percent,
  Receipt,
  Ruler,
  Settings,
  ShoppingBag,
  Tag,
  Truck,
  UserCheck,
  Users,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';

type NavItem = {
  href: string;
  /** Dictionary key — resolved with `t()` at render time. */
  labelKey: keyof Dictionary;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match?: string[];
};

type NavSection = { labelKey: keyof Dictionary; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: 'cmsnav.section.content',
    items: [
      { href: '/cms/dashboard', labelKey: 'cmsnav.item.dashboard', icon: LayoutGrid },
      { href: '/cms/pages', labelKey: 'cmsnav.item.pages', icon: FileText, match: ['/cms/pages'] },
      { href: '/cms/posts', labelKey: 'cmsnav.item.posts', icon: FileText, match: ['/cms/posts'] },
      { href: '/cms/media', labelKey: 'cmsnav.item.media', icon: Image, match: ['/cms/media'] },
    ],
  },
  {
    labelKey: 'cmsnav.section.store',
    items: [
      { href: '/cms/products', labelKey: 'cmsnav.item.products', icon: Package, match: ['/cms/products'] },
      { href: '/cms/orders', labelKey: 'cmsnav.item.orders', icon: Receipt, match: ['/cms/orders'] },
      { href: '/cms/customers', labelKey: 'cmsnav.item.customers', icon: Users, match: ['/cms/customers'] },
      { href: '/cms/store-accounts', labelKey: 'cmsnav.item.store_accounts', icon: UserCheck, match: ['/cms/store-accounts'] },
      { href: '/cms/coupons', labelKey: 'cmsnav.item.coupons', icon: Tag, match: ['/cms/coupons'] },
      { href: '/cms/discounts/product', labelKey: 'cmsnav.item.discounts', icon: Percent, match: ['/cms/discounts'] },
      { href: '/cms/shipping/zones', labelKey: 'cmsnav.item.shipping', icon: Truck, match: ['/cms/shipping'] },
      { href: '/cms/shipping/classes', labelKey: 'cmsnav.item.shipping_classes', icon: Ruler, match: ['/cms/shipping/classes'] },
    ],
  },
  {
    labelKey: 'cmsnav.section.reports',
    items: [
      { href: '/cms/reports/sales', labelKey: 'cmsnav.item.sales', icon: BarChart3, match: ['/cms/reports/sales'] },
      { href: '/cms/reports/products', labelKey: 'cmsnav.item.products', icon: Package, match: ['/cms/reports/products'] },
      { href: '/cms/reports/customers', labelKey: 'cmsnav.item.customers', icon: Users, match: ['/cms/reports/customers'] },
      { href: '/cms/reports/stock', labelKey: 'cmsnav.item.stock', icon: Warehouse, match: ['/cms/reports/stock'] },
    ],
  },
  {
    labelKey: 'cmsnav.section.appearance',
    items: [
      { href: '/cms/appearance/themes', labelKey: 'cmsnav.item.themes', icon: Palette, match: ['/cms/appearance/themes'] },
      { href: '/cms/appearance/customize', labelKey: 'cmsnav.item.customize', icon: Palette, match: ['/cms/appearance/customize'] },
      { href: '/cms/appearance/menus', labelKey: 'cmsnav.item.menus', icon: Menu, match: ['/cms/appearance/menus'] },
      { href: '/cms/appearance/widgets', labelKey: 'cmsnav.item.widgets', icon: LayoutTemplate, match: ['/cms/appearance/widgets'] },
    ],
  },
  {
    labelKey: 'cmsnav.section.settings',
    items: [
      { href: '/cms/settings/general', labelKey: 'cmsnav.item.general', icon: Settings, match: ['/cms/settings/general'] },
      { href: '/cms/settings/reading', labelKey: 'cmsnav.item.reading', icon: FileText, match: ['/cms/settings/reading'] },
      { href: '/cms/settings/discussion', labelKey: 'cmsnav.item.discussion', icon: Mail, match: ['/cms/settings/discussion'] },
      { href: '/cms/settings/media', labelKey: 'cmsnav.item.media', icon: Image, match: ['/cms/settings/media'] },
      { href: '/cms/settings/permalinks', labelKey: 'cmsnav.item.permalinks', icon: Menu, match: ['/cms/settings/permalinks'] },
      { href: '/cms/settings/email', labelKey: 'cmsnav.item.email', icon: Mail, match: ['/cms/settings/email'] },
      { href: '/cms/settings/whatsapp', labelKey: 'cmsnav.item.whatsapp', icon: MessageCircle, match: ['/cms/settings/whatsapp'] },
      { href: '/cms/settings/payments', labelKey: 'cmsnav.item.payments', icon: Receipt, match: ['/cms/settings/payments'] },
      { href: '/cms/settings/tax', labelKey: 'cmsnav.item.tax', icon: Percent, match: ['/cms/settings/tax'] },
      { href: '/cms/builder', labelKey: 'cmsnav.item.builder', icon: ShoppingBag, match: ['/cms/builder'] },
    ],
  },
];

function isActive(pathname: string, item: NavItem) {
  const prefixes = item.match || [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'sticky top-0 z-30 flex h-screen shrink-0 flex-col bg-[#1e1e2e] transition-[width] duration-200',
        collapsed ? 'w-[64px]' : 'w-[240px]',
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-white/5 px-4">
        <Link href="/cms/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6d6be8] text-sm font-bold text-white">
            M
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-white">Maryam CMS</span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? t('cmsnav.expand') : t('cmsnav.collapse')}
          className="rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft
            size={16}
            className={cn('transition-transform', collapsed && 'rotate-180')}
          />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.labelKey} className="mb-5">
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {t(section.labelKey)}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                const label = t(item.labelKey);
                return (
                  <li key={item.href + item.labelKey}>
                    <Link
                      href={item.href}
                      title={collapsed ? label : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                        active
                          ? 'bg-[#6d6be8] text-white'
                          : 'text-white/60 hover:bg-white/10 hover:text-white',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      <Icon size={18} className="shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-white/5 px-4 py-3 text-[11px] text-white/35">
          {t('cmsnav.footer')}
        </div>
      )}
    </aside>
  );
}

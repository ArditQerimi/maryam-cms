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
  Users,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/components/admin/ui';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match?: string[];
};

type NavSection = { label: string; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Content',
    items: [
      { href: '/cms/dashboard', label: 'Dashboard', icon: LayoutGrid },
      { href: '/cms/pages', label: 'Pages', icon: FileText, match: ['/cms/pages'] },
      { href: '/cms/posts', label: 'Posts', icon: FileText, match: ['/cms/posts'] },
      { href: '/cms/media', label: 'Media', icon: Image, match: ['/cms/media'] },
    ],
  },
  {
    label: 'Store',
    items: [
      { href: '/cms/products', label: 'Products', icon: Package, match: ['/cms/products'] },
      { href: '/cms/orders', label: 'Orders', icon: Receipt, match: ['/cms/orders'] },
      { href: '/cms/customers', label: 'Customers', icon: Users, match: ['/cms/customers'] },
      { href: '/cms/coupons', label: 'Coupons', icon: Tag, match: ['/cms/coupons'] },
      { href: '/cms/discounts/product', label: 'Discounts', icon: Percent, match: ['/cms/discounts'] },
      { href: '/cms/shipping/zones', label: 'Shipping', icon: Truck, match: ['/cms/shipping'] },
      { href: '/cms/shipping/classes', label: 'Shipping classes', icon: Ruler, match: ['/cms/shipping/classes'] },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/cms/reports/sales', label: 'Sales', icon: BarChart3, match: ['/cms/reports/sales'] },
      { href: '/cms/reports/products', label: 'Products', icon: Package, match: ['/cms/reports/products'] },
      { href: '/cms/reports/customers', label: 'Customers', icon: Users, match: ['/cms/reports/customers'] },
      { href: '/cms/reports/stock', label: 'Stock', icon: Warehouse, match: ['/cms/reports/stock'] },
    ],
  },
  {
    label: 'Appearance',
    items: [
      { href: '/cms/appearance/themes', label: 'Themes', icon: Palette, match: ['/cms/appearance/themes'] },
      { href: '/cms/appearance/customize', label: 'Customize', icon: Palette, match: ['/cms/appearance/customize'] },
      { href: '/cms/appearance/menus', label: 'Menus', icon: Menu, match: ['/cms/appearance/menus'] },
      { href: '/cms/appearance/widgets', label: 'Widgets', icon: LayoutTemplate, match: ['/cms/appearance/widgets'] },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/cms/settings/general', label: 'General', icon: Settings, match: ['/cms/settings/general'] },
      { href: '/cms/settings/reading', label: 'Reading', icon: FileText, match: ['/cms/settings/reading'] },
      { href: '/cms/settings/discussion', label: 'Discussion', icon: Mail, match: ['/cms/settings/discussion'] },
      { href: '/cms/settings/media', label: 'Media', icon: Image, match: ['/cms/settings/media'] },
      { href: '/cms/settings/permalinks', label: 'Permalinks', icon: Menu, match: ['/cms/settings/permalinks'] },
      { href: '/cms/settings/email', label: 'Email', icon: Mail, match: ['/cms/settings/email'] },
      { href: '/cms/settings/payments', label: 'Payments', icon: Receipt, match: ['/cms/settings/payments'] },
      { href: '/cms/settings/tax', label: 'Tax', icon: Percent, match: ['/cms/settings/tax'] },
      { href: '/cms/builder', label: 'Page builder', icon: ShoppingBag, match: ['/cms/builder'] },
    ],
  },
];

function isActive(pathname: string, item: NavItem) {
  const prefixes = item.match || [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function Sidebar() {
  const pathname = usePathname();
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
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {section.label}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href + item.label}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                        active
                          ? 'bg-[#6d6be8] text-white'
                          : 'text-white/60 hover:bg-white/10 hover:text-white',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      <Icon size={18} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
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
          Shared database · port 3003
        </div>
      )}
    </aside>
  );
}
